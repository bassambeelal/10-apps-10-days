# Day 7 log: QR Check

Notes from the build, 2 November 2026.

- The plan said "one small Worker to follow redirects". Dropped it for v1: it needs hosting, and the main point (is there a middleman at all?) can be answered offline from the address in the code.
- Kept the middleman list short and limited to services I'm sure redirect. A name heuristic ("qr" in the address) catches the rest as "probably".
- Added the code types people actually meet: payment codes (EMV/NQR, with the merchant name read from tag 59), Wi-Fi, WhatsApp, phone, email and contact cards.
- Vendored jsQR and qrcode-generator at pinned versions so scanning and making work offline. Desktop Chrome has no `BarcodeDetector`, so jsQR does the work there.
- Round-trip test in the browser: a website link, a Wi-Fi code and a payment code were generated, then decoded back exactly.
- Inspector: the result card is shorter than the scan card for a direct link, so I added the list of known middlemen there as reference. Two states pass clean, and the direct state has one defensible WARN.

## Still to do with a real person

- Scan the codes on three real menus or flyers near you. The episode is whatever they turn out to be.
- If one has a middleman, make the shop a direct code and film them printing it.
