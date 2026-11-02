# What's next (decided 2 November 2026)

The owner tried the first builds. Their verdict:

- **Voice Note Reader:** sharing a voice note did nothing, then the app closed.
- **Letter Sorter:** picking a photo said it couldn't be read, and taking a photo with the camera did nothing.
- **The rest work**, but they're of little use to a global audience.
- **Proof Pack:** useful, but built badly.
- **Overall:** "they look like a hackathon". Every app gets a full day and has to be perfect. See the quality bar in [CLAUDE.md](CLAUDE.md).

## The new slate

Five apps stay and get rebuilt to a shipped standard. Five Nigeria-only apps are replaced with problems people have everywhere. **Before building each replacement, re-check its evidence** (fresh complaints, what already exists, whether a day is enough). The links below come from the first research pass in `research/raw-candidates.md`.

| Day | App | Platform | Status |
|---|---|---|---|
| 1 | **Fair Split** (replaces Round Book) | Web | Built 2 Nov: [day-01-fair-split](day-01-fair-split/) |
| 2 | **Bus Spotter** (replaces Light Log) | Android | New |
| 3 | **Citation Check** (replaces Lender Check) | Web | New |
| 4 | Voice Note Reader | Android | Fix and rebuild |
| 5 | **Hidden Text Finder** (replaces Refund Clock) | Web | Built 2 Nov: [day-05-hidden-text-finder](day-05-hidden-text-finder/) |
| 6 | Proof Pack | Android | Rebuild |
| 7 | QR Check | Web | Rebuilt 2 Nov: three places, offline fixed, UTF-8 fixed |
| 8 | **Dose Buddy** (replaces Keep My Number) | Android | New |
| 9 | Memories Fixer | Web | Polished 2 Nov: local time zones, preview, offline fixed |
| 10 | Letter Sorter | Android | Fix and rebuild |

The old Nigeria apps can move to an `archive/` folder rather than being deleted, since they're part of the series' story.

### The replacements

- **Fair Split (web).**
  - *Problem:* housemates and trip groups stop trusting shared balances and rebuild them in spreadsheets after Splitwise limited its free tier.
  - *Idea:* a shared expense book that needs no account and no daily limits, shared by a link, with the fewest possible payments to settle up.
  - *Evidence:* [Trustpilot: Splitwise](https://www.trustpilot.com/review/splitwise.com).
- **Bus Spotter (Android).**
  - *Problem:* blind and partially sighted people can't read the number of an approaching bus in time to hail it.
  - *Idea:* point the camera down the road. On-device text recognition reads the route numbers it sees and says them aloud. Haptics confirm when the wanted route appears.
  - *Evidence:* [Optometry Today / RNIB](https://www.aop.org.uk/ot/news/2025/05/21/inaccessible-bus-travel-leaving-blind-and-partially-sighted-people-trapped-at-home-says-rnib), [Portsmouth consultation](https://yourcityyoursay.portsmouth.gov.uk/bus-stop-consultation-2024/bus-stops/accompanied-bus-journeys-bus-stop-improvements/), [CBW Magazine](https://cbwmagazine.com/?p=7770).
- **Citation Check (web).**
  - *Problem:* AI tools invent references. Students, librarians, peer reviewers and people representing themselves in court can't easily prove a citation doesn't exist.
  - *Idea:* paste a reference list. Each entry is looked up against open indexes (Crossref, OpenAlex, CourtListener's citation lookup) and marked found, close match or not found.
  - *Evidence:* [Damien Charlotin's AI hallucination cases database](https://www.damiencharlotin.com/hallucinations/), [CourtListener citation lookup API](https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup), [Scientific American](https://www.scientificamerican.com/article/ai-slop-is-spurring-record-requests-for-imaginary-journals/), [GPTZero on NeurIPS](https://gptzero.me/news/neurips/).
- **Hidden Text Finder (web).**
  - *Problem:* job seekers hide white or tiny text in CVs to game AI screeners, and small employers can't see it.
  - *Idea:* drop in a PDF or DOCX, entirely in the browser. It shows hidden, white, off-page and microscopic text, and instructions aimed at AI.
  - *Evidence:* [HR Dive](https://www.hrdive.com/news/job-seekers-say-theyre-still-being-ghosted-even-as-theyre-trying-harder/833774/), [HR Dive trends](https://www.hrdive.com/news/4-trends-explaining-why-recruiters-are-struggling-right-now/873036/).
- **Dose Buddy (Android).**
  - *Problem:* medication reminders outside the US went behind a subscription, including the alert that tells family when a dose is missed.
  - *Idea:* free reminders, plus a missed-dose message to a chosen person by SMS or a share. Reminders only, never medical advice.
  - *Evidence:* [Medisafe help centre](https://help-center.medisafe.com/en/articles/13052285-medisafe-is-now-a-fully-paid-app-for-users-outside-the-u-s), [Trustpilot: Medisafe](https://uk.trustpilot.com/review/medisafe.com).

**Spares if one doesn't hold up:**
- **A spelling finder for dyslexic adults:** [Understood](https://www.understood.org/en/articles/6-surprising-ways-dyslexia-affects-me-as-a-young-adult.md), [Dyslexia Life Hacks](https://dyslexialifehacks.com/?p=25221).
- **"Who's in this week" headcounts for casual groups:** [Trustpilot: Spond](https://www.trustpilot.com/review/spond.com), [Trustpilot: TeamSnap](https://www.trustpilot.com/review/teamsnap.com).

## The two broken apps: likely causes

Neither crash log was captured; the owner's phone wasn't connected. Reproduce first, then fix.

### Letter Sorter

- **Gallery photo "can't be read".** The app uses the Play-services ML Kit model (`play-services-mlkit-text-recognition`), which downloads in the background after install. Until it arrives, `process()` fails with "waiting for the module to be downloaded".
  - *Fix:* either check and install the module with `ModuleInstallClient` and show progress, or use the bundled model (`com.google.mlkit:text-recognition`). If bundled, ship per-ABI APKs to keep the size down; the universal APK was 44 MB.
- **Camera does nothing.** `photo` lives only in memory. If Android kills the activity while the camera app is open (common on cheaper phones), the result comes back with `photo == null` and is ignored. Proof Pack already saves this in `onSaveInstanceState`; Letter Sorter doesn't.
  - *Better fix:* an in-app CameraX capture screen with a document frame.

### Voice Note Reader

- **Share, then nothing, then it closes.** Suspects, in order:
  - the decode on a background thread hitting an exception on WhatsApp's Opus file and killing the process;
  - the on-device recognizer rejecting `EXTRA_AUDIO_SOURCE` or `EXTRA_SEGMENTED_SESSION`;
  - process death during the microphone permission request.
- **Rebuild:** make it robust rather than patching it.
  - Bundle or download a small Whisper model (whisper.cpp through the NDK) so it doesn't depend on each phone's speech service.
  - Keep the system recognizer only as a fallback.
  - Catch every failure into a visible, friendly state.

## Rebuilding each app to the bar

For every app, rebuilt or new:

1. **Re-check the problem's evidence**, and the best existing tool to beat.
2. **Design first:**
   - *Android:* the mobile-android-design skill, Material 3 with real icons (`material-icons-extended`), a splash screen, an adaptive and themed launcher icon, edge-to-edge, and dark mode.
   - *Web:* the design-taste-frontend skill, from the style draw through the inspector.
3. **Build the core flow in-app.** For example, CameraX inside Proof Pack and Letter Sorter, instead of bouncing to the system camera.
4. **Cover every state:** empty, loading, error, permission denied, offline, and a phone killed mid-flow.
5. **Run it:**
   - *Web:* browser screenshots at 390 px and 1440 px, plus the inspector.
   - *Android:* a device or emulator, or Robolectric/Compose tests with Roborazzi screenshots.
   - Look at every screenshot.
6. **Update the docs:** the README, log.md and media/ screenshots.
7. **Publish:** commit and push. Rebuild the APK and update the GitHub release. Update the root `index.html` for web apps.
