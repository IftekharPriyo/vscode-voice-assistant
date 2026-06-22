# VS Code Voice Assistant

A VS Code extension for capturing natural speech and turning it into useful
developer text without leaving the editor.

The long-term goal is speech-to-intent: developers should be able to pause,
use filler words, or correct themselves while speaking and still receive clean,
developer-ready prompts and text.

## Why This Exists

I often use ChatGPT in the browser with the microphone feature for voice-to-text.

That workflow is useful because I can speak naturally, even with pauses, filler
words, mumbling, or imperfect sentences, and ChatGPT cleans it into usable text.

However, when working inside VS Code, especially with coding agents such as
Codex, this workflow is either missing or not as effective.

This project aims to bring a ChatGPT-like voice experience directly into VS Code.

The goal is not just transcription.

The goal is to:

- Speak naturally
- Remove filler words
- Clean messy speech
- Improve grammar
- Preserve intent
- Generate developer-friendly text
- Insert it directly into the editor or AI prompt

## Current Status

The first vertical slice provides local raw voice-to-text on Windows x64.

Implemented features:

- A compact Voice Assistant view in VS Code's right-side Secondary Side Bar
- A status-bar microphone shortcut that reveals the view
- A large recording control that switches between microphone and pause states
- Live audio-reactive rings driven by actual microphone RMS amplitude
- Native PCM microphone capture through Windows WinMM
- Local transcription with `whisper.cpp`
- Raw transcript display inside the Voice Assistant view
- Automatic runtime and model provisioning on first use
- Checksum verification for downloaded runtime and model files
- Automatic deletion of temporary WAV files after transcription
- No backend, account, API key, or audio upload required

## Current Flow

```text
Default Windows Microphone
        ↓
Native PCM Recorder
        ├── Live RMS levels → Audio-reactive UI
        ↓
Temporary WAV file
        ↓
Local whisper.cpp transcription
        ↓
Raw transcript in the Secondary Side Bar
        ↓
Temporary WAV deleted
```

## First-Use Download

The first recording automatically downloads:

- A pinned Windows x64 `whisper.cpp` runtime
- The English `base.en` model, approximately 148 MB

Downloads are stored in VS Code's extension global storage and verified against
pinned checksums. Later recordings reuse these files and work offline.

## Privacy

- Microphone audio remains on the user's machine.
- Transcription runs locally.
- Audio, transcripts, and microphone levels are not uploaded.
- Temporary WAV files are removed after transcription.
- No telemetry, authentication, or user-data storage is implemented.

## Requirements

- Windows x64
- VS Code 1.96.2 or newer
- A working default Windows microphone
- Internet access for the first-use runtime and model download

macOS and Linux microphone helpers are planned but are not currently packaged.

## Development

Install dependencies:

```powershell
npm.cmd install
```

Compile the extension:

```powershell
npm.cmd run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

To test:

1. Click the Voice Assistant microphone in the status bar.
2. Click the large microphone button in the right-side view.
3. Speak after the status changes to `Recording...`.
4. Click the pause button to stop and transcribe.
5. Read the raw transcript in the view.

## Example

Raw speech:

```text
uhh create like a route for users and maybe make it get request and return all users
```

Future cleaned output:

```text
Create a GET /users route that returns all users.
```

The current extension produces only the raw transcript. Cleanup is not yet
implemented.

## Planned Work

The following features remain future work:

- Send raw transcripts to the backend API
- Clean filler words and improve grammar while preserving intent
- Support Ollama or another LLM behind the backend cleanup service
- Preview cleaned prompts
- Insert cleaned text into the active editor or coding-agent prompt
- Add macOS and Linux native audio providers
- Add configurable language and model selection
- Add settings, shortcuts, and stronger error recovery

Ollama will not run inside the VS Code extension. It is planned as a backend
implementation option so the extension remains independent of the selected LLM.

## Related Repository

Planned backend API:

```text
voice-assistant-api
```

## Non-Goals for the Current Slice

- AI cleanup
- Backend API communication
- Ollama integration
- Authentication or user accounts
- Database storage
- Billing, analytics, or telemetry
- Audio uploads
