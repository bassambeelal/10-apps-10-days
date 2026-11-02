# Day 6: Proof Pack

**Platform:** Android 8.0+ (Kotlin, Jetpack Compose, Material 3)
**Build it:** `gradlew assembleRelease` inside `app/` (APK about 1.3 MB)

## The problem

- **Who has it:** people renting a car, and (the version for Nigeria) tenants moving in or out who fight over the caution deposit.
- **What it costs them:** AI damage scanners at rental desks bill renters for damage they can't disprove. Landlords keep deposits over damage that was already there. People take a few random photos with no proof of when, where, or that they weren't edited.
- **Proof it's real:** [WLOX](https://www.wlox.com/2026/06/29/rental-car-ai-scanners-flag-alleged-damage-leaving-customers-with-surprise-bills/), [Consumer Rescue](https://consumerrescue.org/travel-troubles/ai-scanner-mistake-sixt-wrongly-billed-car-repairs/), [ECC Finland](https://www.ecc.fi/en/themes/travelling/car-rental/subsequent-charges), [Frommer's](https://www.frommers.com/tips/car-bus-rail/hertz-is-using-ai-scanners-to-charge-rental-car-damage-that-human-eyes-miss/).

## What it does

- **Two checklists:**
  - *Rental car* (pickup and return, 16 photos each): plate first, then every corner, side, windscreen, wheels, mileage, fuel, seats and boot.
  - *Moving in or out* (13 photos each): door and lock, keys, walls, floors, windows and burglary proof, ceilings, kitchen, bathroom, toilet, bedroom, electricity meter, plumbing, and anything already damaged.
- **Every photo is stamped with:**
  - the time it was taken;
  - the place, if you turn it on (it uses the phone's last location fix, up to 10 minutes old, and never waits on the network);
  - a SHA-256 fingerprint of the original file.
- **Notes:** add a note to any photo ("scratch already there"), and add extra photos beyond the list.
- **Make the PDF:** a cover page that explains how to check the fingerprints, then two photos per page with label, time, place and fingerprint. Share it on WhatsApp or by email.

## Why fingerprints

- The original photos stay on the phone, untouched. If anyone says a photo was edited, the file's SHA-256 can be checked against the one printed in the PDF. A one-pixel change gives a completely different fingerprint.
- **Retakes:** a retake replaces the photo and its fingerprint, so the PDF only ever shows one photo per item.

## Permissions

- **No camera permission.** It uses the phone's own camera app through Android's standard "take a picture" request.
- **Location:** optional, asked only when you switch it on.
- **No internet.**

## Limits

- **Times come from the phone's clock.** A fingerprint proves the file wasn't edited after it was taken, not that the clock was right. The PDF says this.
- **The PDF holds smaller copies of the photos.** The originals stay on the phone, and the fingerprints are of the originals.

## Tested

- **Unit tests:** 4 tests: new packs, taking one shot, a full JSON round trip, and the SHA-256 fingerprint against the known empty-file value.
- **Not run on a phone yet.** The emulator on this machine is broken (see Day 2).
