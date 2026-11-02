# Day 3: Lender Check

**Platform:** Web (installable PWA, works offline)
**Run it:** open `app/index.html` in a browser, or serve the `app/` folder. `?q=kashout` opens with a search already typed.
**Refresh the register:** `node scripts/refresh.mjs` (Node 18+, no dependencies)

## The problem

- **Who has it:** people about to borrow from a quick-loan app in Nigeria.
- **What it costs them:** they can't tell a licensed lender from a predatory one until they're being shamed to their contacts. The FCCPC publishes its register, but as five long paginated tables that are hard to search on a phone.
- **Proof it's real:** [Rest of World](https://restofworld.org/2022/nigeria-loan-apps-reputation/), [ICIR](https://www.icirnigeria.org/inside-story-illegal-loan-apps-victims-form-groups-to-seek-retribution-vow-not-to-repay/), [legit.ng](https://www.legit.ng/business-economy/money/1716661-fccpc-denies-approving-48-digital-loan-applications/).

## What it does

- Type an app's name, or the company behind it. Fuzzy matching handles spacing, capitals and small typos ("Kash out" finds Kashout).
- The answer is the FCCPC list it's on: **approved**, **conditional approval**, **licensed by the CBN** (waiver), **on the watchlist** or **delisted**. It also quotes the exact line from the register as evidence.
- **Not on the register:** says so plainly, and lists what to do (check the spelling, search the company, don't grant contacts access).
- **On more than one list:** a warning. EasyNaira, for example, is on the approved list, the watchlist and the delisted list.
- Tells you to match the company against the developer name on the app's Play Store page, because copycat apps borrow approved names.
- Browse the whole register by list.

## The data

- `app/data/lenders.js` is a copy of the [FCCPC's register of digital money lenders](https://fccpc.gov.ng/registration-of-digital-money-lenders/approvals-of-dmls/), taken on 2 November 2026: 525 approved, 35 conditional, 112 on the watchlist, 54 delisted and 33 waivers. The counts match the page.
- `scripts/refresh.mjs` downloads the page again, reads the five tables, and refuses to write if it finds fewer than 100 entries (in case the page layout changes).
- The copy date is shown at the top of the app and under the register.

## Limits

- **It's only as current as the last refresh.** The FCCPC's own page is the final word, and the app links to it.
- **It doesn't scan your phone or check the Play Store itself.** It tells you how to check the developer name.
- **Not legal advice, and not run by the FCCPC.** The app says this at the bottom of the page.

## How it's built

- Plain HTML, CSS and JavaScript. The register loads as a script, so the app works from a file and offline.
- The design comes from the **design-taste-frontend** skill (app-screen rules): the *achromatic-ledger* style (seed 1032484889). There's no sidebar, since the tool has one job. Its look is a blue-grey ledger background, with the register's own line, in Geist Mono, as the signature element. Colour appears only on the verdict.
- The inspector passes with 0 FAIL and 0 WARN at 1440, 768 and 390 px, for three cases: one result, a name on three lists, and no result.
