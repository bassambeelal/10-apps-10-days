# Day 5 log: Refund Clock

Notes from the build, 2 November 2026.

- Researched the rules first, as the plan said:
  - The CBN letter PSM/DIR/CON/CWO/07/127 (29 May 2020) sets 24 hours (own-bank ATM, manual reversal) and 48 hours (other-bank ATM, POS, web).
  - Press reports disagree (one says 72 hours for POS, one says 4 hours for ATMs). I used the letter's own text.
  - The CBN complaints guide sets "bank first, allow 2 weeks, then cpd@cbn.gov.ng".
- Couldn't confirm a CBN deadline for failed transfers, so the app shows no clock for them rather than inventing one.
- One function, `clock()`, decides every date and the next step, so the title, the clock, the ladder and the list can't disagree.
- Inspector:
  - The stone frame was flagged as cream (a banned palette), so I moved it to a cooler grey-green.
  - The case list left a big empty area, so I added a "CBN's refund deadlines" reference card beside it.
  - Case view: 0 FAIL, 0 WARN.

## Still to do with a real person

- Find someone with a stuck POS debit or ATM error, enter their case on camera, and send the generated complaint.
- Follow up on screen when the bank replies, or doesn't.
