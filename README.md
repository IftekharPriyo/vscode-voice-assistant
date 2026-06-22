# VS Code Voice Assistant

A VS Code extension that lets developers speak naturally and convert messy voice input into clean, developer-ready text or prompts.

## Why This Exists

I often use ChatGPT in the browser with the microphone feature for voice-to-text.

That workflow is useful because I can speak naturally, even with pauses, filler words, mumbling, or imperfect sentences, and ChatGPT cleans it into usable text.

However, when working inside VS Code, especially with coding agents such as Codex, this workflow is either missing or not as effective.

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

## Example

### Raw Speech

```text
uhh create like a route for users and maybe make it get request and return all users
```

### Cleaned Output

```text
Create a GET /users route that returns all users.
```

## MVP Features

- Push-to-talk voice recording
- Send input to backend API
- AI-powered cleanup
- Insert cleaned text into active editor
- Basic VS Code command integration

## Tech Stack

- TypeScript
- VS Code Extension API
- Node.js

## Related Repository

Backend API:

```text
voice-assistant-api
```

## Development

Install dependencies:

```bash
npm install
```

Launch the Extension Development Host:

```text
Press F5 in VS Code
```

## Raw Voice-to-Text Prototype

The current prototype records from the default Windows microphone and transcribes
the resulting audio locally with `whisper.cpp`.

On first use, the extension automatically downloads:

- A pinned `whisper.cpp` Windows runtime
- The English `base.en` model (approximately 148 MB)

Downloads are checksum-verified and stored in VS Code's extension global storage.
Audio is processed locally, deleted after transcription, and is never uploaded.

Windows x64 is currently supported. Other platforms show a clear unsupported
platform message until their native microphone helpers are packaged.

## Project Goal

The extension should remain lightweight.

Responsibilities:

- Audio capture
- VS Code integration
- API communication
- Text insertion

AI processing should happen in the backend.
