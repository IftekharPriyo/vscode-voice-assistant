import { createNonce } from '../utils/nonce';

export function getWebviewContent(): string {
  const nonce = createNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>VS Code Voice Assistant</title>
  <style nonce="${nonce}">
    body {
      padding: 2rem;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
    main {
      max-width: 36rem;
      margin: 0 auto;
    }
    .status,
    .transcript {
      margin: 1.5rem 0;
      padding: 0.75rem 1rem;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
    }
    button {
      padding: 0.5rem 0.85rem;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 0;
      border-radius: 2px;
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    .transcript h2 {
      margin-top: 0;
      font-size: 1rem;
    }
    #transcript {
      min-height: 4rem;
      margin-bottom: 0;
      white-space: pre-wrap;
    }
    .error {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <main>
    <h1>VS Code Voice Assistant</h1>
    <div class="status" role="status" aria-live="polite">
      Status: <span id="status">Ready</span>
    </div>
    <div class="actions">
      <button id="start" type="button">Start Recording</button>
      <button id="stop" type="button" disabled>Stop Recording</button>
    </div>
    <section class="transcript" aria-labelledby="transcript-heading">
      <h2 id="transcript-heading">Raw Transcript</h2>
      <p id="transcript" aria-live="polite">Your raw speech will appear here.</p>
    </section>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const statusElement = document.getElementById('status');
    const transcriptElement = document.getElementById('transcript');
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');

    startButton.addEventListener('click', () => {
      vscode.postMessage({ type: 'command', command: 'start' });
    });

    stopButton.addEventListener('click', () => {
      vscode.postMessage({ type: 'command', command: 'stop' });
    });

    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'state') {
        return;
      }

      statusElement.textContent = event.data.status;
      statusElement.classList.toggle('error', event.data.isError);
      startButton.disabled = !event.data.canStart;
      stopButton.disabled = !event.data.canStop;

      if (typeof event.data.transcript === 'string') {
        transcriptElement.textContent =
          event.data.transcript || 'Your raw speech will appear here.';
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
