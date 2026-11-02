# Day 7: QR Check

**Platform:** Web (installable PWA, works offline)
**Run it:** serve the `app/` folder (the camera needs `https` or `localhost`). `?q=https://bit.ly/x` checks a link straight away, and `?make=https://example.com` fills the generator.

## The problem

- **Who has it:** small businesses with QR codes printed on menus, flyers, signs and packaging.
- **What it costs them:** many "free" QR generators make a *dynamic* code. It points at their own server, which then sends people on. When a trial ends, or the service changes its rules, the code shows an advert or stops, and every printed copy fails with it. Owners often don't know their code has a middleman at all.
- **Proof it's real:** [Trustpilot reviews of Bitly](https://uk.trustpilot.com/review/bitly.com). More in `research/raw-candidates.md`.

## What it does

- **Scan** with the camera, **upload** a photo, or **paste** what the code says.
- **The chain:** printed code, then any middleman, then the destination, with the middleman highlighted, because that's who holds the switch.
- **The verdict:**
  - **Direct:** the code goes straight to your site. Nobody else can redirect it.
  - **Hosted QR:** a QR-generator service sits in between, such as qrco.de or l.ead.me. Any address with "qr" in it is flagged as probably one.
  - **Short link:** bit.ly, tinyurl and others. Whoever holds that account controls the code.
  - **Ad-gated:** your customers see adverts first.
  - **Also recognised:** WhatsApp links, link-in-bio pages, Wi-Fi codes, phone, email and contact codes, and **payment codes** (the EMV standard, used by NQR), where it reads out the merchant name and city.
- **Make a direct code:** type the final address, add words like "Scan for our menu", and download a PNG (sticker-ready, with the words under it) or an SVG. It warns if you paste another middleman link.

## Limits

- **It can't follow a middleman to see where it sends people today.** A web page isn't allowed to read another site's redirects. The app says so and tells you to open the link once yourself.
- **The middleman list is hand-made and short** (about 30 services). Anything with "qr" in the address is flagged as probably a QR service.

## How it's built

- Plain HTML, CSS and JavaScript, with two small pinned libraries kept in `app/vendor/` so it works offline:
  - [jsQR 1.4.0](https://github.com/cozmo/jsQR) decodes codes, used when the browser has no built-in `BarcodeDetector`;
  - [qrcode-generator 1.4.4](https://github.com/kazuhikoarase/qrcode-generator) makes them, with medium error correction so a smudge doesn't kill the code.
- **Tested in the browser:** a website link, a Wi-Fi code and a payment code were generated and decoded back exactly, and each was classified correctly.
- The design comes from the **design-taste-frontend** skill (app-screen rules): the *accent-ladder* style (seed 1574233035) in DM Sans. Its look is a raspberry-tinted background, and its signature element is the chain.
- **Inspector:** the "hosted QR" and empty states pass with 0 FAIL and 0 WARN. The "direct" state keeps one WARN: the paste box is pinned to the foot of the scan card, which the rules allow for an action.
