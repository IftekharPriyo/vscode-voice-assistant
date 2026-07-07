# Change Log

All notable changes to the VS Code Voice Assistant extension will be documented
in this file.

## 0.1.2

- Added an optional `Insert into active terminal` workflow.
- When enabled, the latest voice transcript is inserted into the active VS Code terminal.
- Supports any active terminal or CLI, including Git Bash, PowerShell, CMD, Codex CLI, Claude CLI, and REPLs.
- Inserts transcript text without pressing Enter to avoid accidental command execution.

## 0.1.1

- Added the extension's Marketplace icon.
- Added a focused Marketplace description while preserving the project README.

## 0.1.0

- Added the first working VS Code extension release.
- Added a compact Voice Assistant view in the right-side Secondary Side Bar.
- Added local Windows microphone recording.
- Added local raw speech-to-text transcription with `whisper.cpp`.
- Added first-use Whisper runtime and model downloads with checksum validation.
- Added transcript accumulation, reset, and copy-to-clipboard controls.
