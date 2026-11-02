# Day 9: Memories Fixer

**Platform:** Web (installable PWA, works offline once loaded)
**Run it:** serve the `app/` folder and open it in Chrome or Edge, which can save straight into a folder. Any modern browser works, with a ZIP download instead.

## The problem

- **Who has it:** anyone downloading their Snapchat Memories, which matters more now that free Memories storage is capped.
- **What it costs them:** every photo and video comes out dated "today", with no place, and captions or stickers in separate files. Years of memories land in the wrong spot in Google Photos. People pay for tools to fix it, and some inspect the tool's network traffic first, because the export is private.
- **Proof it's real:** [TechCrunch](https://techcrunch.com/2025/10/03/snapchat-is-planning-to-charge-for-storage-heres-how-to-save-your-memories-for-free), [Trustpilot: fixmyexport](https://at.trustpilot.com/review/fixmyexport.com).

## What it does

- Drop every ZIP from Snapchat's "My Data" email at once. The page streams through them in two passes, so a large export never sits in memory whole:
  - **Pass 1** lists the memories and reads `memories_history.json` (dates, places, download links).
  - **Pass 2** fixes each file and writes it out.
- **Photos:** writes `DateTimeOriginal` and GPS into the JPEG's EXIF.
- **Captions and stickers:** merges each overlay back onto its photo (optional). For videos, the overlay is saved next to the video with the same date.
- **Videos:** sets the creation time inside the MP4 (`mvhd`, `tkhd`, `mdhd`), which is what Google Photos reads.
- **File names:** start with the date and time (`2021-06-12_19-22-05_AAAA1111.jpg`), so files sort correctly anywhere.
- **Where it saves:** Chrome and Edge save straight into a folder you pick. Other browsers get one ZIP whose entries also carry the date.
- **Before it starts:** a summary of photos, videos, captions to merge, memories per year, and how many get an exact time or a place.

## How matching works

- **Exact:** the file's id appears in a history entry's download link, or it's the only memory of its kind that day.
- **Day only:** several memories share the day, so the file is dated at noon on the right day. A place is added only if every candidate that day shares it.
- **Missing JSON:** dates come from the file names alone, and the app says so.

## Privacy

- **Nothing is uploaded.** Everything runs in the page, with two small pinned libraries in `app/vendor/`: [fflate 0.8.2](https://github.com/101arrowz/fflate) (ZIP) and [piexifjs 1.0.6](https://github.com/hMatoba/piexifjs) (EXIF). It works with Wi-Fi off after the first load.

## Tested

An end-to-end run in the browser on a made-up export: a ZIP with `memories_history.json`, three JPEGs (one with a caption overlay), one MP4 and one chat image that isn't a memory.

- **Photo matched by its link:** exact time (converted to local time), the right GPS (6.52441, 3.37921 written as 6°31'27.88"), and the overlay merged.
- **Video:** creation time set to exactly 2022-12-25 09:10 UTC. Its 0,0 location was correctly ignored.
- **Two photos on the same day:** both got the day and the place they share, without a made-up time.
- **The chat image** was left out.
- **Inspector:** 0 FAIL, plus one WARN for empty space below the start screen's two cards (the end of a one-step page).

## Limits

- **Snapchat's export format changes now and then.** The file-name pattern and JSON fields are matched loosely, but a new format may need an update. Test with a real export before filming.
- **Times use this browser's time zone.** Memories taken while travelling may be off by the time difference.
- **Merged captions mean a re-saved JPEG** (quality 92%). Untick the option to keep the originals untouched.
- **ZIP output builds the file in the browser.** For multi-gigabyte exports, use the folder option in Chrome or Edge on a computer.

## Design

- **design-taste-frontend**, app-screen rules: the *true-black-flat* style (seed 101686840).
- **Its look:** one warm amber on the data instead of the dealt lime, on a true black background for media.
- **Its signature element:** the years strip, one bar per year of memories found.
