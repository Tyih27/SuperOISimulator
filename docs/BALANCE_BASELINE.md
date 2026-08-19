# Campaign Balance Baseline

The balance gate simulates every three-student combination from the six starter students, every one of the six A1/A2/A3 permutations for each combination, and seeds `1, 2, 3, 4, 5`. Each level therefore has 600 deterministic battles.

| Level | Approved win rate | Seeds | Review threshold |
| --- | ---: | --- | --- |
| `chapter-1-1` | 0.00% | 1, 2, 3, 4, 5 | 10 percentage points |
| `chapter-1-2` | 5.83% | 1, 2, 3, 4, 5 | 10 percentage points |
| `chapter-1-3` | 0.00% | 1, 2, 3, 4, 5 | 10 percentage points |
| `chapter-1-4` | 0.00% | 1, 2, 3, 4, 5 | 10 percentage points |

Run `npm run simulate:balance` to write JSON and CSV reports under `reports/`. `npm test` reruns the same simulations and fails when a level's aggregate win rate moves by more than 10 percentage points from the approved value in `src/data.js`. When a content change intentionally crosses that threshold, review the reports and update this document and `BALANCE_BASELINES` in the same change.
