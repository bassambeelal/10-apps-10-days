# Day 2 log: Light Log

Notes from the build, 2 November 2026.

- Set up the Android project as a single Gradle module (AGP 9.1.1, Kotlin 2.2.10, Compose BOM 2026.02.01). The Gradle wrapper was copied from another project on this machine.
- Android only delivers power connect and disconnect to a receiver registered while the app is running, so a foreground service holds it. The service type is "special use", with a one-line reason in the manifest.
- Kept raw events in a CSV and work out cuts when reading, so the file stays the plain truth. Flickers under 1 minute are dropped; restores under 2 minutes merge into one cut.
- First offline build failed: the Gradle cache was missing the Android plugin files. Built online instead.
- The release APK was 7.9 MB. With R8 shrinking it's 1.2 MB, which matters for people buying data in small bundles.
- Emulator testing failed: the Pixel 7 image (Android 37) had no input viewport, so taps went nowhere, and then system services kept crashing. Switched to unit tests for the logic: 8 pass.
- Promised hours: I didn't hard-code any tariff band's figure. The user enters it from their bill, and the days below it turn red.

## Still to do with a real person

- Install the APK on a real phone, leave it on a charger in a home with cuts for a day, and check the record against what people remember.
- Check the notification and the "allow in background" prompt on a Tecno, Infinix or Samsung phone. Those makers are known for killing background apps.
