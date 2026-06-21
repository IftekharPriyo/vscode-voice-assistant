# Architecture

## Overview

The VS Code extension acts as the client application.

Its job is to capture user input and communicate with the backend API.

All AI processing happens on the backend.

---

## High-Level Flow

User Speaks
↓
VS Code Extension
↓
Backend API
↓
AI Cleanup Service
↓
Response Returned
↓
Insert Into Editor

---

## System Architecture

┌─────────────────────┐
│ User │
└──────────┬──────────┘
│
▼
┌─────────────────────┐
│ VS Code Extension │
└──────────┬──────────┘
│
│ HTTP Request
▼
┌─────────────────────┐
│ Backend API │
└──────────┬──────────┘
│
▼
┌─────────────────────┐
│ AI Processing │
│ (Ollama/LLM) │
└──────────┬──────────┘
│
▼
┌─────────────────────┐
│ Cleaned Text │
└─────────────────────┘

---

## Extension Responsibilities

### Commands

Register VS Code commands.

Examples:

- Start Recording
- Stop Recording
- Clean Prompt

---

### Audio Layer

Responsible for:

- Capturing microphone input
- Preparing request payloads

Not responsible for:

- Speech cleanup
- AI processing

---

### API Layer

Responsible for:

- Calling backend endpoints
- Handling responses
- Handling failures

---

### Editor Layer

Responsible for:

- Inserting text
- Replacing selections
- Clipboard support

---

## Component Structure

src/
├── commands/
│ └── startVoiceInput.ts
│
├── services/
│ └── voiceAssistantApi.ts
│
├── config/
│ └── extensionConfig.ts
│
├── utils/
│ └── editor.ts
│
└── extension.ts

---

## API Contract

Request:

POST /api/voice/clean

Payload:

{
"text": "uhh create like a route for users"
}

Response:

{
"text": "Create a GET /users route."
}

---

## Design Principles

### Thin Frontend

The extension should remain lightweight.

Business logic belongs to the backend.

---

### Single Responsibility

Each module should have one responsibility.

Examples:

voiceAssistantApi.ts

Only API communication.

editor.ts

Only editor interactions.

---

### Backend Agnostic

The extension should not know:

- Which LLM is used
- Which provider is used
- How prompts are constructed

The backend may change without requiring frontend changes.

---

## Non-Goals

The extension will not:

- Run local LLMs
- Store user data
- Manage accounts
- Handle billing
- Perform AI reasoning

Those concerns belong elsewhere.
