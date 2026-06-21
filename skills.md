# Skills & Rules

## Project Purpose

Build a lightweight VS Code extension that enables developers to speak naturally and receive clean, developer-friendly text directly inside VS Code.

The extension exists because current coding workflows often lack the high-quality voice cleanup experience available in ChatGPT.

The goal is not simple speech-to-text.

The goal is speech-to-intent.

---

## Product Vision

A developer should be able to:

- Speak naturally
- Pause while thinking
- Use filler words
- Correct themselves mid-sentence
- Mumble slightly

And still receive clean, structured output suitable for:

- AI prompts
- Code generation requests
- Documentation
- Commit messages
- Development notes

---

## Tech Stack

- TypeScript
- VS Code Extension API
- Node.js

---

## Architecture Rules

The extension must remain thin.

Responsibilities:

- Register VS Code commands
- Capture audio
- Send requests to backend
- Display status messages
- Insert output into editor

The extension must NOT:

- Run LLMs
- Store prompts
- Contain cleanup logic
- Perform speech processing
- Manage AI models

These responsibilities belong to the backend.

---

## Coding Standards

- Strict TypeScript
- Async/await preferred
- Small focused modules
- Clear naming conventions
- Avoid global state
- Avoid unnecessary abstractions
- Keep dependencies minimal

---

## Folder Structure

src/
├── commands/
├── services/
├── config/
├── utils/
└── extension.ts

---

## MVP Scope

Build:

- Push-to-talk command
- Backend API integration
- Text insertion into editor
- Basic settings
- Error handling

Do Not Build Yet:

- Authentication
- User accounts
- Billing
- Analytics
- Telemetry
- Team features
- Cloud synchronization

---

## Development Philosophy

Build the smallest working solution first.

Optimize for:

1. Simplicity
2. Reliability
3. Developer experience

Avoid overengineering.
