#!/usr/bin/env python3
"""Publish public FT/HT-only archives from score-verified fixture snapshots.

The service_role key is never used. No prediction tables, model runs, or database writes occur. Public archives
must contain only team/fixture facts and confirmed FT/HT; no predictions.
"""
import datetime as dt
import json
import os
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "overview"
MANIFEST = DATA / "manifest.json"
BEIJING = dt.timezone(dt.timedelta(hours=8))


def api_config():
    text = (ROOT / "supabase-config.js").read_text(encoding="utf-8")
    url = re.search(r"QC_SUPABASE_URL\s*=\s*['\"]([^'\"]+)", text)
    key = re.search(r"QC_SUPABASE_PUBLISHABLE_KEY\s*=\s*['\"]([^'\"]+)", text)
    if not url or not key:
        raise RuntimeError("Missing public Supabase configuration")
    return url.group(1).rstrip("/"), key.group(1)


def request_json(endpoint, *, params=None, body=None):
    url, key = api_config()
    target = url + endpoint
    if params:
        target += "?" + urllib.parse.urlencode(params)
    headers = {"apikey": key, "Authorization": "Bearer " + key,
               "Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(target, data=data, headers=headers,
                                 method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=35) as res:
        return json.load(res)


def sanitize_public_row(row):
    """A public archive is an FT/HT scoreboard, never a model export."""
    keys = ("id", "match_num", "business_date", "league_name", "league_short_name",
            "home_team_name", "away_team_name", "match_date", "match_time",
            "kickoff_at", "match_status", "_homeLogoUrl", "_awayLogoUrl")
    clean = {k: row[k] for k in keys if k in row}
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    clean["raw"] = {
        "sectionsNo999": raw.get("sectionsNo999") or "",
        "sectionsNo1": raw.get("sectionsNo1") or "",
        "matchStatusName": raw.get("matchStatusName") or ""
    }
    return clean


def public_history(start, before):
    """Derive only confirmed public scores from the independent fixture snapshots.

    The prediction/history-snapshot table is Pro-only and MUST NOT be queried
    with a public key. Never serialize locked_model_outputs to GitHub Pages.
    """
    snapshots = request_json("/rest/v1/jc_overview_schedule_snapshots", params={
        "select": "business_date,match_count,payload",
        "business_date": f"gte.{start}",
        "order": "business_date.asc",
        "limit": "100",
    })
    records = []
    final_re = re.compile(r"已结束|完赛|已完成|finished|final", re.I)
    score_re = re.compile(r"^\\d{1,2}[:-]\\d{1,2}$")
    for snap in snapshots or []:
        day = str(snap.get("business_date") or "")[:10]
        if day >= before:
            continue
        original = (snap.get("payload") or {}).get("rows") or []
        count = int(snap.get("match_count") or 0)
        if not isinstance(original, list):
            continue
        done = 0
        for row in original:
            raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
            status = str(row.get("match_status") or "") + str(raw.get("matchStatusName") or "")
            if (score_re.fullmatch(str(raw.get("sectionsNo999") or "")) and
                    score_re.fullmatch(str(raw.get("sectionsNo1") or "")) and
                    final_re.search(status)):
                done += 1
        is_final = count > 0 and len(original) == count and done == count
        records.append({
            "business_date": day, "match_count": count,
            "finished_count": done, "is_final": is_final,
            "source": "public_final_scores_only",
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "payload": {"rows": [sanitize_public_row(row) for row in original]}
        })
    return records


def public_schedule_ids(day):
    """Independent fixture census; a 16/16 history is NOT final if 17 were scheduled."""
    records = request_json("/rest/v1/jc_overview_schedule_snapshots", params={
        "select": "business_date,match_count,payload",
        "business_date": "eq." + day,
        "limit": "1",
    })
    if not isinstance(records, list) or len(records) != 1:
        return None
    record = records[0]
    rows = (record.get("payload") or {}).get("rows") or []
    expected = int(record.get("match_count") or 0)
    if not isinstance(rows, list) or not expected or len(rows) != expected:
        return None
    ids = [str(row.get("id") or "") for row in rows]
    if not all(ids) or len(set(ids)) != expected:
        return None
    return set(ids)


def check_final_history(record, schedule_ids):
    """Pure fail-closed publication gate, checked again after writing the manifest."""
    if record.get("is_final") is not True:
        return False, "database snapshot is not FINAL"
    rows = (record.get("payload") or {}).get("rows") or []
    count = int(record.get("match_count") or 0)
    finished = int(record.get("finished_count") or 0)
    if not count or not isinstance(rows, list) or not (
            count == finished == len(rows)):
        return False, "database finished/expected row count mismatch"
    ids = [str(row.get("id") or "") for row in rows]
    if not all(ids) or len(set(ids)) != count:
        return False, "duplicate or missing fixture IDs"
    if schedule_ids is None:
        return False, "independent full fixture schedule unavailable"
    if len(schedule_ids) != count or set(ids) != schedule_ids:
        return False, "database history differs from independent schedule IDs"
    score_re = re.compile(r"^\d{1,2}[:-]\d{1,2}$")
    for row in rows:
        raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        ft, ht = str(raw.get("sectionsNo999") or ""), str(raw.get("sectionsNo1") or "")
        status = str(row.get("match_status") or "") + " " + str(raw.get("matchStatusName") or "")
        if not score_re.fullmatch(ft) or not score_re.fullmatch(ht) or not re.search(
                r"已结束|完赛|已完成|finished|final", status, re.I):
            return False, "unverified FT/HT in a supposedly FINAL history"
        if any(key in row for key in ("jc_model_outputs", "jc_match_ai_analysis",
                                        "top_scores", "single_pick", "direction",
                                        "htft_top1", "htft_top2", "goal_range")):
            return False, "private prediction field in public score archive"
    return True, "complete"


def latest_existing_archive(day, mapped_file):
    """Preserve old partial rows even after removing the unsafe public manifest link."""
    candidates = []
    if mapped_file:
        candidates.append(ROOT / mapped_file)
    candidates.extend(sorted(
        DATA.glob(day + ".history.v*.json"),
        key=lambda p: int(re.search(r"\.v(\d+)\.json$", p.name).group(1)),
        reverse=True,
    ))
    for path in candidates:
        if path.is_file():
            item = json.loads(path.read_text(encoding="utf-8"))
            if item.get("business_date") == day:
                return item
    return None


def archived_final_matches(candidate, schedule_ids):
    if not isinstance(candidate, dict) or candidate.get("is_final") is not True:
        return False
    rows = candidate.get("rows") or []
    count = int(candidate.get("match_count") or 0)
    return (count > 0 and count == int(candidate.get("finished_count") or 0)
            and len(rows) == count and schedule_ids is not None
            and {str(r.get("id") or "") for r in rows} == schedule_ids
            and len(schedule_ids) == count
            and not any("jc_model_outputs" in r or "single_pick" in r or
                        "top_scores" in r or "direction" in r for r in rows))


def embed_crest_links(rows):
    names = sorted({str(r.get(k)) for r in rows
                    for k in ("home_team_name", "away_team_name") if r.get(k)})
    if not names:
        return
    resolved = request_json("/rest/v1/rpc/resolve_team_logos",
                            body={"p_names": names})
    mapping = {str(r.get("input_name")): r.get("logo_url") or ""
               for r in (resolved or [])}
    for row in rows:
        home = mapping.get(str(row.get("home_team_name")), "")
        away = mapping.get(str(row.get("away_team_name")), "")
        if home:
            row["_homeLogoUrl"] = home
        if away:
            row["_awayLogoUrl"] = away


def publish():
    today = dt.datetime.now(BEIJING).date()
    cutoff = today - dt.timedelta(days=1)
    recent_only = os.environ.get("QC_ARCHIVE_RECENT_ONLY", "0") == "1"
    earliest = today - dt.timedelta(days=3 if recent_only else 35)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    dates = dict(manifest.get("dates") or {})
    changed = []
    waiting = []
    checked_final_dates = []

    for record in public_history(earliest.isoformat(), today.isoformat()):
        day = str(record.get("business_date") or "")[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day) or day > cutoff.isoformat():
            continue
        old_file = dates.get(day)
        old = latest_existing_archive(day, old_file)
        if old and old.get("hidden_exceptions"):
            # Explicit human exclusions remain locked; never override them.
            continue

        # A partial result is not a daily archive. Keep its old immutable
        # version on disk for append-only recovery, but NEVER advertise it
        # to the homepage manifest. This also cleans old partial links.
        if record.get("is_final") is not True:
            if (day >= (today - dt.timedelta(days=3)).isoformat()
                    and old_file and old and old.get("is_final") is not True):
                dates.pop(day, None)
                changed.append(day + ": hide incomplete archive from public index")
            waiting.append(day + ": database history not final")
            continue

        # Independent schedule count/IDs guard against false 16/16 finals
        # when 17 matches were actually scheduled for the same business date.
        schedule_ids = public_schedule_ids(day)
        if schedule_ids is None and day < "2026-10-20":
            # Legacy archive dates predate the schedule-snapshot publisher.
            schedule_ids = {str(r.get("id") or "")
                            for r in (record.get("payload") or {}).get("rows") or []}
        ready, reason = check_final_history(record, schedule_ids)
        if not ready:
            waiting.append(day + ": " + reason)
            if (day >= (today - dt.timedelta(days=3)).isoformat()
                    and old_file and old and not archived_final_matches(old, schedule_ids)):
                dates.pop(day, None)
                changed.append(day + ": hide stale/incomplete indexed archive")
            continue

        checked_final_dates.append((day, schedule_ids))
        if old_file and archived_final_matches(old, schedule_ids):
            # A valid FINAL remains immutable, including scores and models.
            continue

        rows = list((record.get("payload") or {}).get("rows") or [])
        if old:
            # Preserve every previously published row byte-for-byte at the
            # object level; append only newly completed frozen matches.
            existing = old.get("rows") or []
            existing_by_id = {str(row.get("id") or ""): row for row in existing}
            incoming_by_id = {str(row.get("id") or ""): row for row in rows}
            if len(existing_by_id) != len(existing):
                raise RuntimeError("Duplicate frozen match in archive " + day)
            if not set(existing_by_id).issubset(incoming_by_id):
                raise RuntimeError("Frozen match disappeared from database " + day)
            newcomers = [row for row in rows if str(row.get("id")) not in existing_by_id]
            embed_crest_links(newcomers)
            rows = [sanitize_public_row(r) for r in existing + newcomers]
        else:
            rows = [sanitize_public_row(r) for r in rows]
            embed_crest_links(rows)
        if len(rows) != len(schedule_ids):
            raise RuntimeError("Append-only archive count mismatch: " + day)
        rows.sort(key=lambda r: str(r.get("match_num") or ""))

        serial = 2
        while (DATA / f"{day}.history.v{serial}.json").exists():
            serial += 1
        relative = f"data/overview/{day}.history.v{serial}.json"
        published = {
            "version": serial, "business_date": day, "frozen": True,
            "frozen_at": record.get("generated_at"),
            "source": record.get("source"),
            "is_final": True,
            "archived_for_browsing": True,
            "match_count": len(rows),
            "finished_count": len(rows),
            "rows": rows,
        }
        if not archived_final_matches(published, schedule_ids):
            raise RuntimeError("Final archive integrity failed: " + day)
        (ROOT / relative).write_text(
            json.dumps(published, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        dates[day] = relative
        changed.append(f"{day}: publish {len(rows)}/{len(schedule_ids)} FINAL")

    # Do not report success if the database was FINAL but the generated public
    # index is stale/incomplete. GitHub will retry on its next scheduled/event run.
    for day, schedule_ids in checked_final_dates:
        source = dates.get(day)
        if not source or not (ROOT / source).is_file():
            raise RuntimeError("FINAL database but public archive absent: " + day)
        archive = json.loads((ROOT / source).read_text(encoding="utf-8"))
        if not archived_final_matches(archive, schedule_ids):
            raise RuntimeError("FINAL database/public archive mismatch: " + day)

    if changed:
        manifest["dates"] = dict(sorted(dates.items()))
        manifest["version"] = max(2, int(manifest.get("version", 1)))
        manifest["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        MANIFEST.write_text(
            json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    print("Archives published/cleaned:", len(changed),
          "| pending days:", len(waiting))
    for item in changed:
        print("PUBLISHED:", item)
    for item in waiting:
        print("PENDING_RETRY:", item)


if __name__ == "__main__":
    publish()
