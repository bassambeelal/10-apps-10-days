# Day 7 log: QR Check

Notes from the build, 2 November 2026.

- The plan said "one small Worker to follow redirects". Dropped it for v1: it needs hosting, and the main point (is there a middleman at all?) can be answered offline from the address in the code.
- Kept the middleman list short and limited to services I'm sure redirect. A name heuristic ("qr" in the address) catches the rest as "probably".
- Added the code types people actually meet: payment codes (EMV/NQR, with the merchant name read from tag 59), Wi-Fi, WhatsApp, phone, email and contact cards.
- Vendored jsQR and qrcode-generator at pinned versions so scanning and making work offline. Desktop Chrome has no `BarcodeDetector`, so jsQR does the work there.
- Round-trip test in the browser: a website link, a Wi-Fi code and a payment code were generated, then decoded back exactly.
- Inspector: the result card is shorter than the scan card for a direct link, so I added the list of known middlemen there as reference. Two states pass clean, and the direct state has one defensible WARN.

## Rebuild, 2 November 2026 (to the shipped bar)

- **The verdict on the first build:** "works, but looks like a hackathon". It was one long page with a marketing headline, no navigation and no memory.
- **Two real bugs:**
  - **The launcher icon's SVG was cut off mid-path,** so the icon was broken.
  - **The service worker had never installed.** Its file list held fragments of that broken SVG ("./16.5l2.5"…), so it never cached anything, despite the README's "works offline". Both are rewritten, and an offline reload is now tested.
- **A third bug, found by a new test:** codes were encoded as Latin-1, the library's default, so a café name in Arabic or Chinese scanned back garbled. The app now uses UTF-8, and the test round-trips six kinds of code, including Arabic and Chinese text, at both strengths.
- **Rebuilt as an app** with three places: Check a code (camera in the app with a frame and a light, upload, paste), My codes (a saved audit, middlemen first, CSV), and Make a code (six kinds of code, strength, a print sheet of 12).
- **The made code is read back as soon as it's drawn,** with "Checked: this code scans back to exactly what you typed".
- **The "can't follow a middleman" limit, narrowed:** Bitly, TinyURL and is.gd publish their own preview pages, so "See where it goes" opens those without visiting the link.
- **The camera path is tested** with Chromium's fake camera playing a video of a code the app made: the camera found it and showed the result.
- **Sample data:** the old example used a Nigerian restaurant. The samples are now a made-up café, with Pix as the example payment code.
- **Inspector:** Check and Make show 0 FAIL and 0 WARN. The empty My codes list has one WARN for blank space below its checklist, which is defensible on an empty list.

## Still to do with a real person

- Scan the codes on three real menus or flyers near you. The episode is whatever they turn out to be.
- If one has a middleman, make the shop a direct code and film them printing it.
