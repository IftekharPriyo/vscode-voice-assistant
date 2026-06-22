import * as vscode from 'vscode';

import { COMMAND_IDS } from '../config/commandIds';
import type { SpeechRecognitionState } from '../services/SpeechRecognitionState';
import { getWebviewContent } from './webviewContent';

type WebviewMessage =
  | { readonly type: 'ready' }
  | { readonly type: 'command'; readonly command: 'start' | 'stop' };

export class VoiceAssistantPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private webviewReady = false;
  private state: SpeechRecognitionState = {
    status: 'Ready',
    transcript: '',
    isError: false,
    canStart: true,
    canStop: false,
  };
  private readonly disposables: vscode.Disposable[] = [];

  public open(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'voiceAssistant.panel',
      'VS Code Voice Assistant',
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    this.panel = panel;
    this.webviewReady = false;
    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(
      async (message: unknown) => {
        const webviewMessage = this.parseMessage(message);
        if (!webviewMessage) {
          return;
        }

        if (webviewMessage.type === 'ready') {
          this.webviewReady = true;
          await this.postState();
          return;
        }

        const command =
          webviewMessage.command === 'start'
            ? COMMAND_IDS.startRecording
            : COMMAND_IDS.stopRecording;
        await vscode.commands.executeCommand(command);
      },
      undefined,
      this.disposables,
    );

    panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.webviewReady = false;
      },
      undefined,
      this.disposables,
    );
  }

  public showState(state: SpeechRecognitionState): void {
    this.state = state;
    this.open();
    void this.postState();
  }

  public dispose(): void {
    this.panel?.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async postState(): Promise<void> {
    if (!this.panel || !this.webviewReady) {
      return;
    }

    await this.panel.webview.postMessage({ type: 'state', ...this.state });
  }

  private parseMessage(message: unknown): WebviewMessage | undefined {
    if (typeof message !== 'object' || message === null || !('type' in message)) {
      return undefined;
    }

    const candidate = message as { type: unknown; command?: unknown };
    if (candidate.type === 'ready') {
      return { type: 'ready' };
    }

    if (
      candidate.type === 'command' &&
      (candidate.command === 'start' || candidate.command === 'stop')
    ) {
      return { type: 'command', command: candidate.command };
    }

    return undefined;
  }
}
