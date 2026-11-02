# Day 9 log: Memories Fixer

Notes from the build, 2 November 2026.

- The biggest risk was memory: exports run to gigabytes. Used fflate's streaming `Unzip` and only decompress the entries that are wanted. It waits for each file to be processed before reading the next chunk.
- Two passes: the history JSON can be in a different ZIP from the photos, so the first pass reads the JSON and lists every memory, and the second pass fixes and writes.
- Matching: exact when the file id appears in the entry's download link, or when there's a single memory of that type that day. Otherwise the right day at noon. A place is only added when every candidate that day shares it, so the app never guesses a place.
- Wrote an MP4 date patcher (`mvhd`, `tkhd`, `mdhd`, versions 0 and 1) instead of pulling in ffmpeg.wasm (25 MB+).
- End-to-end test on a made-up export: exact times, GPS, the merged caption, the MP4 date, and the chat image left out all came out right.

## Polish, 2 November 2026

- **Two hidden bugs**, the same as QR Check had:
  - **The launcher icon's SVG was cut off,** so the icon was broken.
  - **The service worker had never installed.** Its file list held fragments of that broken SVG, so "works offline" wasn't true. Both are rewritten.
  - **The font loaded from Google Fonts.** Inter is bundled now.
- **The time-zone limit, fixed instead of listed:**
  - Snapchat's history is in UTC, and the app wrote EXIF in whatever zone the computer was in.
  - Now each memory with a place gets the zone of the nearest city (7,260 places from city-timezones and Natural Earth, 96 KB). Those without a place get a zone the person picks.
  - EXIF also gets `OffsetTimeOriginal`, which this piexifjs version doesn't list, so the tag is registered at run time.
  - Tested with the browser in Los Angeles: the New York photo is dated New Year's Eve at 18:40.
- **The preview:** "What each file becomes" lists the newest memories with their new date, zone and place, before anything is written.
- **Small fixes:**
  - years in full ("2020", not "20")
  - an "After fixing" guide for Google Photos, Apple Photos and Android
  - a light theme
  - a neutral light ground, after the inspector flagged a warm one as cream
- **Tests:** the engine tests pass 5 of 5. The end-to-end run on a made-up two-ZIP export passes all 11 of its file checks.

## Still to do with a real person

- Run it on a real Snapchat export from someone with years of memories, and film a before and after in Google Photos.
- Check the newest export's file names against `parseName()` first.
