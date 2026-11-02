# Day 5: Refund Clock

**Platform:** Web (installable PWA, works offline)
**Run it:** open `app/index.html`, or serve the `app/` folder. `?sample` loads three made-up cases.

## The problem

- **Who has it:** anyone debited for an ATM withdrawal, POS payment, online payment or transfer that failed.
- **What it costs them:** people wait for days without knowing the bank has a legal deadline, or who to go to when it's ignored.
- **Proof it's real:** [NAN News](https://nannews.ng/failed-transactions-banks-customers-decry-delay-tedious-process-of-money-reversal/), [Arise TV](https://www.arise.tv/nigerian-lawmakers-urge-cbn-to-direct-banks-on-prompt-reversal-of-failed-transactions/), [Opinion Nigeria](https://www.opinionnigeria.com/%e2%82%a6630000-transfer-business-accuses-access-bank-of-defying-kwara-court-order/).

## The rules it uses

Every deadline in the app comes from one of two CBN sources, and the app cites them:

| Channel | Refund deadline | Source |
|---|---|---|
| ATM, your own bank | Instant; manual reversal within **24 hours** | CBN letter PSM/DIR/CON/CWO/07/127, 29 May 2020, in force from 8 June 2020 |
| ATM, another bank | Within **48 hours** | Same letter |
| POS payment | Within **48 hours** | Same letter |
| Online card payment | Within **48 hours** | Same letter |
| Bank transfer | **Not confirmed.** The app shows no clock, and says so. | — |

- **If the deadline passes:** complain to the bank first and allow **2 weeks**. If it's still not resolved, escalate to the CBN's Consumer Protection Department at **cpd@cbn.gov.ng**, or by letter to the Director, Consumer Protection Department, CBN, Central Business District, Abuja. Source: [CBN complaints guide](https://www.cbn.gov.ng/supervision/cpdcomgt.html).
- **The CBN letter template** follows the CBN's own list of what a complaint must contain: name, address, phone and email, bank, account (no PIN or password), transaction date, amount claimed, documents, and proof you complained to the bank first.

## What it does

- **New case:** how you paid, amount, when you were debited, your bank, and optionally the last 4 digits of the account and where it happened.
- **Refund clock:** "1 day 3 h overdue" or "18 h left", the due time, and the rule it comes from.
- **The ladder:** debited, refund due, complain to the bank, the bank's two weeks end, escalate to the CBN, with a live "now" line.
- **What to send:** a ready-written complaint to the bank and a ready-written escalation to the CBN (copy, share, or open in your email).
- **Tracking:** mark "I've complained" (add the tracking number) and "The money is back". The case list shows what's still owed.

## Limits

- **Not legal advice.** The rules are from 2020, and I found no later change, but the CBN can change them. The source is linked so you can check.
- **Transfers have no clock** until a CBN timeline is confirmed.
- **Cases stay in this browser.** Nothing is sent anywhere.

## How it's built

- Plain HTML, CSS and JavaScript, offline-capable.
- The design comes from the **design-taste-frontend** skill (app-screen rules): the *framed-sheet* style (seed 1191690911) in IBM Plex Sans. Its look is a grey-green frame around a white sheet (the first stone frame was flagged as cream, so it moved to a cooler grey). Its signature element is the ladder.
- **Inspector:** the case view passes with 0 FAIL and 0 WARN. The list view keeps one WARN: empty space under a three-case list, which is just the end of the page.
