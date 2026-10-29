#!/usr/bin/env python3
"""Cache football team crests as immutable same-origin assets at fixture intake.

PUBLIC data only. Never reads model/AI private data, never writes Supabase.
Existing crest files are immutable and never re-downloaded.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "team-logos"
CATALOG = ROOT / "data" / "team-logos" / "catalog.json"
CATALOG_JS = ASSETS / "catalog.js"
ARCHIVE_MANIFEST = ROOT / "data" / "overview" / "manifest.json"
LIVE_SCHEDULE_DIR = ROOT / "data" / "overview" / "live"
LIVE_SCHEDULE_MANIFEST = ROOT / "data" / "overview" / "live-schedule-manifest.json"
BEIJING = timezone(timedelta(hours=8))
MAX_LOGO_BYTES = 900_000


def public_api_config():
    src = (ROOT / "supabase-config.js").read_text(encoding="utf-8")
    url = re.search(r'QC_SUPABASE_URL\s*=\s*["\x27]([^"\x27]+)', src)
    key = re.search(r'QC_SUPABASE_PUBLISHABLE_KEY\s*=\s*["\x27]([^"\x27]+)', src)
    if not url or not key:
        raise RuntimeError("Missing publishable Supabase config")
    return url.group(1).rstrip("/"), key.group(1)


def public_request(endpoint, params=None, body=None):
    base, key = public_api_config()
    url = base + endpoint
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {"apikey": key, "Authorization": "Bearer " + key,
               "Accept": "application/json"}
    encoded = None
    if body is not None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=encoded, headers=headers,
                                 method="POST" if encoded is not None else "GET")
    with urllib.request.urlopen(req, timeout=35) as res:
        return json.load(res)


def safe_source(url):
    """Only exact, known image CDN paths, never arbitrary URLs or hosts."""
    src = str(url or "").strip()
    p = urllib.parse.urlsplit(src)
    if p.scheme != "https" or p.username or p.password or p.port or p.query or p.fragment:
        return None
    if p.hostname == "images.fotmob.com":
        match = re.fullmatch(r"/image_resources/logo/teamlogo/([0-9]{1,10})\.png", p.path)
        return ("fotmob-" + match.group(1)) if match else None
    if p.hostname == "a.espncdn.com":
        match = re.fullmatch(r"/i/teamlogos/soccer/500/([0-9]{1,10})\.png", p.path)
        if match:
            return "espn-soccer-" + match.group(1)
        match = re.fullmatch(r"/i/teamlogos/countries/500/([a-z0-9_-]{2,16})\.png", p.path)
        if match:
            return "espn-country-" + match.group(1)
    return None


class NoExternalRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        location = urllib.parse.urlsplit(newurl)
        if (location.scheme == "https" and location.hostname in
                ("a.espncdn.com", "images.fotmob.com") and
                not location.username and not location.password):
            return super().redirect_request(req, fp, code, msg, headers, newurl)
        raise ValueError("Redirect outside trusted image CDNs")


IMAGE_OPENER = urllib.request.build_opener(NoExternalRedirects)


def asset_is_valid(path):
    if not path.is_file() or path.stat().st_size > MAX_LOGO_BYTES:
        return False
    header = path.read_bytes()[:12]
    return (header.startswith(b"\x89PNG\r\n\x1a\n") or
            header.startswith(b"\xff\xd8\xff") or
            (header.startswith(b"RIFF") and header[8:12] == b"WEBP"))


def download_immutable_logo(url):
    asset_stem = safe_source(url)
    if not asset_stem:
        return None
    for ext in (".png", ".jpg", ".webp"):
        candidate = ASSETS / (asset_stem + ext)
        if asset_is_valid(candidate):
            return "assets/team-logos/" + candidate.name
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
            "Accept": "image/png,image/webp,image/jpeg"})
        with IMAGE_OPENER.open(req, timeout=16) as response:
            data = response.read(MAX_LOGO_BYTES + 1)
        if not data or len(data) > MAX_LOGO_BYTES:
            raise ValueError("Image exceeds size limit or is empty")
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            extension = ".png"
        elif data.startswith(b"\xff\xd8\xff"):
            extension = ".jpg"
        elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            extension = ".webp"
        else:
            raise ValueError("Response is not PNG/JPEG/WebP")
        destination = ASSETS / (asset_stem + extension)
        if not destination.exists():
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            temporary.write_bytes(data)
            os.replace(temporary, destination)
        return "assets/team-logos/" + destination.name
    except Exception as exc:
        print("WARNING crest cache:", asset_stem, str(exc)[:160])
        if asset_stem == "espn-soccer-817":
            # Official alternate team ID for Al Nassr FC, not a substitute crest.
            alternate = "https://images.fotmob.com/image_resources/logo/teamlogo/101918.png"
            return download_immutable_logo(alternate)
        return None


def collect_team_names():
    """Use archive logos plus scheduled fixtures, never sensitive predictions."""
    names = {}
    if ARCHIVE_MANIFEST.exists():
        manifest = json.loads(ARCHIVE_MANIFEST.read_text(encoding="utf-8"))
        for relative in (manifest.get("dates") or {}).values():
            path = (ROOT / relative).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            for row in payload.get("rows", []):
                for side in ("home", "away"):
                    name = str(row.get(side + "_team_name") or "").strip()
                    url = str(row.get("_" + side + "LogoUrl") or "").strip()
                    if name and name not in names:
                        names[name] = url

    today = datetime.now(BEIJING).date()
    # Pre-cache future fixtures immediately after their first schedule snapshot.
    records = public_request("/rest/v1/jc_overview_schedule_snapshots", {
        "select": "business_date,payload",
        "business_date": "gte." + (today - timedelta(days=1)).isoformat(),
        "order": "business_date.asc",
        "limit": "15"
    })
    for entry in records:
        for row in (entry.get("payload") or {}).get("rows", []):
            for side in ("home", "away"):
                name = str(row.get(side + "_team_name") or "").strip()
                url = str(row.get("_" + side + "LogoUrl") or "").strip()
                if name and name not in names:
                    names[name] = url
    return names


def fill_missing_sources(teams):
    # Three verified source-specific aliases absent or unreliable in the
    # initial public resolver. Fixed canonical team IDs, never scraped per page.
    verified = {
        "磐田喜悦": "https://images.fotmob.com/image_resources/logo/teamlogo/8065.png",
        "宫崎惊奇牛鸟": "https://images.fotmob.com/image_resources/logo/teamlogo/941024.png",
        "利雅得胜利": "https://a.espncdn.com/i/teamlogos/soccer/500/817.png",
        # Confirmed official FotMob team profile /teams/9841 for Wrexham AFC.
        "雷克斯汉姆": "https://images.fotmob.com/image_resources/logo/teamlogo/9841.png",
    }
    for name, url in verified.items():
        if name in teams:
            teams[name] = url
    unknown = [name for name, url in teams.items() if not safe_source(url)]
    for pos in range(0, len(unknown), 90):
        batch = unknown[pos:pos + 90]
        rows = public_request("/rest/v1/rpc/resolve_team_logos",
                              body={"p_names": batch})
        for row in rows or []:
            name = str(row.get("input_name") or "")
            source = str(row.get("logo_url") or "")
            if name in teams and safe_source(source):
                teams[name] = source



def public_prekick_markets(base_rows):
    """Read PUBLIC official odds once during fixture publication, not per visitor.

    Pro FINAL and AI are never queried or exposed. Only valid pre-kickoff
    market snapshots are frozen into the date's static roster.
    """
    ids = [str(row.get("id") or "") for row in base_rows]
    ids = [value for value in ids if re.fullmatch(r"[a-f0-9-]{36}", value, re.I)]
    if not ids:
        return {}
    by_id = {value: [] for value in ids}
    kickoff_by_id = {}
    for row in base_rows:
        value = str(row.get("id") or "")
        try:
            kickoff = datetime.fromisoformat(str(row.get("kickoff_at") or "").replace("Z", "+00:00"))
            kickoff_by_id[value] = kickoff
        except (ValueError, TypeError):
            pass
    try:
        records = public_request("/rest/v1/jc_prekick_latest_market_snapshots", {
            "select": "jc_match_id,pool_code,goal_line,outcomes,captured_at,official_update_time",
            "jc_match_id": "in.(" + ",".join(ids) + ")",
            "limit": "500"
        })
    except Exception as error:
        print("WARNING public odds unavailable, keep schedule and default fallback:", str(error)[:180])
        return {}
    if not isinstance(records, list):
        return {}
    for item in records:
        if not isinstance(item, dict):
            continue
        mid = str(item.get("jc_match_id") or "")
        pool = str(item.get("pool_code") or "")
        if mid not in by_id or pool not in ("had", "hhad", "crs", "ttg", "hafu"):
            continue
        values = item.get("outcomes")
        if not isinstance(values, dict) or not values:
            continue
        try:
            captured = datetime.fromisoformat(str(item.get("captured_at") or "").replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        kickoff = kickoff_by_id.get(mid)
        if kickoff and captured > kickoff:
            continue
        safe_odds = {
            str(k): v for k, v in values.items()
            if isinstance(v, (float, int)) and not isinstance(v, bool) and 1 <= v <= 10000
        }
        if not safe_odds:
            continue
        by_id[mid].append({
            "jc_match_id": mid,
            "pool_code": pool,
            "goal_line": item.get("goal_line"),
            "outcomes": safe_odds,
            "captured_at": item["captured_at"],
            "official_update_time": item.get("official_update_time"),
        })
    return {mid: sorted(items, key=lambda m: m["pool_code"])
            for mid, items in by_id.items() if items}


def prekick_is_open(row, now):
    """The ONLY moment official odds may change on an existing static card."""
    if not isinstance(row, dict):
        return False
    try:
        kickoff = datetime.fromisoformat(str(row.get("kickoff_at") or "").replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return False
    if kickoff.tzinfo is None or now >= kickoff:
        return False
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    state = str(row.get("match_status") or "") + " " + str(raw.get("matchStatusName") or "")
    if re.search(r"已结束|完赛|已完成|已开始|比赛中|进行中|中场|上半场|下半场|加时|点球|中断|延期|取消|finished|final|live|started|postponed|cancelled", state, re.I):
        return False
    return True


def merged_prekick_markets(old_items, new_items):
    """Never delete market pools or roll odds backwards on partial collection."""
    current = {str(item.get("pool_code")): item for item in (old_items or [])
               if isinstance(item, dict) and item.get("pool_code") in
               ("had", "hhad", "crs", "ttg", "hafu")}
    for item in new_items or []:
        if not isinstance(item, dict):
            continue
        pool = str(item.get("pool_code") or "")
        if pool not in ("had", "hhad", "crs", "ttg", "hafu"):
            continue
        previous = current.get(pool)
        if previous:
            try:
                prev_time = datetime.fromisoformat(str(previous["captured_at"]).replace("Z", "+00:00"))
                new_time = datetime.fromisoformat(str(item["captured_at"]).replace("Z", "+00:00"))
                if new_time < prev_time:
                    continue
            except (TypeError, ValueError, KeyError):
                # Never degrade a previously recorded market when metadata is invalid.
                continue
        current[pool] = item
    return [current[key] for key in sorted(current)]


def update_existing_static_row(old_row, incoming_markets, now):
    """Preserve identities, FT/HT, predictions and ALL content after kickoff."""
    if not prekick_is_open(old_row, now):
        return old_row
    merged = merged_prekick_markets(old_row.get("jc_market_snapshots"), incoming_markets)
    if not merged:
        return old_row
    updated = dict(old_row)
    updated["jc_market_snapshots"] = merged
    updated["_jcMarketsComplete"] = True
    return updated


def static_odds_self_test():
    from copy import deepcopy
    now = datetime(2026, 10, 19, 2, tzinfo=timezone.utc)
    old = {"id": "fixed-001", "kickoff_at": "2026-10-19T17:00:00+00:00",
           "home_team_name": "fixed", "match_status": "3",
           "raw": {"sectionsNo999": "", "sectionsNo1": ""},
           "jc_market_snapshots": [
               {"pool_code": "had", "captured_at": "2026-10-18T02:00:00+00:00", "outcomes": {"h": 1.7}},
               {"pool_code": "ttg", "captured_at": "2026-10-18T02:00:00+00:00", "outcomes": {"2": 3.2}}]}
    newer = [{"pool_code": "had", "captured_at": "2026-10-19T01:00:00+00:00",
              "outcomes": {"h": 1.65}}]
    fresh = update_existing_static_row(old, newer, now)
    assert old["jc_market_snapshots"][0]["outcomes"]["h"] == 1.7
    assert len(fresh["jc_market_snapshots"]) == 2
    assert fresh["jc_market_snapshots"][0]["outcomes"]["h"] == 1.65
    assert fresh["jc_market_snapshots"][1]["outcomes"]["2"] == 3.2
    assert update_existing_static_row(fresh, old["jc_market_snapshots"], now) == fresh
    assert update_existing_static_row(fresh, [], now) == fresh
    in_play = deepcopy(fresh)
    in_play["raw"]["matchStatusName"] = "比赛中"
    assert update_existing_static_row(in_play, newer, now) == in_play
    assert update_existing_static_row(fresh, newer, datetime(2026, 10, 19, 17, tzinfo=timezone.utc)) is fresh
    finished = deepcopy(fresh)
    finished["raw"] = {"matchStatusName": "已结束", "sectionsNo999": "3-0", "sectionsNo1": "1-0"}
    assert update_existing_static_row(finished, newer, now) is finished
    assert finished["raw"]["sectionsNo999"] == "3-0"
    print("PASS: odds update only prekick; in-play and FT static immutable")


def complete_prekick_crests(row, by_team, now):
    """Only fill missing immutable *local* crests before kickoff.

    Never alter a played/FT/cancelled match, its identity, score, odds or FINAL.
    """
    if not prekick_is_open(row, now):
        return row
    update = {}
    for side in ("home", "away"):
        field = "_" + side + "LogoUrl"
        current = str(row.get(field) or "").strip()
        if current and current.startswith("assets/team-logos/") and asset_is_valid(ROOT / current):
            continue
        name = str(row.get(side + "_team_name") or "").strip()
        local = by_team.get(name, "")
        if local and local.startswith("assets/team-logos/") and asset_is_valid(ROOT / local):
            update[field] = local
    return {**row, **update} if update else row


def assert_prekick_crests_complete(rows, by_team, now, date_str):
    """Stop incomplete public snapshot publication instead of silent empty logos."""
    missing = []
    for row in rows:
        if not prekick_is_open(row, now):
            continue
        for side in ("home", "away"):
            team = str(row.get(side + "_team_name") or "").strip()
            local = str(row.get("_" + side + "LogoUrl") or "")
            if not (local and local == by_team.get(team) and
                    local.startswith("assets/team-logos/") and
                    asset_is_valid(ROOT / local)):
                missing.append(str(row.get("match_num") or row.get("id")) +
                               ":" + team)
    if missing:
        raise RuntimeError("Static schedule crest gate " + date_str +
                           ": missing local validated logos for " +
                           ", ".join(missing))


def audit_published_live_crests():
    """Check every published live roster against actual local files; read-only."""
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_team = catalog.get("by_team") or {}
    manifest = json.loads(LIVE_SCHEDULE_MANIFEST.read_text(encoding="utf-8"))
    checked = 0
    today = datetime.now(BEIJING).date()
    for ds, entry in (manifest.get("dates") or {}).items():
        file_path = (ROOT / str(entry["file"])).resolve()
        if not file_path.is_relative_to(LIVE_SCHEDULE_DIR) or not file_path.is_file():
            raise RuntimeError("Static crest audit: manifest file missing " + ds)
        payload = json.loads(file_path.read_text(encoding="utf-8"))
        rows = payload.get("rows") or []
        if len(rows) != int(entry["match_count"]) or len(rows) != int(payload.get("match_count") or 0):
            raise RuntimeError("Static crest audit: incomplete fixtures " + ds)
        for row in rows:
            for side in ("home", "away"):
                local = row.get("_" + side + "LogoUrl") or ""
                team = str(row.get(side + "_team_name") or "")
                # Past locked results must never be re-written. Their missing
                # crests are still reported, while future/current fixtures fail.
                if (not local or local != by_team.get(team) or
                        not local.startswith("assets/team-logos/") or
                        not asset_is_valid(ROOT / local)):
                    msg = ds + " " + str(row.get("match_num") or "") + " " + team
                    if ds >= today.isoformat():
                        raise RuntimeError("Static crest audit: unresolved published match " + msg)
                    print("WARNING past frozen crest missing (not overwritten):", msg)
                checked += 1
    print("PASS: static published crest audit checked", checked,
          "team slots across", len(manifest.get("dates") or {}), "dates")


def static_crest_self_test():
    from copy import deepcopy
    now = datetime(2026, 10, 29, 8, tzinfo=timezone.utc)
    before = {"id": "fixed-crest-001", "match_num": "周五008",
              "kickoff_at": "2026-10-30T17:00:00+00:00",
              "home_team_name": "谢菲尔德联", "away_team_name": "雷克斯汉姆",
              "match_status": "未开始", "_homeLogoUrl": "", "_awayLogoUrl": "",
              "raw": {"sectionsNo999": ""}}
    # Do not assume any downloaded images exist for this offline self-test.
    after = complete_prekick_crests(before, {}, now)
    assert after is before
    finished = deepcopy(before)
    finished["raw"]["matchStatusName"] = "已结束"
    assert complete_prekick_crests(finished, {}, now) is finished
    assert complete_prekick_crests(before, {},
        datetime(2026, 10, 31, tzinfo=timezone.utc)) is before
    print("PASS: crest gaps can only be filled before kickoff; FT remains sealed")


def allow_additive_fixture_intake(old_by_id, incoming_by_id, now, ds):
    """Allow ONLY new, unstarted official fixture IDs.

    Refuse deleted/replaced IDs, duplicate match numbers and any changes to
    the sealed existing team's identity. Existing FT/HT, model references and
    kickoff-time information remain protected from collector overwrites.
    """
    old_ids = set(old_by_id)
    new_ids = set(incoming_by_id)
    if not old_ids.issubset(new_ids):
        print("WARNING static fixture identity disappeared; blocked:", ds,
              sorted(old_ids - new_ids))
        return False
    if len(incoming_by_id) != len(new_ids):
        print("WARNING duplicate incoming fixture IDs; blocked:", ds)
        return False
    seen_nums = set()
    for old in old_by_id.values():
        number = str(old.get("match_num") or "")
        if not number or number in seen_nums:
            print("WARNING duplicate pre-existing fixture numbers:", ds)
            return False
        seen_nums.add(number)
    for match_id in old_ids:
        old = old_by_id[match_id]
        fresh = incoming_by_id[match_id]
        for key in ("match_num", "business_date", "home_team_name",
                    "away_team_name", "kickoff_at", "match_date", "match_time"):
            if str(old.get(key) or "") != str(fresh.get(key) or ""):
                print("WARNING sealed fixture metadata differs; blocked:",
                      ds, match_id, key)
                return False
    additions = new_ids - old_ids
    for match_id in additions:
        candidate = incoming_by_id[match_id]
        number = str(candidate.get("match_num") or "")
        if not number or number in seen_nums or not prekick_is_open(candidate, now):
            print("WARNING unsafe newly collected fixture; blocked:", ds, match_id)
            return False
        seen_nums.add(number)
    if additions:
        print("Safe public fixture additions:", ds, len(additions),
              ",".join(sorted(str(incoming_by_id[x].get("match_num")) for x in additions)))
    return True


def static_additive_fixture_self_test():
    from copy import deepcopy
    now = datetime(2026, 10, 29, 3, tzinfo=timezone.utc)
    original = {"id": "old1", "match_num": "周四001",
                "business_date": "2026-10-29",
                "home_team_name": "主队A", "away_team_name": "客队A",
                "match_date": "2026-10-29", "match_time": "20:00:00",
                "kickoff_at": "2026-10-29T12:00:00+00:00",
                "match_status": "3", "raw": {"matchStatusName": "待开售",
                "sectionsNo999": "", "sectionsNo1": ""}}
    later = {**original, "id": "new2", "match_num": "周四002",
             "home_team_name": "主队B", "away_team_name": "客队B"}
    assert allow_additive_fixture_intake({"old1": original},
             {"old1": deepcopy(original), "new2": later},
             now, "2026-10-29")
    assert allow_additive_fixture_intake({"old1": original},
             {"old1": deepcopy(original)}, now, "2026-10-29")
    assert not allow_additive_fixture_intake({"old1": original},
             {"new2": later}, now, "2026-10-29")
    replaced = {**later, "match_num": "周四001"}
    assert not allow_additive_fixture_intake({"old1": original},
             {"old1": original, "new2": replaced}, now, "2026-10-29")
    started = {**later, "raw": {"matchStatusName": "已结束"}}
    assert not allow_additive_fixture_intake({"old1": original},
             {"old1": original, "new2": started}, now, "2026-10-29")
    changed = {**original, "home_team_name": "错误球队"}
    assert not allow_additive_fixture_intake({"old1": original},
             {"old1": changed}, now, "2026-10-29")
    finished = deepcopy(original)
    finished["raw"] = {"matchStatusName": "已结束",
                       "sectionsNo999": "2-1", "sectionsNo1": "1-1"}
    assert allow_additive_fixture_intake({"old1": finished},
             {"old1": original, "new2": later}, now, "2026-10-29")
    # Preserve the original locked FT object even when a fresh roster adds IDs.
    assert finished["raw"]["sectionsNo999"] == "2-1"
    print("PASS safe additive fixtures: allow prekick only, preserve sealed FT")


def publish_live_schedules(by_team):
    """Publish public-only current schedule snapshots so first paint never needs Supabase."""
    LIVE_SCHEDULE_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(BEIJING).date()
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=2)).isoformat()
    records = public_request("/rest/v1/jc_overview_schedule_snapshots", {
        "select": "business_date,payload,match_count",
        "business_date": "gte." + start,
        "and": "(business_date.lte." + end + ")",
        "order": "business_date.asc",
        "limit": "12"
    })
    if not isinstance(records, list) or not records:
        raise RuntimeError("No public schedule snapshots returned; keeping previous live files")

    old_manifest = {}
    if LIVE_SCHEDULE_MANIFEST.exists():
        try:
            old_manifest = json.loads(LIVE_SCHEDULE_MANIFEST.read_text(encoding="utf-8"))
        except Exception:
            old_manifest = {}
    dates = {}
    changed = False
    now = datetime.now(timezone.utc)
    allowed_fields = (
        "id", "match_num", "business_date", "league_name", "league_short_name",
        "home_team_name", "away_team_name", "match_date", "match_time",
        "kickoff_at", "match_status"
    )
    for record in records:
        ds = str(record.get("business_date") or "")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", ds):
            continue
        if ds < start or ds > end:
            continue
        base_rows = (record.get("payload") or {}).get("rows")
        count = int(record.get("match_count") or 0)
        if not isinstance(base_rows, list) or count <= 0 or len(base_rows) != count:
            print("WARNING incomplete live schedule; skipped:", ds, "count=", count,
                  "rows=", len(base_rows) if isinstance(base_rows, list) else "invalid")
            continue

        # Static fixture identities are sealed on first publication.
        # A collector run may replace odds for NOT-STARTED matches only.
        # In-progress scores and official FT are owned by publish_final_scores.py.
        relative = "data/overview/live/" + ds + ".json"
        destination = ROOT / relative
        existing = None
        old_by_id = {}
        if destination.exists():
            existing = json.loads(destination.read_text(encoding="utf-8"))
            old_rows = existing.get("rows") or []
            if (existing.get("business_date") != ds or
                    len(old_rows) != int(existing.get("match_count") or 0) or
                    len({str(r.get("id")) for r in old_rows}) != len(old_rows)):
                raise RuntimeError("Existing immutable fixture failed integrity check: " + ds)
            old_by_id = {str(r["id"]): r for r in old_rows}
            incoming_by_id = {str(r.get("id")): r for r in base_rows
                              if isinstance(r, dict) and r.get("id")}
            if (len(incoming_by_id) != count or
                    not allow_additive_fixture_intake(
                        old_by_id, incoming_by_id, now, ds)):
                print("WARNING public roster differs unsafely; preserved immutable original:", ds)
                # Do not remove or replace previously published matches or FINALS.
                old_digest = hashlib.sha256(json.dumps(existing, ensure_ascii=False,
                    separators=(",", ":")).encode("utf-8")).hexdigest()[:16]
                dates[ds] = {"file": relative, "version": old_digest,
                             "match_count": len(old_rows)}
                continue

        # Public official market data only, never model or Pro data.
        public_markets = public_prekick_markets(base_rows)
        rows = []
        valid = True
        for source_row in base_rows:
            if not isinstance(source_row, dict) or str(source_row.get("business_date") or ds) != ds or not source_row.get("id"):
                valid = False
                break
            match_id = str(source_row["id"])
            match_markets = public_markets.get(match_id, [])
            if match_id in old_by_id:
                # This also preserves a score published by another workflow.
                # Once kickoff has passed this returns EXACTLY the old object.
                row = update_existing_static_row(old_by_id[match_id], match_markets, now)
            else:
                row = {k: source_row.get(k) for k in allowed_fields if k in source_row}
                raw = source_row.get("raw") if isinstance(source_row.get("raw"), dict) else {}
                row["raw"] = {
                    "matchStatusName": raw.get("matchStatusName"),
                    "sectionsNo999": raw.get("sectionsNo999"),
                    "sectionsNo1": raw.get("sectionsNo1")
                }
                home = str(row.get("home_team_name") or "").strip()
                away = str(row.get("away_team_name") or "").strip()
                row["_homeLogoUrl"] = by_team.get(home, "")
                row["_awayLogoUrl"] = by_team.get(away, "")
                if prekick_is_open(row, now) and match_markets:
                    row["jc_market_snapshots"] = match_markets
                    row["_jcMarketsComplete"] = True
                row["_jcScheduleSnapshot"] = True
            # A previously published prekick roster may have been sealed before
            # the crest asset was first cached. Fill ONLY empty/invalid crest
            # paths now; keep the entire match and all odds/FT values intact.
            row = complete_prekick_crests(row, by_team, now)
            rows.append(row)
        if not valid or len(rows) != count:
            print("WARNING invalid live schedule rows; skipped:", ds)
            continue

        assert_prekick_crests_complete(rows, by_team, now, ds)

        payload = {
            "version": 1,
            "business_date": ds,
            "match_count": count,
            "rows": rows
        }
        compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        digest = hashlib.sha256(compact.encode("utf-8")).hexdigest()[:16]
        if not destination.exists() or destination.read_text(encoding="utf-8") != json.dumps(payload, ensure_ascii=False, indent=2) + "\n":
            destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            changed = True
        dates[ds] = {"file": relative, "version": digest, "match_count": count}

    if not dates:
        raise RuntimeError("No complete public schedule snapshot validated; keeping previous live manifest")

    previous_dates = old_manifest.get("dates") if isinstance(old_manifest.get("dates"), dict) else {}
    manifest_changed = dates != previous_dates or changed or old_manifest.get("version") != 1
    manifest = {
        "version": 1,
        "updated_at": datetime.now(BEIJING).isoformat(timespec="seconds") if manifest_changed
                     else old_manifest.get("updated_at"),
        "dates": dict(sorted(dates.items()))
    }
    serialized = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if not LIVE_SCHEDULE_MANIFEST.exists() or LIVE_SCHEDULE_MANIFEST.read_text(encoding="utf-8") != serialized:
        LIVE_SCHEDULE_MANIFEST.write_text(serialized, encoding="utf-8")
        changed = True
    print("Public live schedule snapshots:", len(dates),
          "dates:", ",".join(sorted(dates)),
          "changed:", changed)



def publish():
    ASSETS.mkdir(parents=True, exist_ok=True)
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    old = json.loads(CATALOG.read_text(encoding="utf-8")) if CATALOG.exists() else {}
    by_source = dict(old.get("by_source") or {})
    by_team = dict(old.get("by_team") or {})
    teams = collect_team_names()
    fill_missing_sources(teams)
    source_urls = sorted({url for url in teams.values() if safe_source(url)})

    needed = [url for url in source_urls if
              not asset_is_valid(ROOT / by_source.get(url, "nonexistent"))]
    print("Fixture/archived teams:", len(teams),
          "remote unique logos:", len(source_urls),
          "logos to archive:", len(needed))

    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs = {pool.submit(download_immutable_logo, url): url for url in needed}
        for future in as_completed(jobs):
            local = future.result()
            if local:
                by_source[jobs[future]] = local

    for name, source in teams.items():
        existing = by_team.get(name)
        if existing and asset_is_valid(ROOT / existing):
            continue  # First confirmed team crest is permanent.
        local = by_source.get(source)
        if local and asset_is_valid(ROOT / local):
            by_team[name] = local

    data = {"version": 1, "by_source": dict(sorted(by_source.items())),
            "by_team": dict(sorted(by_team.items()))}
    compact = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    new_json = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    new_js = "window.QC_TEAM_LOGO_CATALOG=" + compact + ";\n"
    if not CATALOG.exists() or CATALOG.read_text(encoding="utf-8") != new_json:
        CATALOG.write_text(new_json, encoding="utf-8")
    if not CATALOG_JS.exists() or CATALOG_JS.read_text(encoding="utf-8") != new_js:
        CATALOG_JS.write_text(new_js, encoding="utf-8")
    publish_live_schedules(by_team)
    print("LOCAL static team crests mapped:", len(by_team),
          "sources:", len(by_source), "unresolved:", len(teams) - len([
              name for name in teams if name in by_team]))


if __name__ == "__main__":
    if "--self-test" in __import__("sys").argv:
        static_odds_self_test()
        static_crest_self_test()
        static_additive_fixture_self_test()
    elif "--audit" in __import__("sys").argv:
        audit_published_live_crests()
    else:
        publish()
