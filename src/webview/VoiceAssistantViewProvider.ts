import * as vscode from 'vscode';

import { COMMAND_IDS } from '../config/commandIds';
import { VIEW_IDS } from '../config/viewIds';
import type { SpeechRecognitionState } from '../services/SpeechRecognitionState';
import { getWebviewContent } from './webviewContent';

type WebviewMessage =
  | { readonly type: 'ready' }
  | {
      readonly type: 'command';
      readonly command: 'start' | 'stop' | 'reset' | 'copy';
    };

export class VoiceAssistantViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  private view: vscode.WebviewView | undefined;
  private webviewReady = false;
  private state: SpeechRecognitionState = {
    status: 'Ready',
    transcript: '',
    audioLevel: 0,
    isError: false,
    canStart: true,
    canStop: false,
  };
  private readonly disposables: vscode.Disposable[] = [];

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.webviewReady = false;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getWebviewContent();

    webviewView.webview.onDidReceiveMessage(
      async (message: unknown) => {
        const webviewMessage = parseMessage(message);
        if (!webviewMessage) {
          return;
        }

        if (webviewMessage.type === 'ready') {
          this.webviewReady = true;
          await this.postState();
          return;
        }

        const command = {
          start: COMMAND_IDS.startRecording,
          stop: COMMAND_IDS.stopRecording,
          reset: COMMAND_IDS.resetTranscript,
          copy: COMMAND_IDS.copyTranscript,
        }[webviewMessage.command];
        await vscode.commands.executeCommand(command);
      },
      undefined,
      this.disposables,
    );

    webviewView.onDidDispose(
      () => {
        if (this.view === webviewView) {
          this.view = undefined;
          this.webviewReady = false;
        }
      },
      undefined,
      this.disposables,
    );
  }

  public async open(): Promise<void> {
    await vscode.commands.executeCommand(`${VIEW_IDS.sidebar}.focus`);
  }

  public showState(state: SpeechRecognitionState): void {
    this.state = state;
    void this.postState();
  }

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async postState(): Promise<void> {
    if (!this.view || !this.webviewReady) {
      return;
    }

    await this.view.webview.postMessage({ type: 'state', ...this.state });
  }
}

function parseMessage(message: unknown): WebviewMessage | undefined {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return undefined;
  }

  const candidate = message as { type: unknown; command?: unknown };
  if (candidate.type === 'ready') {
    return { type: 'ready' };
  }

  if (
    candidate.type === 'command' &&
    (candidate.command === 'start' ||
      candidate.command === 'stop' ||
      candidate.command === 'reset' ||
      candidate.command === 'copy')
  ) {
    return { type: 'command', command: candidate.command };
  }

  return undefined;
}
