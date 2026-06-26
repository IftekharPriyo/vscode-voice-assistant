import * as vscode from 'vscode';

import { COMMAND_IDS } from '../config/commandIds';
import { WhisperSpeechRecognitionService } from '../services/WhisperSpeechRecognitionService';
import { VoiceAssistantViewProvider } from '../webview/VoiceAssistantViewProvider';

export function registerCommands(
  viewProvider: VoiceAssistantViewProvider,
  speechRecognition: WhisperSpeechRecognitionService,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(COMMAND_IDS.openPanel, async () => {
      await viewProvider.open();
    }),
    vscode.commands.registerCommand(COMMAND_IDS.startRecording, async () => {
      await viewProvider.open();
      speechRecognition.start();
    }),
    vscode.commands.registerCommand(COMMAND_IDS.stopRecording, () => {
      speechRecognition.stop();
    }),
    vscode.commands.registerCommand(COMMAND_IDS.resetTranscript, () => {
      speechRecognition.resetTranscript();
    }),
    vscode.commands.registerCommand(COMMAND_IDS.copyTranscript, async () => {
      const transcript = speechRecognition.currentState.transcript.trim();
      if (!transcript) {
        return;
      }

      await vscode.env.clipboard.writeText(transcript);
      await vscode.window.showInformationMessage('Voice Assistant transcript copied.');
    }),
  ];
}
