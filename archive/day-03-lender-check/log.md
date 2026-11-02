# Day 3 log: Lender Check

Notes from the build, 2 November 2026.

- Found the register on fccpc.gov.ng under "Approvals of DMLs": five tables (approval, conditional approval, watchlist, delisted, waivers for CBN-licensed companies), paginated, and each one repeated on the page.
- Wrote `scripts/refresh.mjs` to read the tables straight from the page's HTML. The first run counted one row too many per list: the table footer repeats the header. Fixed, and the counts now match: 525, 35, 112, 54, 33.
- Finding for the series: **EasyNaira is on the approved list, the watchlist and the delisted list at the same time.** The app warns when a name is on more than one list.
- Matching: names normalised (capitals, punctuation, "app", "limited" dropped), then exact, starts-with, contains, and a small edit distance for typos. "Kash out", "okash" and "fastcredit" (a company) all land on the right line.
- Design inspector, first run: every table row was a full screen tall. The cells used the class `app`, which the skill's base CSS uses for the page shell. Renamed it.
- Then the results and "what the lists mean" cards never matched in height, because results change with every search. Stacked them instead and moved each list's meaning into the register tabs. Three results now sit side by side on desktop. Final run: 0 FAIL, 0 WARN in all three states.

## Still to do with a real person

- Sit with someone who's used a loan app, have them type the apps on their own phone, and film their reaction to the result.
- Re-run the refresh script on the day of filming and show the date on screen.
