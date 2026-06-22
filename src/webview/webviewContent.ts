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
    * {
      box-sizing: border-box;
    }
    body {
      min-height: 100vh;
      margin: 0;
      padding: 0.75rem;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
    }
    main {
      display: flex;
      min-height: calc(100vh - 1.5rem);
      flex-direction: column;
    }
    .transcript {
      margin: 0 0 0.75rem;
      padding: 0.65rem 0.75rem;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    .voice-control {
      display: flex;
      flex: 1 1 auto;
      min-height: 10rem;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 0.85rem;
      padding: 1rem 0;
      text-align: center;
    }
    .record-button {
      display: inline-flex;
      width: 4.5rem;
      height: 4.5rem;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 2px solid transparent;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
      z-index: 2;
    }
    .audio-visualizer {
      --wave-1-scale: 0.86;
      --wave-2-scale: 0.82;
      --wave-3-scale: 0.78;
      --wave-opacity: 0;
      position: relative;
      display: grid;
      width: 9rem;
      height: 9rem;
      place-items: center;
    }
    .audio-wave {
      position: absolute;
      border: 1.5px solid var(--vscode-button-background);
      border-radius: 50%;
      opacity: var(--wave-opacity);
      pointer-events: none;
      transition: transform 90ms ease-out, opacity 120ms ease-out;
    }
    .audio-wave:nth-child(1) {
      width: 5.6rem;
      height: 5.6rem;
      transform: scale(var(--wave-1-scale));
    }
    .audio-wave:nth-child(2) {
      width: 7rem;
      height: 7rem;
      transform: scale(var(--wave-2-scale));
    }
    .audio-wave:nth-child(3) {
      width: 8.4rem;
      height: 8.4rem;
      transform: scale(var(--wave-3-scale));
    }
    .audio-visualizer.active .audio-wave {
      border-color: var(--vscode-errorForeground);
    }
    .audio-visualizer:not(.active) .audio-wave {
      opacity: 0;
    }
    .record-button:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      transform: scale(1.04);
    }
    .record-button:focus-visible {
      border-color: var(--vscode-focusBorder);
      outline: none;
    }
    .record-button.recording {
      color: #fff;
      background: var(--vscode-errorForeground);
    }
    .record-button.recording:hover:not(:disabled) {
      background: var(--vscode-errorForeground);
    }
    .record-button:disabled {
      cursor: default;
      opacity: 0.55;
    }
    .record-button.busy {
      animation: pulse 1.4s ease-in-out infinite;
    }
    .record-button svg {
      width: 2rem;
      height: 2rem;
    }
    .record-button svg[hidden] {
      display: none;
    }
    .status {
      max-width: 20rem;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }
    .status.error {
      color: var(--vscode-errorForeground);
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(0.94); }
    }
    @media (prefers-reduced-motion: reduce) {
      .record-button,
      .audio-wave {
        transition: none;
      }
      .record-button.busy {
        animation: none;
      }
    }
    .transcript h2 {
      margin: 0 0 0.5rem;
      color: var(--vscode-descriptionForeground);
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    #transcript {
      max-height: 14rem;
      min-height: 2rem;
      margin: 0;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .error {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <main>
    <div class="voice-control">
      <div class="audio-visualizer" id="audio-visualizer">
        <span class="audio-wave" aria-hidden="true"></span>
        <span class="audio-wave" aria-hidden="true"></span>
        <span class="audio-wave" aria-hidden="true"></span>
        <button class="record-button" id="record-control" type="button" title="Start Recording" aria-label="Start Recording">
          <svg id="microphone-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" d="M8 10.5a2.5 2.5 0 0 0 2.5-2.5V4A2.5 2.5 0 0 0 5.5 4v4A2.5 2.5 0 0 0 8 10.5ZM3.5 8A4.5 4.5 0 0 0 12.5 8M8 12.5V15m-2 0h4"/>
          </svg>
          <svg id="pause-icon" viewBox="0 0 16 16" aria-hidden="true" hidden>
            <rect x="4" y="3.5" width="3" height="9" rx="0.75" fill="currentColor"/>
            <rect x="9" y="3.5" width="3" height="9" rx="0.75" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="status" id="status" role="status" aria-live="polite">Ready</div>
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
    const audioVisualizer = document.getElementById('audio-visualizer');
    const recordControl = document.getElementById('record-control');
    const microphoneIcon = document.getElementById('microphone-icon');
    const pauseIcon = document.getElementById('pause-icon');
    let action = 'start';

    recordControl.addEventListener('click', () => {
      vscode.postMessage({ type: 'command', command: action });
    });

    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'state') {
        return;
      }

      statusElement.textContent = event.data.status;
      statusElement.classList.toggle('error', event.data.isError);

      if (event.data.canStop) {
        action = 'stop';
      } else if (event.data.canStart) {
        action = 'start';
      }

      const isRecording = action === 'stop';
      const isBusy = !event.data.canStart && !event.data.canStop;
      const audioLevel = isRecording
        ? Math.min(1, Math.max(0, Number(event.data.audioLevel) || 0))
        : 0;
      recordControl.disabled = isBusy;
      audioVisualizer.classList.toggle('active', isRecording);
      audioVisualizer.style.setProperty('--wave-1-scale', String(0.9 + audioLevel * 0.16));
      audioVisualizer.style.setProperty('--wave-2-scale', String(0.86 + audioLevel * 0.24));
      audioVisualizer.style.setProperty('--wave-3-scale', String(0.82 + audioLevel * 0.32));
      audioVisualizer.style.setProperty('--wave-opacity', String(0.08 + audioLevel * 0.48));
      recordControl.classList.toggle('recording', isRecording);
      recordControl.classList.toggle('busy', isBusy);
      recordControl.title = isRecording ? 'Stop Recording' : 'Start Recording';
      recordControl.setAttribute(
        'aria-label',
        isRecording ? 'Stop Recording' : 'Start Recording',
      );
      microphoneIcon.hidden = isRecording;
      pauseIcon.hidden = !isRecording;

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
