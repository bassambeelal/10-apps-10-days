# 10 Apps in 10 Days: the plan

Researched 1–2 November 2026. The raw research is in [`research/`](research/).

## My honest take

The idea is good, and the "real problem" rule is what makes it different. Most "N apps in N days" runs build toys. But that rule is also the hard part, so here is what the research says:

- **In 2026, building is not the impressive part.** With an AI coding agent, anyone can ship an app a day. What people will watch is a real person using the app on the same day. Make that the payoff of every episode. ([research/past-challenges.md](research/past-challenges.md))
- **Expect one survivor, not ten products.** In past challenges (Pieter Levels' 12 startups, Yongfook, Marc Lou), most products died. The win was attention plus one or two apps that lasted. Plan "day 11" now: which app do you keep working on?
- **Nobody has done a real-problem app every day.** The past runs I found gave each product about a month. One day per real problem is new, and it's risky. That's fine, but keep each app to **one job**.
- **Your local advantage is the story.** Your timezone suggests Nigeria (an assumption). The strongest problems the research found are local: ajo/esusu, power cuts, loan apps, failed transfers, recycled SIMs. Apps from rich countries ignore these, and you can put the app in a real person's hands the same day. Don't hide that to look "global".
- **Google Play will not happen inside the 10 days.** A new personal Play account needs 12 testers opted in for 14 days in a row, then a review of up to about 7 days. Ship Android apps as an APK (GitHub Releases or Firebase App Distribution), and web apps as PWAs. Say this on camera; it's a real part of the story. ([research/platform-constraints.md](research/platform-constraints.md))

## Rules that come from the research

1. One job per app. If it needs a login, a server, or other people to join before it's useful, cut it down until it doesn't.
2. Don't use SMS access, notification listener or Accessibility permissions. Play restricts them, and Play Protect blocks sideloaded apps that declare them in some countries.
3. Never ship an AI API key inside an APK. Don't send people's personal data to free AI tiers (their terms allow training and human review). Prefer no AI, or on-device ML Kit.
4. Android: target SDK 36 from day one.
5. Web: Cloudflare Pages (plus Workers and D1 if needed) is the safest free base. Vercel Hobby bans commercial use, and Supabase free pauses after a week idle.
6. Every app gets one real person trying it on the day, with their consent to film.

## The slate

✔ = passed all three checks (the pain is real, it's not already solved well, it can be built in a day).
◐ = strong, but the checks didn't finish. Do the 10-minute check listed under it before its day.

| Day | App | Platform | Problem | Status |
|---|---|---|---|---|
| 1 | Round Book | Web (PWA) | Ajo/esusu members can't see balances, turns or where the money went | ✔ |
| 2 | Light Log | Android | Outage schedules don't match reality, and nobody records what actually happened | ✔ |
| 3 | Lender Check | Web | Borrowers can't tell a licensed loan app from a predatory one | ✔ |
| 4 | Voice Note Reader | Android | Reading a voice note without playing it aloud | ◐ |
| 5 | Refund Clock | Web | Debited but not delivered: no one knows the refund deadline or how to escalate | ✔ |
| 6 | Proof Pack | Android | Rental car AI scanners bill renters for damage they can't disprove | ✔ (weak on competition) |
| 7 | QR Check | Web | Printed QR codes get an ad gate, or stop working until the owner pays | ✔ (weak on competition) |
| 8 | Keep My Number | Android | Prepaid numbers lapse silently, taking bank OTPs and wallets with them | ◐ |
| 9 | Memories Fixer | Web | Snapchat's Memories export loses dates and locations | ◐ (build checked only) |
| 10 | Letter Sorter | Android | People leave post unopened until it turns into fees | ◐ |

That's five web and five Android, alternating so the Android days get a rest in between. The well-checked local ones come first, and the ◐ ones come later, which gives you time to check them.

---

### Day 1: Round Book (web, ✔)

- **For:** ajo/esusu/savings-circle members and treasurers.
- **Problem:** the whole record lives with one person. Members can't check who paid, whose turn it is, or where the money went. People lose savings this way.
- **Sources:** [legit.ng](https://www.legit.ng/people/1718360-lady-shares-experience-saving-money-ajo-collector-what-happened-6-months/), [zikoko](https://www.zikoko.com/?p=260498), [VICE (Pakistan committee scam)](https://www.vice.com/en/article/sidra-humaid-committee-scam-pakistan/), [biznakenya](https://biznakenya.com/?p=120719)
- **What exists:** The SUSU App (iPhone only, takes fees from the pot) and Grouppay. Both want to handle the money.
- **v1:** an offline-first PWA. The treasurer sets members, amount and payout order, then logs each payment with its bank or transfer reference. Members get a read-only link to see the book. No money handling, no member logins, no AI.
- **Out of scope:** collecting money, interest, loans, reminders by SMS.
- **Biggest risk:** the research found no Nigerian complaint about the record itself, only about collectors running off. Frame it as "a book everyone can see".
- **Real person:** a market ajo collector, or a friend group's treasurer.
- **Hook:** "My aunty lost six months of ajo. Here's the app that would have shown it."

### Day 2: Light Log (Android, ✔)

- **For:** anyone with unreliable grid power.
- **Problem:** published outage schedules don't match what actually happens, and nobody has a record to complain with.
- **Sources:** [Zambian Observer](https://zambianobserver.com/government-frustrated-by-zescos-failure-to-follow-load-management-schedule/?amp=1), [Devdiscourse (Pakistan)](https://www.devdiscourse.com/article/international/3997885-pakistan-rawalpindi-faces-hours-of-unannounced-frustrating-load-shedding), [Citi Newsroom (Ghana)](https://citinewsroom.com/2024/04/power-outages-affecting-our-businesses-release-dumsor-timetable-guta/), [GridWatch, Berkeley](https://cega.berkeley.edu/collection/gridwatch/)
- **What exists:** iPhone alarm apps that alert you, but none of them keeps a log.
- **v1:** leave a phone on the charger. When power drops it logs an outage, and when power returns it logs the restore time, all offline. It shows hours of light per day and per month and lets you export a report. A foreground service with power connect/disconnect receivers restarts at boot. Ship as a direct APK.
- **Out of scope:** maps, crowdsourcing, accounts.
- **Biggest risk:** battery optimisation killing the service on some phones. Also flicker: merge very short drops.
- **Real person:** you, a neighbour, a shop with a generator.
- **Hook:** "My DisCo says X hours a day. My phone says otherwise." If you're on NERC Band A, check the current minimum hours that band promises and compare against your log. That's a strong episode, but I haven't verified the figure.

### Day 3: Lender Check (web, ✔)

- **For:** people about to take a quick loan from an app.
- **Problem:** borrowers can't tell a licensed lender from a predatory one until they're being shamed to their contacts.
- **Sources:** [Rest of World](https://restofworld.org/2022/nigeria-loan-apps-reputation/), [ICIR](https://www.icirnigeria.org/inside-story-illegal-loan-apps-victims-form-groups-to-seek-retribution-vow-not-to-repay/), [legit.ng (FCCPC)](https://www.legit.ng/business-economy/money/1716661-fccpc-denies-approving-48-digital-loan-applications/), [PaybillKE (Kenya)](https://paybillke.com/news/cbk-licenses-29-more-digital-credit-providers-september-2026)
- **What exists:** a CBK licence checker in Kenya. For Nigeria you'd have to read the FCCPC list by hand.
- **v1:** one page. Type or pick an app name and get a fuzzy match against a dated snapshot of the FCCPC list, showing its status (approved, conditional, delisted or unknown), the source and the date. Include a script to refresh the snapshot. No backend.
- **Out of scope:** reviews, reporting, scanning the phone.
- **Biggest risk:** brand names don't match company names, and the list goes stale. Show the snapshot date big.
- **Real person:** anyone in your circle who's used a loan app.
- **Hook:** "Is this loan app legal? 5 seconds."

### Day 4: Voice Note Reader (Android, ◐)

- **For:** anyone who gets voice notes in a meeting, a church, a bus or a quiet office.
- **Problem:** you can't read a voice note without playing it aloud or uploading it somewhere.
- **Sources:** [whisperIME #99](https://github.com/woheller69/whisperIME/issues/99), [#15](https://github.com/woheller69/whisperIME/issues/15), [#8](https://github.com/woheller69/whisperIME/issues/8)
- **v1:** a share target. Long-press the voice note, tap Share, pick the app, and read the text. Transcription runs on the phone with a small Whisper model (whisper.cpp). Nothing is uploaded.
- **10-minute check before the day:** (1) does WhatsApp's own transcript feature already cover your phone and language? (2) how fast is the tiny model on a cheap phone? (3) how good is it on Nigerian English and Pidgin?
- **Biggest risk:** speed and accuracy on low-end phones, and app size.
- **Hook:** "Read your voice notes in church."

### Day 5: Refund Clock (web, ✔)

- **For:** anyone debited for a transfer or POS payment that never arrived.
- **Problem:** people don't know the refund deadline, or who to escalate to when the bank stalls.
- **Sources:** [NAN News](https://nannews.ng/failed-transactions-banks-customers-decry-delay-tedious-process-of-money-reversal/), [Arise TV](https://www.arise.tv/nigerian-lawmakers-urge-cbn-to-direct-banks-on-prompt-reversal-of-failed-transactions/), [Opinion Nigeria](https://www.opinionnigeria.com/%e2%82%a6630000-transfer-business-accuses-access-bank-of-defying-kwara-court-order/), [RBI rules (India)](https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=11693&Mode=0)
- **What exists:** in-app dispute buttons that give a reference number but no deadline or escalation path.
- **v1:** a static PWA. Enter the bank, channel and date. It shows the deadline with a day counter, then writes the complaint message for each stage (bank first, then the CBN route). Everything stays on the device.
- **Do first:** read the current CBN rules on electronic payment channels and its complaint guide, and cite them in the app. Don't guess the timelines.
- **Biggest risk:** getting a rule wrong. Show the source and date for every deadline.
- **Real person:** anyone with a stuck transfer, which almost everyone has had.
- **Hook:** "The bank owes you a reversal by a date. Here's the countdown."

### Day 6: Proof Pack (Android, ✔, weak on competition)

- **For:** people renting cars, and, if you adapt it, tenants moving in.
- **Problem:** AI damage scanners at rental desks bill renters for damage they can't disprove.
- **Sources:** [WLOX](https://www.wlox.com/2026/06/29/rental-car-ai-scanners-flag-alleged-damage-leaving-customers-with-surprise-bills/), [Consumer Rescue](https://consumerrescue.org/travel-troubles/ai-scanner-mistake-sixt-wrongly-billed-car-repairs/), [ECC Finland](https://www.ecc.fi/en/themes/travelling/car-rental/subsequent-charges), [Frommer's](https://www.frommers.com/tips/car-bus-rail/hertz-is-using-ai-scanners-to-charge-rental-car-damage-that-human-eyes-miss/)
- **What exists:** Snap&Drive and HandProof already do timestamped photos, which is why this scored low on competition.
- **v1:** a forced shot list at pickup and return (plate first, then each panel, wheels, roof, odometer and fuel). Each shot is stamped with time and GPS and the files are hashed. One tap exports a PDF dispute pack.
- **Make it yours:** the evidence is US and EU. In Nigeria the same code fits a tenant's move-in condition record (caution fee disputes). That version wasn't researched, so check it first.
- **Hook:** "The robot says you scratched it. Prove you didn't."

### Day 7: QR Check (web, ✔, weak on competition)

- **For:** small businesses with QR codes printed on menus, flyers and signs.
- **Problem:** codes made with "free" generators later get an ad gate or stop working until the owner pays.
- **Sources:** [Trustpilot reviews of Bitly](https://uk.trustpilot.com/review/bitly.com). More are in `research/raw-candidates.md`.
- **What exists:** good free static-QR generators (FixedQRCode, among others). The gap is the **checker**.
- **v1:** scan or upload a QR code and see where it really goes and who can switch it off. Then make a direct QR, generated in the browser with no middleman.
- **Hook:** "Your restaurant's QR code is a hostage."

### Day 8: Keep My Number (Android, ◐)

- **For:** anyone with a second SIM in a drawer.
- **Problem:** prepaid numbers lapse and get recycled, taking bank OTPs and wallets with them. One reported case lost ₦100,000 this way.
- **Sources:** [ICIR](https://www.icirnigeria.org/regulatory-gaps-on-phone-number-recycling-fuel-data-breaches/), [Mobile ID World](https://mobileidworld.com/nigeria-faces-security-risks-from-phone-number-recycling-as-ncc-implements-new-policies/), [Respicio (Philippines)](https://www.respicio.ph/commentaries/sim-card-expiration-and-recovery-for-filipinos-abroad)
- **v1:** list your SIMs with each one's operator and last activity. A countdown uses an operator rule table, and a checklist records what's tied to each number (banks, wallets, email).
- **10-minute check:** find the current NCC and operator rules on how long before an inactive number is recycled, and what counts as activity. Without those rules there's no app.
- **Hook:** "Your old SIM is someone else's bank login."

### Day 9: Memories Fixer (web, ◐, build checked only)

- **For:** Snapchat users who download their Memories export.
- **Problem:** the export loses dates and locations and splits captions from photos. Snapchat also capped free Memories storage.
- **Sources:** [TechCrunch](https://techcrunch.com/2025/10/03/snapchat-is-planning-to-charge-for-storage-heres-how-to-save-your-memories-for-free), [Trustpilot: fixmyexport](https://at.trustpilot.com/review/fixmyexport.com)
- **v1:** a page where you drop in the ZIP. Everything runs on your device. It writes dates and GPS into each file, merges overlays, and gives back a clean folder.
- **10-minute check:** test against a real export (yours or a friend's), and check the free GitHub scripts that already do this.
- **Hook:** "Five years of photos, all dated today. Fixed, without uploading anything."

### Day 10: Letter Sorter (Android, ◐)

- **For:** people (often with ADHD) who avoid opening letters and bills.
- **Problem:** unopened post turns into fees and cut-off notices.
- **Sources:** [ADDitude](https://www.additudemag.com/adhd-debt-unpaid-bills/), [ADDA](https://www.add.org/adhd-tax/), [Lemmy comment](https://lemmy.world/comment/24970283)
- **v1:** one letter at a time. Take a photo, and on-device text recognition (ML Kit) pulls out dates, amounts and words like "overdue". Each letter becomes "do this by a date", "file it" or "bin it". No AI service is needed.
- **10-minute check:** is post a real thing for your audience? The evidence is UK and US. In Nigeria, the same app on bills, e-receipts and screenshots may fit better.
- **Hook:** "I opened six months of post in ten minutes."

## Reserves

These weren't checked. Check one before using it.

- **Tenant move-in proof:** Proof Pack's code, aimed at caution fee disputes.
- **Call blocker presets:** block unknown callers without regex, using Android's call screening role (not a restricted permission). Loan-app harassment calls are a strong local angle.
- **POS agent float:** POS and mobile money agents run out of float and shut shop to rebalance.
- **Who's in this week:** a headcount for casual football or a group without anyone installing an app. WhatsApp polls may already cover it.

## Tempting ideas that died, and why

These make good content. "Why I didn't build this" is an episode too.

- **Fake payment alerts at the counter.** It's a big problem, but there's no free, legal feed of what actually arrived. Without one, the app can't know the truth.
- **"Where did my data go?"** Android's own settings already show data use per app.
- **Name-calling alerts for Deaf patients.** Phones already offer an alert when your name is spoken.
- **A simple phone for someone with dementia.** Free launchers exist, and a one-day version can't really lock the phone down.
- **Group money collections.** Paying people directly already removes the frozen-money risk.
- **Tutor lesson balances.** Lots of tools already exist, and the pain wasn't clearly shown.

## How to document everything

Keep it small enough to survive day 7.

**Folder per day:**

```
day-01-round-book/
  README.md      ← the one-page template, filled in
  log.md         ← timestamped notes as you go (one line each)
  media/         ← screen recordings, phone clips, screenshots
  app/           ← the code
```

**Capture each day (about 15 minutes of extra effort):**

1. **Morning, 1 minute to camera:** the problem, and who has it.
2. **While building:** OBS recording the screen the whole time. Mark the moments in `log.md` with the time (`14:32 the service got killed by battery saver`).
3. **The real person:** film them trying it (with consent), especially the first confused moment.
4. **Night, 5 lines in `log.md`:** what shipped, what broke, what you cut, what the person said, and one number (time spent, people who tried it).

**Turning it into episodes:** each episode follows problem → the person → the build (sped up, with the 2–3 moments you marked) → the hand-off → the verdict. The `log.md` timestamps are your edit list. Fill [`templates/DAY.md`](templates/DAY.md) the same night, while you still remember.

## Before Day 1

1. **Pick a start date. Don't start tomorrow.** Give yourself a few days to prepare.
2. **Find one real person per app now:** an ajo treasurer, a neighbour with bad light, someone who's used a loan app, someone with a stuck transfer. Get their consent to film.
3. **Do the 10-minute checks** for Days 4, 8, 9 and 10, and swap in a reserve if a check fails.
4. **Build two starter templates:** a web PWA on Cloudflare Pages, and an Android Kotlin/Compose app (targetSdk 36, release signing, publish to GitHub Releases). This saves an hour every day.
5. **Read the rules for Days 3 and 5:** FCCPC's lender list and CBN's failed-transaction and complaint rules.
6. **Optional:** open the $25 Play account now if you want one app on Play later. It needs a non-prepaid card in your legal name, a real phone and verification time, plus the 12-testers-for-14-days rule.
7. **Set up recording:** OBS, a phone stand and a mic. Do a test record.

## How much to trust this

- ✔ means three separate checks passed: real pain, not already solved, buildable in a day. Each check was capped at a few searches, so the checks were quick, not deep.
- ◐ means the checks didn't finish (network drops and usage limits). The ideas and sources are real, but nobody checked whether they're already solved.
- Web search ran out during the first pass, so some sources come from pages read directly. Some evidence is a search snippet only, marked in `research/raw-candidates.md`.
- Nigeria is a guess from your timezone. If you're somewhere else, the local apps need different rules and sources.
