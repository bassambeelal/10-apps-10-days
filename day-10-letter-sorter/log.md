# Day 10 log: Letter Sorter

Notes from the build, 2 November 2026.

- The plan's ◐ check said post is a UK and US habit, so the app takes screenshots and shared images too (bills, school fees, bank notices).
- Kept the reading in plain Kotlin rules rather than an AI call: no API key, no data leaving the phone, and every rule unit-tested.
- A test caught a real bug: a GTBank receipt was sorted as "do this", because it had a date and an amount. Fixed it so a date only counts as a deadline right after a due word, and record words win unless the letter is actually urgent.
- First release APK: 44 MB, because the bundled ML Kit model carries native code for four CPU types. Switched to the Play services model, downloaded at install, and got 1.6 MB.
- 7 unit tests pass.

## Still to do with a real person

- Sit with someone who has a pile of unopened letters or unread bill emails. Sort five on camera and count the minutes.
- Check OCR on a photo of a real, folded DisCo bill in low light.
