# Demo videos

Each web app has a narrated demo of about a minute at `day-NN-name/media/demo.mp4`, with a poster frame beside it (`demo-poster.jpg`). The videos are recorded from the real apps running in Chromium, not mocked up, and every claim in the narration comes from the app's README.

| App | Length | What it shows |
| --- | --- | --- |
| [Fair Split](../day-01-fair-split/media/demo.mp4) | 0:45 | balances, Tom's working, adding an expense by shares, settling up, the update link |
| [Citation Check](../day-03-citation-check/media/demo.mp4) | 1:04 | a pasted list checked, the verdict, a real DOI on an invented paper, a close match, a court citation |
| [Hidden Text Finder](../day-05-hidden-text-finder/media/demo.mp4) | 1:01 | three sample CVs, Maya's CV as a person sees it, then with the hidden text painted back |
| [QR Check](../day-07-qr-check/media/demo.mp4) | 1:01 | a hosted code checked on a phone, the chain and the verdict, My codes, making a direct code |
| [Memories Fixer](../day-09-memories-fixer/media/demo.mp4) | 1:05 | a 143-memory export, memories per year, local time zones, the preview, the fix |

## How a video is made

```bash
node demo-video/build.mjs day-07-qr-check
```

1. **The script.** `scripts/<day>.js` sets `window.DEMO`: the name, colours, music, and a list of segments. Each segment has a line to say (`say`), an optional caption (`cap`, with `*words*` in the accent colour), and an action (`do`) that drives the stage.
2. **The voice.** `audio.py tts` reads every line with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), an open text-to-speech model (Apache 2.0, voice `af_heart`), then trims and levels each line. Lines are cached by their text, so a re-render only reads new or changed lines.
3. **The recording.** `stage.html` holds a 1920×1080 stage: full-screen type cards, a browser or phone frame with the real app inside, a camera that zooms, a cursor that clicks, captions and a progress bar. `build.mjs` serves the repo, opens the stage in Chromium and records it with the DevTools screencast. Each segment starts when its line starts; if an action outlasts its line, the next line waits for it.
4. **The music.** `audio.py mix` synthesises a short house beat from scratch for each video (kick, clap, hats, an off-beat bass and pumping chords, in the key and tempo the script sets), ducks it under the voice, and places each line where the stage started it.
5. **The master.** ffmpeg brings the mix to -14 LUFS with true peaks under -1 dBTP (two-pass `loudnorm`, linear), encodes H.264 at 30 fps (CRF 20) with AAC audio, and saves a poster frame.

## Test data

- **Citation Check:** Crossref and OpenAlex are answered from the app's own test fixtures (`mocks/citation.js`), in their documented response shapes, because the recording machine can't reach them.
- **Memories Fixer:** `fixtures/make-memories.py` makes a made-up Snapchat export at render time: 143 memories over nine years in fifteen cities, in two ZIPs. Every file and place is invented. Recording with it found a real bug (see the Day 9 log).
- **The others:** each app's built-in sample (`#/sample` in Fair Split, "Try three sample CVs" in Hidden Text Finder) or text typed on camera.

## Setup

- Node with Playwright's Chromium, ffmpeg, and Python 3 with `kokoro-onnx`, `soundfile`, `scipy` and `numpy`.
- Kokoro's model files, `kokoro-v1.0.onnx` and `voices-v1.0.bin`, from the [kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0), in a folder named by `KOKORO_DIR`.
- Optional: `TTS_CACHE` (where read lines are kept) and `DEMO_WORK` (frames and working files; about 200 MB per video).

The stage's font is DM Sans (SIL Open Font License, `LICENSE-DM-Sans.txt`).
