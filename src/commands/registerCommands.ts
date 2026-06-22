import * as vscode from 'vscode';

import { COMMAND_IDS } from '../config/commandIds';
import { WhisperSpeechRecognitionService } from '../services/WhisperSpeechRecognitionService';
import { VoiceAssistantPanel } from '../webview/VoiceAssistantPanel';

export function registerCommands(
  panel: VoiceAssistantPanel,
  speechRecognition: WhisperSpeechRecognitionService,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(COMMAND_IDS.openPanel, () => {
      panel.open();
    }),
    vscode.commands.registerCommand(COMMAND_IDS.startRecording, () => {
      panel.open();
      speechRecognition.start();
    }),
    vscode.commands.registerCommand(COMMAND_IDS.stopRecording, () => {
      speechRecognition.stop();
    }),
  ];
}
