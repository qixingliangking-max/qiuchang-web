# P3 Promotion Gate R1

## Principle
The semantic1 frontend is a renderer only. It **must not decide** whether a league/team is P3_VALID.

Promotion flow:

1. **RAW / aggregate candidate**
2. Write candidate snapshot outside the published `p3-data/` set
3. Run **Schema Contract R2**
4. Run **strict row shape**
5. Run **hard gates**
6. Assign quality tier: `STABLE / PILOT_FULL / LIMITED / RAW_ONLY`
7. Only PASS candidates may be promoted into `internal-test/p3-data/`
8. Only promoted snapshots may be added to the semantic1 manifest

## Hard gates
- required P3 blocks present
- exact Korean V5 schema / strict row shape, except declared dynamic maps
- required_slots sum = 11
- normal replacement chain contains no availability_role=OTHER_STARTER; cross-position starters belong only in emergency_shift_options
- players with minutes must have Performance/Role Quality; any player with starts > 0 must have primary position; bench-only players may keep primary position null when no starter-position evidence exists
- UNTESTED cannot have a Performance score
- VALID/PARTIAL depth rows must have replacement/depth metrics
- NULL must never be silently converted to 0
- LOW_SAMPLE/LIMITED remains structurally valid but cannot be promoted as FULL-quality

## Frontend boundary
The page may:
- lazy-load approved static snapshots
- render approved quality tier
- render approved P3_VALID / RAW_ONLY labels

The page may **not**:
- infer P3_VALID from `p3.ok` alone
- run refresh / ingest / aggregate
- convert RAW_ONLY into P3_VALID
- repair missing fields
- fill missing values with 0
- trigger bulk absence simulation

## Current promoted snapshots
- KOR_K1 2026 — STABLE
- USA_MLS 2026 — PILOT_FULL
- NOR_ES 2026 — PILOT_FULL
- UEFA_UNL 2026/27 — LIMITED

JPN_J1 remains RAW_ONLY until V5 aggregation + gate PASS.
