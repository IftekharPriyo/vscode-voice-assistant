# Roadmap

## Phase 1 — MVP

Goal:

Enable developers to speak and receive cleaned text inside VS Code.

Features:

- Initialize VS Code extension
- Register voice command
- Capture microphone input
- Send request to backend
- Receive cleaned text
- Insert text at cursor position
- Configure backend URL

Success Criteria:

A user can speak and see cleaned text inserted into the editor.

---

## Phase 2 — Developer Prompt Mode

Goal:

Improve usability with coding agents.

Features:

- Clean prompt command
- Prompt preview window
- Copy to clipboard
- Insert into active editor
- Keyboard shortcuts

Examples:

Raw:

"create a route for users and return everything"

Output:

"Create a GET /users endpoint that returns all users."

---

## Phase 3 — UX Improvements

Goal:

Make the extension feel polished.

Features:

- Recording indicator
- Status bar integration
- Loading state
- Error notifications
- Settings page
- Configurable shortcuts

---

## Phase 4 — Smart Modes

Goal:

Support multiple developer workflows.

Modes:

### Prompt Mode

Converts speech into AI-ready prompts.

### Documentation Mode

Converts speech into documentation.

### Commit Mode

Converts speech into commit messages.

### Note Mode

Converts speech into clean notes.

---

## Phase 5 — Advanced Features

Goal:

Provide power-user functionality.

Features:

- Context-aware cleanup
- Workspace awareness
- Multi-language support
- Custom prompt templates
- Multiple backend providers

---

## Future Possibilities

- JetBrains plugin
- Neovim plugin
- Cursor integration
- Windsurf integration
- Standalone desktop application

---

## Explicitly Out Of Scope

Do not build these during MVP:

- User authentication
- Teams
- Billing
- Analytics dashboards
- SaaS infrastructure
- Marketplace monetization
