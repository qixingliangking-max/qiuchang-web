#!/usr/bin/env python3
"""Freeze each confirmed FT into the current day's PUBLIC fixed schedule once.

Read-only Supabase client. Edits only GitHub-owned static public fixture/status
files and manifest; never changes matches, FINAL, predictions, odds or RLS.
This task is intentionally separate from the heavy team-crest collector.
"""
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

from cache_static_team_logos import ROOT, LIVE_SCHEDULE_MANIFEST, public_request

BEIJING = timezone(timedelta(hours=8))
LIVE_DIR = ROOT / "data" / "overview" / "live"
SCORE_RE = re.compile(r"^\d{1,2}[:-]\d{1,2}$")
DONE_RE = re.compile(r"已结束|完赛|已完成|finished|final", re.IGNORECASE)


def final_score(row):
    if not isinstance(row, dict):
        return None
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    status = str(row.get("match_status") or "") + " " + str(raw.get("matchStatusName") or "")
    ft = str(raw.get("sectionsNo999") or "").strip()
    ht = str(raw.get("sectionsNo1") or "").strip()
    if not DONE_RE.search(status) or not SCORE_RE.fullmatch(ft):
        return None
    # Avoid publishing a partially settled archive record: full and half
    # scores must both be recovered before the final snapshot is frozen.
    if not SCORE_RE.fullmatch(ht):
        return None
    return ft, ht


def settlement_updates(current, official):
    """Only replace status and FT/HT of newly finished fixtures, exactly once."""
    if not isinstance(current, dict) or not isinstance(official, dict):
        return False
    if str(current.get("id")) != str(official.get("id")):
        return False
    if final_score(current) is not None:
        return False
    result = final_score(official)
    if result is None:
        return False
    ft, ht = result
    old_raw = current.get("raw") if isinstance(current.get("raw"), dict) else {}
    fresh_raw = official.get("raw") or {}
    current["raw"] = {
        **old_raw,
        "matchStatusName": fresh_raw.get("matchStatusName") or "已结束",
        "sectionsNo999": ft,
        "sectionsNo1": ht,
    }
    current["match_status"] = "已结束"
    return True


def official_by_id_for_settlement(fixed_rows, official, reported_count, ds):
    """Official roster may gain *new* fixtures before publisher expands JSON.

    Settle original IDs only. Never copy or silently drop any additional match.
    """
    if not isinstance(official, list) or len(official) != int(reported_count):
        raise RuntimeError("Official public roster count mismatch: " + ds)
    by_id = {str(r.get("id")): r for r in official
             if isinstance(r, dict) and r.get("id")}
    fixed_ids = {str(r.get("id")) for r in fixed_rows}
    if len(by_id) != len(official) or not fixed_ids.issubset(by_id):
        raise RuntimeError("Published fixture identity missing/duplicated: " + ds)
    extras = set(by_id) - fixed_ids
    if extras:
        print("INFO pending additional prekick fixtures: " + ds + " " +
              str(len(extras)) + "; settling existing IDs only")
    return by_id


def run_one(ds, now):
    # Publish confirmed full/half-time scores from ONE immutable fixture day.
    path = LIVE_DIR / (ds + ".json")
    if not path.exists():
        print("No current fixed schedule yet, leaving unchanged:", ds)
        return 0

    fixture = json.loads(path.read_text(encoding="utf-8"))
    rows = fixture.get("rows") or []
    count = int(fixture.get("match_count") or 0)
    if not isinstance(rows, list) or not count or len(rows) != count or fixture.get("business_date") != ds:
        raise RuntimeError("Fixed schedule failed integrity check: " + ds)
    if len({str(r.get("id")) for r in rows}) != count:
        raise RuntimeError("Duplicate fixture IDs: " + ds)

    records = public_request("/rest/v1/jc_overview_schedule_snapshots", {
        "select": "business_date,payload,match_count",
        "business_date": "eq." + ds,
        "limit": "1",
    })
    if not isinstance(records, list) or not records:
        raise RuntimeError("Public score snapshot not available: " + ds)
    entry = records[0]
    official = (entry.get("payload") or {}).get("rows") or []
    by_id = official_by_id_for_settlement(
        rows, official, entry.get("match_count") or 0, ds)

    done = []
    for row in rows:
        official_row = by_id[str(row["id"])]
        # Identities are immutable: never copy an official row wholesale.
        if settlement_updates(row, official_row):
            done.append(str(row.get("match_num") or row["id"]))
    if not done:
        print("No newly confirmed finished fixtures:", ds)
        return 0

    serialized = json.dumps(fixture, ensure_ascii=False, indent=2) + "\n"
    # Version/manifest is written before the action commits both files together.
    compact = json.dumps(fixture, ensure_ascii=False, separators=(",", ":"))
    digest = hashlib.sha256(compact.encode("utf-8")).hexdigest()[:16]
    if not LIVE_SCHEDULE_MANIFEST.is_file():
        raise RuntimeError("Live schedule manifest not published")
    manifest = json.loads(LIVE_SCHEDULE_MANIFEST.read_text(encoding="utf-8"))
    entry_meta = (manifest.get("dates") or {}).get(ds)
    if not entry_meta or entry_meta.get("file") != "data/overview/live/" + ds + ".json":
        raise RuntimeError("Live schedule manifest date missing or has unknown path")
    entry_meta["version"] = digest
    entry_meta["match_count"] = count
    manifest["updated_at"] = now.isoformat(timespec="seconds")
    path.write_text(serialized, encoding="utf-8")
    LIVE_SCHEDULE_MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("New public immutable FT settlements:", ds, len(done), ",".join(done))
    return len(done)


def run():
    now = datetime.now(BEIJING)
    # Football fixtures use a 12:00-next-10:00 business day. Check both the
    # current fixture day and the previous one: matches recovered late after
    # 10:00 BJT must still reach yesterday's immutable static archive.
    current_day = now.date() if now.hour >= 12 else now.date() - timedelta(days=1)
    dates = [current_day, current_day - timedelta(days=1)]
    return sum(run_one(ds.isoformat(), now) for ds in dates)


def self_test():
    old = {
        "id": "fixture-1", "match_status": "2", "home_team_name": "固定主队",
        "raw": {"matchStatusName": "比赛中", "sectionsNo999": "", "sectionsNo1": ""},
        "_homeLogoUrl": "assets/team-logos/fixture.png",
    }
    official = {
        "id": "fixture-1", "match_status": "已结束",
        "home_team_name": "错误新队名",
        "raw": {"matchStatusName": "已结束", "sectionsNo999": "4-0", "sectionsNo1": "0-0"}
    }
    assert not settlement_updates(old, {**official, "match_status": "比赛中", "raw": {**official["raw"], "matchStatusName": "比赛中"}})
    assert settlement_updates(old, official)
    assert old["raw"]["sectionsNo999"] == "4-0" and old["raw"]["sectionsNo1"] == "0-0"
    assert old["home_team_name"] == "固定主队" and old["_homeLogoUrl"] == "assets/team-logos/fixture.png"
    assert not settlement_updates(old, {**official, "raw": {**official["raw"], "sectionsNo999": "5-0"}})
    assert not settlement_updates({"id": "fixture-2", "raw": {}}, official)
    with_addition = official_by_id_for_settlement(
        [old], [official, {**official, "id": "new-fixture-3"}], 2, "2026-10-29")
    assert set(with_addition) == {"fixture-1", "new-fixture-3"}
    assert old["raw"]["sectionsNo999"] == "4-0"
    try:
        official_by_id_for_settlement([old], [official], 2, "2026-10-29")
        raise AssertionError("invalid official count must fail")
    except RuntimeError:
        pass
    try:
        official_by_id_for_settlement([old],
            [{**official, "id": "unrelated"}], 1, "2026-10-29")
        raise AssertionError("missing original fixture must fail")
    except RuntimeError:
        pass
    print("PASS: only existing IDs settle, added fixtures compatible, FT locked")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        run()
