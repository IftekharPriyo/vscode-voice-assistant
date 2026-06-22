import * as vscode from 'vscode';

import { COMMAND_IDS } from '../config/commandIds';

export function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.text = '$(mic) Voice Assistant';
  item.tooltip = 'Open VS Code Voice Assistant';
  item.command = COMMAND_IDS.openPanel;
  item.show();
  return item;
}
