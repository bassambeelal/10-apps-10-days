# Day 4 log: Voice Note Reader

Notes from the build, 2 November 2026.

- The plan said whisper.cpp with a tiny model. Dropped it: 30 to 75 MB of model plus an NDK build is wrong for users on small data bundles.
- Used Android 13's `EXTRA_AUDIO_SOURCE` instead: the speech recognizer can read from a file descriptor. MediaExtractor and MediaCodec decode the voice note, it's mixed to mono and resampled to 16 kHz, and the PCM is written into a pipe on a background thread.
- Used a segmented session, so long notes come back in pieces instead of stopping at the first pause.
- Android still asks for the microphone permission for this. The app explains that it never records.
- Online recognition is only offered as an opt-in fallback, with a line saying the audio goes to Google.
- Built first time: 5 unit tests pass, and the release APK is 1.1 MB.
- Not run on a device, because the emulator is broken on this machine.

## Still to do with a real person

- Check whether WhatsApp's built-in transcripts already cover the phone and language (the ◐ check in the plan).
- Share three real voice notes into it on a mid-range Android 13+ phone: one in English, one in Pidgin, one noisy. Film the result next to the audio.
