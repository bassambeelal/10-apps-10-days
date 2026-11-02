# Day 1: Round Book

**Platform:** Web (installable PWA, works offline)
**Run it:** open `app/index.html` in a browser, or serve the `app/` folder. Add `?sample` to the address to see a filled-in sample circle.

## The problem

- **Who has it:** members and treasurers of rotating savings circles (ajo, esusu, adashe, chama, susu).
- **What it costs them:** the whole record lives in one person's notebook or memory. Members can't check who has paid, whose turn is next, or where the money went, and people lose savings when a collector disappears or a record goes missing.
- **Proof it's real:** [legit.ng](https://www.legit.ng/people/1718360-lady-shares-experience-saving-money-ajo-collector-what-happened-6-months/), [zikoko](https://www.zikoko.com/?p=260498), [VICE](https://www.vice.com/en/article/sidra-humaid-committee-scam-pakistan/), [biznakenya](https://biznakenya.com/?p=120719). More in [PLAN.md](../../PLAN.md).

## What it does

- The treasurer sets up the circle: name, amount, how often, start date, and members in payout order.
- **Record payment:** member, round, amount, date, how (transfer, cash, POS) and the bank reference. A reference that's already in the book is refused, so the same alert can't be counted twice.
- **Pay out:** records the round's payout to whoever's turn it is, with a warning if the pot is short.
- **The book:** this round's pot and who still owes, the turns, where the money is now (held by the treasurer = paid in − paid out), and **the card**, a members × rounds grid like the paper ajo card.
- **Share with members:** a link that opens a read-only copy of the book, plus a ready-made WhatsApp message with who has paid and who still owes.
- **Backup:** save the book to a file and restore it on another phone.

## What it doesn't do (on purpose)

- It never holds or moves money. It's a record, not a wallet.
- No accounts and no server. The book lives on the treasurer's phone, and a shared link is a snapshot from the moment it was sent. Send a new link after new payments.
- Only the rotating kind of circle: everyone pays the same amount each round and one member collects the whole pot. It doesn't handle a daily collector who keeps a fee.

## How it's built

- Plain HTML, CSS and JavaScript, with no build step and no dependencies.
- The share link carries the whole book inside the `#view=` part of the address, compressed with the browser's `CompressionStream`. That part of a link is never sent to a server.
- A service worker keeps the app usable offline after the first visit.
- The design comes from the **design-taste-frontend** skill (app-screen rules): the *pastel-consumer* style (seed 1694003356), with Manrope figures, a pale tint per member, and colour only on the data. The skill's lint and browser inspector both pass with 0 FAIL and 0 WARN at 1440, 768 and 390 px.

## Hosting

The share link needs the app to be online. Two free options:

- **GitHub Pages:** turn on Pages for this repo; the app is then at `https://<user>.github.io/<repo>/day-01-round-book/app/`.
- **Cloudflare Pages:** point it at the `day-01-round-book/app` folder.

## Sample data

`?sample` loads *Balogun Market Ajo*: ten made-up members, ₦20,000 a week, in round 5 with four members still owing. The names, amounts and references are invented, and the app labels the sample as such.
