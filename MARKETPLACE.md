# VS Code Voice Assistant

Speak naturally and turn your voice into raw text without leaving VS Code.

VS Code Voice Assistant is a privacy-first voice-to-text extension powered by
`whisper.cpp`. Recording and transcription happen locally on your computer—no
account, API key, backend, or audio upload is required.

## Features

- Record from your default microphone inside VS Code
- Transcribe speech locally with Whisper
- Access a compact interface in the right-side Secondary Side Bar
- See audio-reactive feedback while speaking
- Continue recording to append to your current transcript
- Copy the complete transcript to your clipboard
- Reset the transcript with one click
- Automatically download and verify the required runtime and model on first use

## Getting Started

1. Open **Voice Assistant** from the microphone icon in the status bar.
2. Select the large microphone button and begin speaking.
3. Select the pause button to stop recording and start transcription.
4. Copy the transcript or continue recording to add more text.

The first recording downloads the appropriate `whisper.cpp` runtime, a small
macOS recorder when applicable, and the English `base.en` model (approximately
148 MB). These files are verified, stored in VS Code's extension storage, and
reused for future offline transcription.

## Privacy

- Audio and transcription stay on your machine.
- Temporary recordings are deleted after transcription.
- No telemetry, authentication, cloud storage, or audio upload is used.

## Requirements

- Windows x64, or macOS on Apple Silicon/Intel
- VS Code 1.96.2 or newer
- A working default microphone
- Internet access for the first-use runtime and model download

Linux support is planned for a future release.

## Current Scope

This release provides raw English voice-to-text. AI cleanup, filler-word
removal, editor insertion, multilingual transcription, and Ollama integration
are planned for later versions.

Found an issue or have an idea? Visit the
[GitHub repository](https://github.com/IftekharPriyo/vscode-voice-assistant).
