# V2.0 Two-Leg Return Floor

Status: shadow research only; not deployed.

User requirement:
- Two distinct fixtures only (2串1).
- Total simulated stake per portfolio: 1000 points.
- Minimum payout on every winning branch: 1800 points.
- Single-selection direction picks: each single's odds must be at least 2.00.
- Equal stake across all expanded lines.
- If the minimum return condition fails, abstain. Do not lower the threshold to force a pick.

Formula:
- Number of lines N = selection count in leg A × selection count in leg B.
- Stake per line = 1000 / N.
- Minimum combined odds across every possible winning branch must be at least 1.8 × N.
- Minimum payout = (1000 / N) × (lowest odds in A × lowest odds in B); require minimum payout >= 1800.

Examples:
| Structure | Lines | Stake per line | Required lowest combined odds |
|---|---:|---:|---:|
| Single × single | 1 | 1000 | 1.80 |
| Single × double | 2 | 500 | 3.60 |
| Double × double | 4 | 250 | 7.20 |
| 2 goals × 2 goals | 4 | 250 | 7.20 |
| 2 scores × 2 scores | 4 | 250 | 7.20 |
| 3 scores × 3 scores | 9 | 111.11 | 16.20 |

This is a payout floor, not a profitability guarantee. Expected value remains research-only until probabilities are calibrated and prospectively validated. Half/full-time must be rejected when reliable pre-match half-time rate evidence is absent.

Current code:
- `engine.cjs`: builds only two-leg candidates and applies the floor to every winning branch.
- `engine.test.cjs`: ten test cases for cutoff, result isolation, line accounting and payout floor.
- A separate execution of seven checks passed 7/7.
- Production site and football main model are unchanged; do not merge this branch before user approval.
