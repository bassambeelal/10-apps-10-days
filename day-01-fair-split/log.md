# Day 1 log: Fair Split

Notes from the build, 2 November 2026. This replaces Round Book, which only helped Nigerian savings circles.

## Before building

- **Re-checked the evidence:** April 2026 Trustpilot reviews of Splitwise still complain about the free cap of three a day and the 10-second countdown.
- **The rivals:**
  - Spliit is free and open source with no account, but runs on a server and needs a connection.
  - Tricount says it's free with no limits, but reviewers report having to install the app, and balances they couldn't check.
- **The edge decided:** trust and ownership, not features. Every balance shows its working, nothing changes silently, there's no server, and the settle-up list is truly the fewest payments.

## Design

- **The style:** the design skill's app draw dealt *pastel-consumer* and *achromatic-ledger*. I chose achromatic-ledger: the product's promise is a ledger you can trust, and Round Book had used pastel-consumer.
- **The screen's question:** "Who owes whom, and how do we settle?" The biggest figure is your own balance, beside the action it needs.
- **The face:** a blue-grey ground, with the one hue on the balance bars.
- **The signature element:** each balance opens into its working, line by line, ending on the sum written out.

## Building

- **The core first:** `core.js` has no DOM, with tests.
  - **The log:** an append-only event log. Corrections are new versions, and removals are versions marked removed.
  - **Merging:** a union of events, so it's order-free.
  - **Money:** whole cents, split by largest remainder, with the odd cent placed by a hash of the entry so it doesn't always land on the same person.
- **Settle-up:**
  - The fewest payments is n minus the most groups whose balances sum to zero. A subset search finds that exactly up to 16 people.
  - A test compares it with brute force on 300 random books.
  - The case {+6, +4, −4, −3, −3} needs 3 payments, where greedy pairing makes 4.
- **The link:** events are packed into arrays and compressed. The sample book of 21 events is 1,028 characters.

## What the screenshots caught

- **The welcome page's working was a mess.** It had six cells in a five-column grid. Fixed the grid, and added a container query so any narrow working (a phone, a side card) becomes two lines per entry.
- **"null" in the send sheet.** `replaceChildren` prints `null` as text. Added a `fill()` helper that skips it, and used it everywhere.
- **The expense sheet was wider than a phone.** The amount input's natural width stretched its grid column. Fields now use `minmax(0, 1fr)`.
- **The exchange-rate row showed for a same-currency expense.** `display: flex` beat the `hidden` attribute, and the shares steppers had the same bug. Added a global `[hidden]` rule.
- **The working said "you paid" about other people.** Fixed the wording.
- **The two Overview columns ended 56 px apart.** The Recent list now shows as many rows (three to eight) as make them end level. Inspector: 0 WARN.
- **Settle up was thin.** A third of the screen was empty and the answer had no evidence. Added "The balances behind it" (paid, share, payments, balance) and a worked example from the book's own numbers.
  - That table first folded payments into "Share", so Ines showed €200.21 there and €170.21 everywhere else. It now has its own Payments column, so the arithmetic reads straight across.
  - On a phone the table becomes two-line rows.
- **The tablet top bar wrapped "Fair Split" and "Settle up".** The wordmark now hides below 1024 px, and links don't wrap.
- **The phone tab bar's first label sat 13 px from the edge.** Added side padding.

## Checks at the end

- **Unit tests:** 10 of 10 pass.
- **Browser runs:**
  - the full flow at 390 and 1440 px, light and dark, with no console errors
  - joining from a link in a fresh browser, adding an expense and sending it back: it merged
  - offline reload works with the service worker
  - opening from the file system works
- **Lint:** 0 FAIL. Two WARN, both defensible: zero-padding in the ISO date builder, and em dashes as missing-value marks.
- **Inspector:** 0 FAIL on every screen. Two WARN, both defensible:
  - Settle up's desktop screen ends early because the page is short.
  - Expenses is a full list beside a sticky summary rail.

## Still to do with a real person

- Hand it to a real flat or trip group for a week and watch the first update go round the group chat. Does everyone open the link, or do some only read the message?
- Check how WhatsApp, Telegram and iMessage handle a link from a busy book (several KB) on a real phone.
- Ask someone who left Splitwise whether the working answers "how did we get here?" without help.
- Try installing it on Android and sharing a message into the installed app.
