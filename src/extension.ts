import * as vscode from 'vscode';

import { registerCommands } from './commands/registerCommands';
import { WhisperSpeechRecognitionService } from './services/WhisperSpeechRecognitionService';
import { createStatusBarItem } from './ui/statusBar';
import { VoiceAssistantPanel } from './webview/VoiceAssistantPanel';

export function activate(context: vscode.ExtensionContext): void {
  const panel = new VoiceAssistantPanel();
  // VS Code webviews deny getUserMedia microphone permission, so recording is
  // performed by the extension host and transcription runs locally with Whisper.
  const speechRecognition = new WhisperSpeechRecognitionService(
    context.globalStorageUri.fsPath,
    context.asAbsolutePath('resources/windowsAudioRecorder.ps1'),
  );
  const commands = registerCommands(panel, speechRecognition);
  const statusBarItem = createStatusBarItem();
  const stateSubscription = speechRecognition.onDidChangeState((state) => {
    panel.showState(state);
  });

  context.subscriptions.push(
    panel,
    speechRecognition,
    stateSubscription,
    statusBarItem,
    ...commands,
  );
}

export function deactivate(): void {}
