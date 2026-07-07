import * as vscode from 'vscode';

export type TerminalSendResult = 'sent' | 'no-active-terminal';

/**
 * Sends voice transcripts to the currently active VS Code terminal.
 *
 * The text is inserted without submitting Enter. This keeps the feature useful
 * for Codex, Claude, Bash, PowerShell, CMD, REPLs, and other CLIs while avoiding
 * accidental command execution from imperfect speech recognition.
 */
export class ActiveTerminalService {
  public sendToActiveTerminal(transcript: string): TerminalSendResult {
    const activeTerminal = vscode.window.activeTerminal;
    const trimmedTranscript = transcript.trim();

    if (!activeTerminal) {
      return 'no-active-terminal';
    }

    if (!trimmedTranscript) {
      return 'sent';
    }

    activeTerminal.show(false);
    activeTerminal.sendText(trimmedTranscript, false);
    return 'sent';
  }
}
