#!/usr/bin/env python3
"""Publish PUBLIC post-game overview archives from final/partial history snapshots.

The service_role key is never used. No prediction tables, model runs, or
database writes occur; only publicly readable post-game snapshot rows are used.
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


def public_history(start, before):
    # The RLS policy on this table allows public post-game snapshots only.
    return request_json("/rest/v1/jc_history_overview_snapshots", params={
        "select": "business_date,match_count,finished_count,is_final,source,generated_at,payload",
        "business_date": f"gte.{start}",
        "order": "business_date.asc",
        "limit": "40"
    })


def additional_public_fixtures(day, original):
    known = {str(r.get("id")) for r in original}
    records = request_json("/rest/v1/jc_matches", params={
        "select": "id,match_num,business_date,league_name,league_short_name,"
                  "home_team_name,away_team_name,match_date,match_time,kickoff_at,"
                  "match_status,raw",
        "business_date": f"eq.{day}", "limit": "200"
    })
    extras = []
    for r in records:
        if str(r.get("id")) in known:
            continue
        raw = r.get("raw") or {}
        extras.append({
            "id": r.get("id"), "match_num": r.get("match_num"),
            "business_date": day, "league_name": r.get("league_name"),
            "league_short_name": r.get("league_short_name"),
            "home_team_name": r.get("home_team_name"),
            "away_team_name": r.get("away_team_name"),
            "match_date": r.get("match_date"), "match_time": r.get("match_time"),
            "kickoff_at": r.get("kickoff_at"), "match_status": r.get("match_status"),
            "raw": {k: raw.get(k, "") for k in
                    ("sectionsNo999", "sectionsNo1", "matchStatusName")},
            "jc_model_outputs": [], "jc_market_snapshots": []
        })
    return extras


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
    earliest = today - dt.timedelta(days=35)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    dates = dict(manifest.get("dates") or {})
    changed = []

    for record in public_history(earliest.isoformat(), today.isoformat()):
        day = str(record.get("business_date") or "")[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day) or day > cutoff.isoformat():
            continue
        old_file = dates.get(day)
        old = None
        if old_file:
            target = ROOT / old_file
            if target.is_file():
                old = json.loads(target.read_text(encoding="utf-8"))
                # Published fully final archives are immutable.
                if old.get("is_final") is True:
                    continue
                # For an incomplete day, promote only additional confirmed FT
                # results (or the definitive FINAL). Never rewrite already
                # published completed rows in place.
                if (not record.get("is_final")
                        and int(record.get("finished_count") or 0)
                        <= int(old.get("finished_count") or 0)):
                    continue

        rows = list((record.get("payload") or {}).get("rows") or [])
        match_count = int(record.get("match_count") or 0)
        finished_count = int(record.get("finished_count") or 0)
        if not rows or len(rows) != finished_count or finished_count > match_count:
            continue
        # Preserve public results. Any unplayed or stopped fixture has NO model.
        if not record.get("is_final"):
            rows.extend(additional_public_fixtures(day, rows))
        if len({str(row.get("id")) for row in rows}) != len(rows):
            raise RuntimeError("Duplicate match in archive " + day)
        rows.sort(key=lambda r: str(r.get("match_num") or ""))
        embed_crest_links(rows)

        serial = 2
        while (DATA / f"{day}.history.v{serial}.json").exists():
            serial += 1
        relative = f"data/overview/{day}.history.v{serial}.json"
        published = {
            "version": serial, "business_date": day, "frozen": True,
            "frozen_at": record.get("generated_at"),
            "source": record.get("source"),
            "is_final": bool(record.get("is_final")),
            "archived_for_browsing": True, "match_count": len(rows),
            "finished_count": finished_count, "rows": rows
        }
        (ROOT / relative).write_text(
            json.dumps(published, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8")
        dates[day] = relative
        changed.append(f"{day}: {len(rows)} public archived matches")

    if changed:
        manifest["dates"] = dict(sorted(dates.items()))
        manifest["version"] = max(2, int(manifest.get("version", 1)))
        manifest["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        MANIFEST.write_text(
            json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8")
    print("Archives published:", len(changed))
    for item in changed:
        print(item)


if __name__ == "__main__":
    publish()
