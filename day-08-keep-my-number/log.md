# Day 8 log: Keep My Number

Notes from the build, 2 November 2026.

- Did the ◐ check from the plan first: what does the NCC actually say?
  - Vanguard (June 2025) quotes the new guidelines: over 180 days without a revenue generating event makes a line inactive, and 360 days makes it eligible for recycling.
  - It also quotes the QoS Regulation and Business Rules 2024 as 365 days.
  - Reports disagree on whether a 14-day notice before deactivation is required yet, so the app doesn't rely on getting a notice.
- Notable: the guideline counts *incoming* calls and SMS too. To be safe, the app still tells people to make a call, send an SMS or use some data.
- Chose manual "I used it today" over reading SIM usage: no phone or SMS permissions, which Play restricts and people fear.
- Reminders use one inexact daily alarm, re-registered after reboot, with no WorkManager dependency.
- Built first time: 4 unit tests on the stage boundaries pass, and the APK is 1.3 MB.

## Still to do with a real person

- Ask someone how many SIMs they own and when they last used each. Add them all on camera.
- Find someone who lost a number to recycling and hear the story.
