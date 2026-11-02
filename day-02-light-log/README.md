# Day 2: Light Log

**Platform:** Android 8.0+ (Kotlin, Jetpack Compose, Material 3)
**Build it:** open `app/` in Android Studio, or run `gradlew assembleRelease` inside `app/`. The APK lands in `app/build/outputs/apk/release/` (about 1.2 MB).

## The problem

- **Who has it:** anyone on an unreliable grid: households, shops, anyone paying for a tariff band that promises a minimum supply.
- **What it costs them:** published outage schedules don't match what happens, and nobody has a record to complain with, so complaints are just "the light is always off".
- **Proof it's real:** [Zambian Observer](https://zambianobserver.com/government-frustrated-by-zescos-failure-to-follow-load-management-schedule/?amp=1), [Devdiscourse (Pakistan)](https://www.devdiscourse.com/article/international/3997885-pakistan-rawalpindi-faces-hours-of-unannounced-frustrating-load-shedding), [Citi Newsroom (Ghana)](https://citinewsroom.com/2024/04/power-outages-affecting-our-businesses-release-dumsor-timetable-guta/), [GridWatch, Berkeley](https://cega.berkeley.edu/collection/gridwatch/).

## What it does

- Leave a phone on a charger plugged into a grid socket (not an inverter or generator). Every time power to the charger goes off, Light Log notes the time, and it notes the time again when power comes back.
- **Now:** "Light is on, 2 h 13 m, since 14:05" or "No light, 3 h 40 m, since 09:12".
- **Today:** a 24-hour strip showing light, no light and not watched, plus hours of light so far.
- **Last 7 days:** one strip per day, the hours of light each day, the average out of every 24, the number of cuts and the longest cut.
- **Promised hours (optional):** enter the minimum supply your tariff band promises, and the days that fell short turn red.
- **Share report:** a plain-text record of every day and every cut, ready for WhatsApp, email or a complaint to the distribution company.
- **Remove:** if you unplugged the phone yourself, remove that cut so the record stays true.

## How it works

- A small foreground service keeps a receiver for power connect and disconnect. Android only delivers those broadcasts to a receiver registered while the app is running. It shows one quiet notification, "Light on since 14:05".
- Every change is one line in a CSV file on the phone. Cuts are worked out from those lines when they're read:
  - A drop shorter than 1 minute is a flicker, not a cut.
  - Power that comes back for less than 2 minutes before going again counts as the same cut.
- After a reboot it starts watching again. If power changed while the phone was off, it records the change and marks that cut as "about".
- No internet, no account, no location, no AI. It needs only the notification permission (optional) and permission to start at boot.

## Limits

- **The phone must stay on the charger.** If it's unplugged, that's logged as a cut (use Remove).
- **Some phones kill background apps.** The app asks you to let it run unrestricted.
- **An inverter or generator** on the same socket hides cuts. The app says this on the first screen.
- **The promised-hours check is yours to fill in.** The app doesn't assume any tariff band's figure.

## Tested

- **Unit tests:** 8 tests on the record logic (cut detection, flicker dropping, merging short restores, ongoing cuts, stopping mid-cut, hours per day while watched, cuts across midnight, the sample week). Run `gradlew testDebugUnitTest`.
- **Not yet tested on a real phone:** the emulator on this machine (Android 37 image) kept crashing its own system services and wouldn't accept touch input. Test it on a real phone by plugging and unplugging the charger.

## Design

- Built with the **mobile-android-design** skill: Material 3 with dynamic colour on Android 12+ and a warm fallback scheme.
- Light and no light are data, so they keep fixed colours (amber and charcoal) whatever the wallpaper does.
- Touch targets are 48 dp, and every strip has a spoken description.
