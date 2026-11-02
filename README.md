# 10 Apps in 10 Days

Ten small apps, Android and web, each one solving a real problem that real people complain about. Every app does one job, works offline where it can, and ships the same day.

The plan, the evidence behind each problem and the ideas that were killed are in [PLAN.md](PLAN.md). The raw research is in [research/](research/).

On 2 November 2026 the owner reviewed the first builds: five were rebuilt to a shipped standard and five Nigeria-only apps are being replaced with problems people have everywhere. The new slate is in [NEXT.md](NEXT.md), and the replaced apps are kept in [archive/](archive/).

| Day | App | Platform | Problem | Folder |
|---|---|---|---|---|
| 1 | Fair Split | Web | Housemates and trip groups can't see how a shared balance was reached, and free tiers cap them mid-trip | [day-01-fair-split](day-01-fair-split/) |
| 2 | Light Log | Android | Outage schedules don't match reality and nobody keeps a record | [day-02-light-log](day-02-light-log/) |
| 3 | Citation Check | Web | AI tools invent references, and nobody can quickly prove a citation doesn't exist | [day-03-citation-check](day-03-citation-check/) |
| 4 | Voice Note Reader | Android | Reading a voice note without playing it aloud | [day-04-voice-note-reader](day-04-voice-note-reader/) |
| 5 | Hidden Text Finder | Web | Applicants hide white, tiny and off-page text and AI instructions in CVs, and employers can't see it | [day-05-hidden-text-finder](day-05-hidden-text-finder/) |
| 6 | Proof Pack | Android | Damage claims you can't disprove at return | [day-06-proof-pack](day-06-proof-pack/) |
| 7 | QR Check | Web | Printed QR codes held hostage by the generator | [day-07-qr-check](day-07-qr-check/) |
| 8 | Keep My Number | Android | Prepaid numbers lapse and get recycled with your bank OTPs | [day-08-keep-my-number](day-08-keep-my-number/) |
| 9 | Memories Fixer | Web | Snapchat exports lose dates and locations | [day-09-memories-fixer](day-09-memories-fixer/) |
| 10 | Letter Sorter | Android | Unopened letters turn into fees | [day-10-letter-sorter](day-10-letter-sorter/) |

## Where each app stands

| Day | Built | Checked | Not yet checked |
|---|---|---|---|
| 1 Fair Split | Web PWA | 10 unit tests; full flow at 390 and 1440 px, light and dark, including join and merge across two browsers; offline reload; inspector 0 FAIL on every screen | A real flat or trip group for a week |
| 2 Light Log | APK 1.2 MB | 8 unit tests | A real phone on a real charger |
| 3 Citation Check | Web PWA | 5 Node tests; sample list of 8 checked in Chromium against fixture responses (all 8 right) | The live Crossref and OpenAlex calls from a normal browser (blocked from the build machine) |
| 4 Voice Note Reader | APK 1.1 MB | 5 unit tests | A real Android 13+ phone, and WhatsApp's own transcripts |
| 5 Hidden Text Finder | Web PWA | Browser test of 18 checks on 9 PDF and Word files (every trick found, clean and designed CVs not flagged); inspector 0 FAIL on every screen | A folder of real CVs from a small employer |
| 6 Proof Pack | APK 1.3 MB | 4 unit tests | A real walkaround and PDF |
| 7 QR Check | Web PWA | Rebuilt as an app: 6 unit tests (every code kind round-trips, any language); make, download, upload, save and camera tested in Chromium; offline reload | Real menus and flyers |
| 8 Keep My Number | APK 1.3 MB | 4 unit tests on the NCC day boundaries | Someone's real SIM drawer |
| 9 Memories Fixer | Web PWA | Local time from each memory's place (nearest of 7,260 cities); 5 engine tests; end-to-end on a two-ZIP made-up export with every output file checked; offline fixed | A real Snapchat export |
| 10 Letter Sorter | APK 1.6 MB | 7 unit tests | OCR on a real folded bill |

None of the Android apps has run on a device yet: the emulator on the build machine wouldn't accept input and kept crashing. Each day's `README.md` lists its limits honestly.

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
