import * as vscode from 'vscode';

import { registerCommands } from './commands/registerCommands';
import { VIEW_IDS } from './config/viewIds';
import { WhisperSpeechRecognitionService } from './services/WhisperSpeechRecognitionService';
import { createStatusBarItem } from './ui/statusBar';
import { VoiceAssistantViewProvider } from './webview/VoiceAssistantViewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const viewProvider = new VoiceAssistantViewProvider();
  const viewRegistration = vscode.window.registerWebviewViewProvider(
    VIEW_IDS.sidebar,
    viewProvider,
    { webviewOptions: { retainContextWhenHidden: true } },
  );
  // VS Code webviews deny getUserMedia microphone permission, so recording is
  // performed by the extension host and transcription runs locally with Whisper.
  const speechRecognition = new WhisperSpeechRecognitionService(
    context.globalStorageUri.fsPath,
    context.asAbsolutePath('resources/windowsAudioRecorder.ps1'),
  );
  const commands = registerCommands(viewProvider, speechRecognition);
  const statusBarItem = createStatusBarItem();
  const stateSubscription = speechRecognition.onDidChangeState((state) => {
    viewProvider.showState(state);
  });

  context.subscriptions.push(
    viewProvider,
    viewRegistration,
    speechRecognition,
    stateSubscription,
    statusBarItem,
    ...commands,
  );
}

export function deactivate(): void {}
