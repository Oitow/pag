# Oito Mix Lab

A buildless, browser-local two-deck DJ practice app. Open `index.html` directly, or serve this directory with any static host. No dependencies, audio uploads, analytics, accounts, or external assets in the app itself.

## Features
- Two independent decks with original synthesized practice tracks at 122/126 BPM.
- Browser-supported local audio import, onset-based BPM estimation and manually editable beat grids.
- Waveform seeking, play/pause, cue return, four hot cues and beat loops.
- ±16% tempo, tap tempo, tempo and beat-phase sync.
- Three-band EQ, channel gain, equal-power crossfader, master compressor and output meter.
- Live master recording (browser-supported MediaRecorder format) and original-audio WAV clip export.
- Responsive touch controls, keyboard shortcuts and four beginner lessons.

## Start mixing
Play both decks, sync B, and slide the crossfader. Add your own MP3/WAV files with Load track or Add tracks. Adjust estimated BPM and use Beat 1 here when the detected grid needs correction.

## Limits
Tempo changes pitch; no time stretching, scratching, separate headphone monitoring, persistent crate/cues or multitrack timeline yet. Imported audio is decoded into memory (120 MB file cap), so use shorter tracks on phones. WAV clips are capped at three minutes and do not apply live EQ/tempo. Recording retains compressed chunks in memory until stopped; use short practice sessions. Beat estimation is heuristic, especially on short or non-percussive audio. A reload clears imported tracks and cue state; exports are ordinary downloads. Browser backgrounding/locking may suspend audio.

## Verification
Browser-verified both-deck playback, 126→122 BPM sync, four-beat looping, hot cue save, live mix download, WAV export and re-import/decoding of that exported clip. JavaScript syntax checked with Node. Physical Android touch/audio routing still needs device testing.
