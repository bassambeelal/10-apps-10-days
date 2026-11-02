# Day 10: Letter Sorter

**Platform:** Android 8.0+ with Google Play services (Kotlin, Jetpack Compose, Material 3, ML Kit)
**Build it:** `gradlew assembleRelease` inside `app/` (APK about 1.6 MB)

## The problem

- **Who has it:** people who avoid opening letters and bills, often people with ADHD. Unopened post turns into late fees and cut-off notices.
- **Proof it's real:** [ADDitude](https://www.additudemag.com/adhd-debt-unpaid-bills/), [ADDA](https://www.add.org/adhd-tax/), [a first-hand comment](https://lemmy.world/comment/24970283).
- **Fitted to Nigeria (from the plan's check):** paper post matters less in Nigeria than in the UK or US, so the app takes **screenshots** too: DisCo bills, school fees notices, bank letters, emails. You can share a screenshot straight into it.

## What it does

- **Read one letter at a time:** photograph it, pick a screenshot, or share an image to Letter Sorter.
- **On-device text recognition** (ML Kit) reads it. The photo is deleted straight after.
- **One calm answer:**
  - **Do this by Thu 12 Nov**, with the amount (₦, NGN, N, £, $, €);
  - **File it** (receipts, statements, confirmations);
  - **Bin it** (adverts);
  - **Have a look**, when nothing is clear.
- **Its reasons**, plus the exact lines that decided it.
- **Override:** if it's wrong, choose the pile yourself in one tap.
- **"Do this" letters** go on a to-do list sorted by due date. Two days or less, or late, shows in red.
- **The day's count:** "Today you sorted 6 letters. 2 to do, 3 filed, 1 binned. That's the hard part done."

## How it decides

The rules are plain Kotlin in `LetterReader.kt`, with no AI, and are covered by unit tests.

- **Urgent words** make it "do this": final notice, overdue, disconnection, arrears, court, summons, quit notice, amount due, pay by, due date, and more.
- **Record words** make it "file it": receipt, statement, payment received, confirmation.
- **Advert words** make it "bin it": special offer, promo, discount, unsubscribe, pre-approved.
- **Dates are read day-first** (12/11/2026 is 12 November). A date only counts as a deadline when it comes right after "due", "pay by", "on or before" and similar. That way a receipt's payment date isn't mistaken for a deadline (a unit test caught exactly this).
- **The amount** is the one next to "total", "balance", "amount due" or "pay", otherwise the largest.

## Size

- **The bundled ML Kit model made the APK 44 MB.** It now uses the Play services copy of the same model (`play-services-mlkit-text-recognition`), fetched once at install, which brings the APK to 1.6 MB.
- **The trade-off:** it needs Google Play services, which most Android phones in Nigeria have.

## Tested

- **Unit tests:** 7 tests on real-looking text:
  - an Ikeja Electric final notice (act by 12 Nov, ₦48,350.75, sender read);
  - a UK council tax letter with a written date and pounds;
  - a GTBank receipt (filed);
  - an advert (binned);
  - a vague letter (have a look);
  - day-first and impossible dates;
  - an overdue statement with an old date (act, with no fake due date).
- **Not run on a phone yet** (see Day 2). OCR quality on a real crumpled bill is the thing to film.
