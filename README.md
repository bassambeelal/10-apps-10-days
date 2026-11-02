# 10 Apps in 10 Days

Ten small apps, Android and web, each one solving a real problem that real people complain about. Every app does one job, works offline where it can, and ships the same day.

The plan, the evidence behind each problem and the ideas that were killed are in [PLAN.md](PLAN.md). The raw research is in [research/](research/).

| Day | App | Platform | Problem | Folder |
|---|---|---|---|---|
| 1 | Round Book | Web | Ajo/esusu members can't see balances, turns or where the money went | [day-01-round-book](day-01-round-book/) |
| 2 | Light Log | Android | Outage schedules don't match reality and nobody keeps a record | [day-02-light-log](day-02-light-log/) |
| 3 | Lender Check | Web | Borrowers can't tell a licensed loan app from a predatory one | [day-03-lender-check](day-03-lender-check/) |
| 4 | Voice Note Reader | Android | Reading a voice note without playing it aloud | [day-04-voice-note-reader](day-04-voice-note-reader/) |
| 5 | Refund Clock | Web | Debited but not delivered: no one knows the refund deadline | [day-05-refund-clock](day-05-refund-clock/) |
| 6 | Proof Pack | Android | Damage claims you can't disprove at return | [day-06-proof-pack](day-06-proof-pack/) |
| 7 | QR Check | Web | Printed QR codes held hostage by the generator | [day-07-qr-check](day-07-qr-check/) |
| 8 | Keep My Number | Android | Prepaid numbers lapse and get recycled with your bank OTPs | [day-08-keep-my-number](day-08-keep-my-number/) |
| 9 | Memories Fixer | Web | Snapchat exports lose dates and locations | [day-09-memories-fixer](day-09-memories-fixer/) |
| 10 | Letter Sorter | Android | Unopened letters turn into fees | [day-10-letter-sorter](day-10-letter-sorter/) |

## Each day's folder

```
day-NN-name/
  README.md   what it does, who it's for, how to run it
  log.md      notes while building
  media/      screenshots and recordings
  app/        the code
```

Web apps are plain HTML, CSS and JavaScript with no build step: open `app/index.html`, or serve the folder. Android apps are Kotlin and Jetpack Compose: open `app/` in Android Studio, or run `gradlew assembleDebug` inside it.

## Skills used

- [design-taste-frontend](https://github.com/Leonxlnx/taste-skill) for the web apps: the app-screen rules, the style draw and the inspector.
- [mobile-android-design](https://github.com/wshobson/agents) for the Android apps: Material 3 and Compose patterns.
- [apple-design](https://github.com/dickwu/apple-design-skill) for the accessibility and foundations review of each app.

Reinstall them with `npx skills add` from [skills-lock.json](skills-lock.json).
