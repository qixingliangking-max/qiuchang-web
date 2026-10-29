"""Offline regression tests: only a complete, independently counted FINAL is public.

All data is synthetic. No network calls or database changes are permitted.
"""
import contextlib
import datetime as dt
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import publish_public_overview_archives as pub


def row(number):
    return {
        "id": "fixture-%03d" % number,
        "business_date": "2026-10-28",
        "match_num": "周三%03d" % number,
        "home_team_name": "主队%d" % number,
        "away_team_name": "客队%d" % number,
        "match_status": "已结束",
        "raw": {"sectionsNo999": "2:1", "sectionsNo1": "1:0",
                "matchStatusName": "已结束"},
        "jc_model_outputs": [{"id": "locked-%d" % number}],
        "jc_market_snapshots": [],
    }


def record(day, n, expected=None, is_final=True):
    rows = [row(i) for i in range(1, n + 1)]
    for r in rows:
        r["business_date"] = day
    return {"business_date": day, "match_count": expected or n,
            "finished_count": n, "is_final": is_final,
            "source": "final_static_history" if is_final else "partial_static_history",
            "generated_at": "2026-10-29T01:00:00Z",
            "payload": {"rows": rows}}


def ids(n):
    return {"fixture-%03d" % i for i in range(1, n + 1)}


class FinalArchiveSafetyTests(unittest.TestCase):
    def test_16_of_17_cannot_publish_even_when_database_claims_final(self):
        ok, reason = pub.check_final_history(
            record("2026-10-28", 16), ids(17))
        self.assertFalse(ok)
        self.assertIn("schedule", reason)

    def test_16_of_17_partial_does_not_publish(self):
        ok, _ = pub.check_final_history(
            record("2026-10-28", 16, expected=17, is_final=False), ids(17))
        self.assertFalse(ok)

    def test_only_complete_17_of_17_passes(self):
        ok, reason = pub.check_final_history(
            record("2026-10-28", 17), ids(17))
        self.assertTrue(ok, reason)

    def test_wrong_ids_but_same_count_are_blocked(self):
        got = record("2026-10-28", 17)
        got["payload"]["rows"][16]["id"] = "fixture-wrong"
        self.assertFalse(pub.check_final_history(got, ids(17))[0])

    def test_missing_half_time_or_model_never_publishes(self):
        for missing in ("ht", "model"):
            with self.subTest(missing=missing):
                r = record("2026-10-28", 17)
                if missing == "ht":
                    r["payload"]["rows"][0]["raw"]["sectionsNo1"] = ""
                else:
                    r["payload"]["rows"][0]["jc_model_outputs"] = []
                self.assertFalse(pub.check_final_history(r, ids(17))[0])

    def test_unavailable_schedule_fails_closed(self):
        self.assertFalse(pub.check_final_history(
            record("2026-10-28", 17), None)[0])

    def test_legacy_final_index_must_match_independent_schedule(self):
        self.assertFalse(pub.archived_final_matches({
            "is_final": True, "match_count": 16, "finished_count": 16,
            "rows": [row(i) for i in range(1, 17)]
        }, ids(17)))

    def test_partial_hidden_then_appended_to_full_final_without_rewriting_existing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data" / "overview"
            data.mkdir(parents=True)
            manifest = data / "manifest.json"
            day = (dt.datetime.now(pub.BEIJING).date() -
                   dt.timedelta(days=1)).isoformat()
            initial = record(day, 16, expected=17, is_final=False)
            frozen = [row(i) for i in range(1, 17)]
            for r in frozen:
                r["business_date"] = day
            # Prior frozen row deliberately differs from live DB. New FINAL
            # must preserve it as it was first written, byte-for-byte logically.
            frozen[0]["jc_model_outputs"][0]["id"] = "original-locked-model"
            partial = {"version": 2, "business_date": day, "is_final": False,
                       "match_count": 16, "finished_count": 16, "rows": frozen}
            partial_file = data / (day + ".history.v2.json")
            partial_bytes = json.dumps(partial, ensure_ascii=False)
            partial_file.write_text(partial_bytes, encoding="utf-8")
            manifest.write_text(json.dumps({
                "version": 2,
                "dates": {day: "data/overview/" + partial_file.name}
            }), encoding="utf-8")
            snapshot = [initial]
            with contextlib.ExitStack() as stack:
                stack.enter_context(mock.patch.object(pub, "ROOT", root))
                stack.enter_context(mock.patch.object(pub, "DATA", data))
                stack.enter_context(mock.patch.object(pub, "MANIFEST", manifest))
                stack.enter_context(mock.patch.object(pub, "public_history",
                    lambda start, before: snapshot))
                stack.enter_context(mock.patch.object(pub, "public_schedule_ids",
                    lambda date: ids(17)))
                stack.enter_context(mock.patch.object(pub, "embed_crest_links",
                    lambda rows: None))
                stack.enter_context(mock.patch.dict(os.environ,
                    {"QC_ARCHIVE_RECENT_ONLY": "1"}))

                pub.publish()
                exposed = json.loads(manifest.read_text(encoding="utf-8"))
                self.assertNotIn(day, exposed["dates"])
                self.assertEqual(partial_file.read_text(encoding="utf-8"), partial_bytes)
                self.assertFalse(any(data.glob(day + ".history.v3.json")))

                snapshot[:] = [record(day, 17)]
                pub.publish()
                exposed = json.loads(manifest.read_text(encoding="utf-8"))
                published_path = root / exposed["dates"][day]
                final = json.loads(published_path.read_text(encoding="utf-8"))
                self.assertEqual(final["match_count"], 17)
                self.assertEqual(final["finished_count"], 17)
                self.assertTrue(final["is_final"])
                self.assertEqual(len(final["rows"]), 17)
                self.assertEqual(final["rows"][0]["jc_model_outputs"][0]["id"],
                                 "original-locked-model")
                self.assertEqual(partial_file.read_text(encoding="utf-8"), partial_bytes)

                before = published_path.read_bytes()
                pub.publish()
                self.assertEqual(published_path.read_bytes(), before)
                self.assertEqual(len(list(data.glob(day + ".history.v*.json"))), 2)


if __name__ == "__main__":
    unittest.main()
