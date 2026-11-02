# Working on this repo

A public build-in-public challenge: 10 apps in 10 days, Android and web, each solving a real problem, documented for a video series. The owner works with Claude Code and may hand work to a cloud session, so everything a session needs is written down here and in [NEXT.md](NEXT.md).

## The quality bar (from the owner, 2 November 2026)

> "All the apps didn't look like apps, they look like a hackathon. I gave you 10 days, a day to perfect each app. Unless it has been perfected, don't compromise."

So:

- **Each app must feel like a shipped product, not a demo.** That means real navigation, onboarding and empty states, designed icons and launcher icons, motion and feedback on every action, dark mode, and copy that reads like a product. A day per app is the budget; use it.
- **Don't call an app done until it has run.** For web, run it in a real browser at phone and desktop widths. For Android, run it on a device or a working emulator, or at least use Robolectric/Compose UI tests plus Roborazzi screenshots. Look at the screenshots and fix what looks off.
- **Fix the cause, not the symptom.** No "known limitation" if a better build is possible inside the day.
- **Audience is global.** The owner rejected apps that only help Nigeria. Pick problems people have everywhere.
- **Keep it lean.** No large multi-agent fan-outs: they burned the owner's usage limits before. Research and build inline.

## Layout

```
day-NN-name/
  README.md   what it does, who it's for, how to run it, what was tested
  log.md      build notes, ending with "Still to do with a real person"
  media/      screenshots
  app/        the code (web: plain HTML/CSS/JS PWA; Android: a single-module Gradle project)
PLAN.md        the original plan and research
NEXT.md        the current direction: what to rebuild, replace and fix
research/      evidence behind every problem
```

## Skills

The design skills are installed under `.agents/` and `.claude/`, which are git-ignored. In a fresh checkout, reinstall them:

```bash
npx skills add https://github.com/wshobson/agents --skill mobile-android-design
npx skills add dickwu/apple-design-skill -a claude-code
npx skills add Leonxlnx/taste-skill
```

- **design-taste-frontend:** use it for every web app. Read `references/app-screens.md` for tool-like apps; deal a style with `scripts/draw.mjs --app`; check with `scripts/lint.mjs` and `scripts/inspect.mjs` (it drops query strings, so serve the folder with a small static server if a URL parameter is needed).
- **mobile-android-design:** use it for every Android app (Material 3, Compose, dynamic colour, 48 dp targets).
- **apple-design:** use it for the accessibility and foundations review.

## Android builds

- **Toolchain:** AGP 9.1.1 (built-in Kotlin), Kotlin Compose plugin 2.2.10, Compose BOM 2026.02.01, Gradle 9.3.1 wrapper, compileSdk/targetSdk 36, minSdk 26, JDK 17+ (21 works).
- **Project shape:** each app is a single-module project: `settings.gradle.kts`, `build.gradle.kts` with the android plugin at the root, sources under `app/src/main`. Copy the wrapper from an existing day.
- **Releases:** R8 shrinking is on (APKs are about 1 to 2 MB). Release builds are signed with the debug key so they install from GitHub Releases. Publish APKs with `gh release create`.
- **Emulator on the owner's PC:** the Android 37 Pixel_7 image there is unusable (no input viewport, system services crash). Use a device, a different system image, or JVM UI tests.

## Web

- **Hosting:** GitHub Pages serves `main` at https://bassambeelal.github.io/10-apps-10-days/, and each app is at `/day-NN-name/app/`. `.nojekyll` keeps folders as they are.
- **Front page:** the root `index.html` lists the apps; update it when apps change.

## Commits

- **Commits:** one commit per app or per meaningful fix. End messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Pushing:** push to `origin main`. The owner asked for everything to be on GitHub.
