window.QC_CURATED_V11_COMBO_TEST_CONFIG={
  "version": "QC_CURATED_V1_1_COMBO_TEST_20261019",
  "asOfDate": "2026-10-19",
  "dates": {
    "start": "2026-09-23",
    "end": "2026-10-18"
  },
  "targetSingleLegCoverage": {
    "direction": 0.8,
    "htft": 0.7,
    "goals": 0.7,
    "score": 0.5
  },
  "notes": [
    "Above targets are aspirational single-leg option coverage, NOT claimed historic achievements.",
    "Double 2x1 and score 3x1 must report all-legs hit separately; cannot represent leg hit rate as parlay hit rate.",
    "No historical outcome or settlement fields are available to pre-result selection module.",
    "V1.0 published backtest and Oct19 two published test variants are immutable; do not overwrite them.",
    "Do not select with knowledge of historical results; Sep23-Oct18 replay is diagnostic, not out-of-sample proof.",
    "All four engines may abstain. No minimum daily number of groups. Report eligible days, active days, abstentions and underlying volume."
  ],
  "general": {
    "budgetPoints": 1000,
    "allocation": "equal_per_line_primary",
    "allowAbstain": true,
    "source": "FINAL locked before kickoff and record updated no later than kickoff; official market odds captured before kickoff",
    "benchmarkTypes": [
      "same_day_pair",
      "single_leg_sensitivity"
    ]
  },
  "specialists": {
    "direction": {
      "legs": 2,
      "optionsPerLeg": [
        [
          1,
          1
        ],
        [
          1,
          2
        ],
        [
          2,
          2
        ]
      ],
      "outcomeSources": [
        "had",
        "hhad"
      ],
      "note": "Constrain each leg to selections consistent with frozen model direction or official handicap selections; penalize low combined odds but do not chase high odds for their own sake.",
      "minCandidates": 2
    },
    "htft": {
      "legs": 2,
      "optionsPerLeg": [
        [
          2,
          2
        ]
      ],
      "outcomeSources": [
        "hafu"
      ],
      "note": "Preserve TOP2 per game, validate path and compare 4-line break-even.",
      "minCandidates": 2
    },
    "goals": {
      "legs": 2,
      "optionsPerLeg": [
        [
          2,
          2
        ]
      ],
      "outcomeSources": [
        "ttg"
      ],
      "note": "Each game select two total-goal outcomes from frozen candidates; screen dispersed probability and low/high tail. Four-line combination.",
      "minCandidates": 2
    },
    "score": {
      "legs": 2,
      "optionsPerLeg": [
        [
          3,
          3
        ]
      ],
      "outcomeSources": [
        "crs"
      ],
      "note": "Each game three scores from frozen TOP3. 9 lines. Score selection is independent of direction Gate.",
      "minCandidates": 2
    },
    "scoreThreeLegExperiment": {
      "legs": 3,
      "optionsPerLeg": [
        [
          3,
          3,
          3
        ]
      ],
      "outcomeSources": [
        "crs"
      ],
      "note": "Experimental 3-match / 9 score selections = 27 actual ticket lines, NOT 9. Separate risk and settlement from score two-leg benchmark.",
      "minCandidates": 3,
      "experimental": true
    }
  },
  "metricRequirements": [
    "one_leg_coverage",
    "all_legs_covered",
    "combination_line_count",
    "rejections_and_abstentions",
    "odds_source_timestamp",
    "equal_split_return_points",
    "net_points",
    "max_drawdown",
    "date_level_results",
    "selection_gate_version"
  ],
  "nonProduction": true
};
