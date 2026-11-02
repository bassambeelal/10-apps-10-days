# Day 9 log: Memories Fixer

Notes from the build, 2 November 2026.

- The biggest risk was memory: exports run to gigabytes. Used fflate's streaming `Unzip` and only decompress the entries that are wanted. It waits for each file to be processed before reading the next chunk.
- Two passes: the history JSON can be in a different ZIP from the photos, so the first pass reads the JSON and lists every memory, and the second pass fixes and writes.
- Matching: exact when the file id appears in the entry's download link, or when there's a single memory of that type that day. Otherwise the right day at noon. A place is only added when every candidate that day shares it, so the app never guesses a place.
- Wrote an MP4 date patcher (`mvhd`, `tkhd`, `mdhd`, versions 0 and 1) instead of pulling in ffmpeg.wasm (25 MB+).
- End-to-end test on a made-up export: exact times, GPS, the merged caption, the MP4 date, and the chat image left out all came out right.

## Still to do with a real person

- Run it on a real Snapchat export from someone with years of memories, and film a before and after in Google Photos.
- Check the newest export's file names against `parseName()` first.
