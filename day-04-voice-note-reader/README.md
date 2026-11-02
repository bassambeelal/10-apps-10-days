# Day 4: Voice Note Reader

**Platform:** Android. It installs on Android 8.0+, but reading needs **Android 13+** with Google's speech services.
**Build it:** `gradlew assembleRelease` inside `app/` (APK about 1.1 MB).

## The problem

- **Who has it:** anyone who gets voice notes somewhere they can't play them out loud: a meeting, a church, a bus, an office, a hospital waiting room.
- **What it costs them:** they either play it out loud, wait hours, or upload it to a random transcription site.
- **Proof it's real:** people asking an open-source Whisper keyboard to read received voice notes: [#99](https://github.com/woheller69/whisperIME/issues/99), [#15](https://github.com/woheller69/whisperIME/issues/15), [#8](https://github.com/woheller69/whisperIME/issues/8).

## What it does

- In WhatsApp or Telegram, press and hold a voice note, tap **Share**, and choose **Voice Note Reader**. You can also open any audio file.
- It decodes the note on the phone (Opus, AAC, MP3, AMR, anything Android can play), converts it to 16 kHz mono, and feeds it to Android's **on-device** speech recognizer through a pipe instead of the microphone.
- The text appears as it's recognised. When it's done you can copy it or share it.
- **Language:** the phone's language by default, with one-tap re-reads in English (Nigeria), English (UK), English (US) or French.
- If the offline speech pack is missing, it offers to download it. If offline recognition isn't available at all, it offers Google's online recognition, with a clear warning that the audio is sent to Google.

## Why not Whisper?

- Bundling a Whisper model would add 30 to 75 MB plus a native build, which is too heavy for people buying data in small bundles.
- Android 13 added a way to feed audio from a file into the built-in on-device recognizer, so the app stays at about 1 MB and nothing leaves the phone.
- The trade-off: it only works where Google's on-device speech services are installed. That covers most Android 13+ phones, but not all.

## Permissions

- **Microphone:** Android's speech recognizer requires it even when the audio comes from a file. The app never opens the microphone, and it explains this when it asks.
- **Nothing else:** no internet permission is declared. Online recognition, if you choose it, runs inside Google's own speech service.

## Tested

- **Unit tests:** 5 tests on the resampling, the PCM buffer and the joining of recognised segments into sentences (`gradlew testDebugUnitTest`).
- **Not tested on a real phone yet.** The emulator on this machine isn't usable (see Day 2). This is the riskiest app so far, because it depends on the phone's speech service.

## Check before filming (from the plan)

1. Does WhatsApp's own "transcribe voice message" feature already cover your phone and language? If it does, the episode becomes "WhatsApp does this now, here's what it still misses" (Telegram, files, privacy).
2. How fast is it on a cheap phone?
3. How good is it on Nigerian English and Pidgin? Try `English (Nigeria)` first.
