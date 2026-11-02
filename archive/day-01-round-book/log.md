# Day 1 log: Round Book

Notes from the build, 2 November 2026.

- Picked the style with the design skill's draw: it dealt *achromatic-ledger* and *pastel-consumer*. Chose pastel-consumer because members check this on their phones and the main objects are people, so each member gets their own pale tint.
- Screen question: "Who has paid this round, and whose turn is it?" Signature element: the card, a members × rounds grid like the paper card ajo collectors keep.
- No server: the share link carries a compressed copy of the book in the `#view=` fragment. A 3-member book with one payment makes a link of about 400 characters.
- First inspector run: 0 FAIL, 2 WARN. Cards in a row ended at different heights, and only 2 of 5 blocks were on the first screen.
- Fix: stacked "Where the money is" and "Turns" beside the round, and moved the latest entries to the Entries page. The "their turn" mark was rendering as a tall bar because it shared the `.turn` class with the turns list; renamed it.
- Second run: one card had a 94 px blank band. Matched the number of turn rows to the number of members still owing. Third run: 0 FAIL, 0 WARN.
- Clicked through in a real browser: start a circle, record a payment, a duplicate reference is refused, share, open the link (read-only, no Record buttons), entries, settings. All worked.

## Still to do with a real person

- Hand it to a real treasurer and film the first payment they record.
- Ask a member to open the shared link on their own phone.
