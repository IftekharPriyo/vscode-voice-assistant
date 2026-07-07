import { spawn } from 'node:child_process';
import * as vscode from 'vscode';

interface ProcessInfo {
  readonly pid: number;
  readonly parentPid: number;
  readonly name: string;
  readonly commandLine: string;
}

/**
 * Sends voice transcripts to Codex CLI only when Codex is already running in
 * the active VS Code terminal. The extension does not start Codex by itself.
 */
export class CodexTerminalService {
  public async sendToActiveCodexTerminal(transcript: string): Promise<boolean> {
    const activeTerminal = vscode.window.activeTerminal;
    const trimmedTranscript = transcript.trim();

    if (!activeTerminal || !trimmedTranscript) {
      return false;
    }

    const terminalProcessId = await activeTerminal.processId;
    if (!terminalProcessId) {
      return false;
    }

    const codexIsRunning = await hasCodexDescendantProcess(terminalProcessId);
    if (!codexIsRunning) {
      return false;
    }

    activeTerminal.show(false);
    activeTerminal.sendText(trimmedTranscript, true);
    return true;
  }
}

async function hasCodexDescendantProcess(rootProcessId: number): Promise<boolean> {
  try {
    const processes =
      process.platform === 'win32'
        ? await getWindowsProcessTree(rootProcessId)
        : await getPosixProcesses();

    const descendants = getDescendants(processes, rootProcessId);
    if (descendants.some(isCodexCliProcess)) {
      return true;
    }

    // Git Bash on Windows can launch npm shell wrappers in a way that briefly
    // breaks the normal parent/child chain reported by WMI. If the active
    // terminal is Git Bash and a user Codex CLI process is running, allow the
    // transcript to be sent to the active terminal. VS Code still sends the text
    // to the selected terminal instance, so this remains scoped to user focus.
    return (
      process.platform === 'win32' &&
      isGitBashTerminal(processes, rootProcessId) &&
      processes.some(isCodexCliProcess)
    );
  } catch {
    // Process inspection can fail because of OS permissions or unavailable
    // platform tools. In that case, avoid sending anything automatically.
    return false;
  }
}

function getDescendants(processes: readonly ProcessInfo[], rootProcessId: number): ProcessInfo[] {
  const childrenByParent = new Map<number, ProcessInfo[]>();

  for (const processInfo of processes) {
    const children = childrenByParent.get(processInfo.parentPid) ?? [];
    children.push(processInfo);
    childrenByParent.set(processInfo.parentPid, children);
  }

  const descendants: ProcessInfo[] = [];
  const queue = [...(childrenByParent.get(rootProcessId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    descendants.push(current);
    queue.push(...(childrenByParent.get(current.pid) ?? []));
  }

  return descendants;
}

function isCodexCliProcess(processInfo: ProcessInfo): boolean {
  const normalizedName = processInfo.name.toLowerCase();
  const normalizedCommandLine = processInfo.commandLine.toLowerCase();

  if (normalizedCommandLine.includes(' app-server')) {
    return false;
  }

  return (
    normalizedName === 'codex' ||
    normalizedName === 'codex.exe' ||
    normalizedName === 'codex.cmd' ||
    normalizedName === 'codex.ps1' ||
    normalizedCommandLine.includes('@openai/codex/bin/codex.js') ||
    normalizedCommandLine.includes('node_modules/@openai/codex') ||
    /(^|[\\/:\s])codex(\.cmd|\.exe|\.js|\.ps1)?([\\/:\s]|$)/u.test(
      normalizedCommandLine,
    )
  );
}

function isGitBashTerminal(
  processes: readonly ProcessInfo[],
  rootProcessId: number,
): boolean {
  const rootProcess = processes.find((processInfo) => processInfo.pid === rootProcessId);
  const descendants = getDescendants(processes, rootProcessId);
  const candidates = rootProcess ? [rootProcess, ...descendants] : descendants;

  return candidates.some((processInfo) => {
    const normalizedName = processInfo.name.toLowerCase();
    const normalizedCommandLine = processInfo.commandLine.toLowerCase();

    return (
      normalizedName === 'bash.exe' ||
      normalizedName === 'sh.exe' ||
      normalizedCommandLine.includes('git\\bin\\bash.exe') ||
      normalizedCommandLine.includes('git/bin/bash') ||
      normalizedCommandLine.includes('shellintegration-bash.sh')
    );
  });
}

async function getWindowsProcessTree(rootProcessId: number): Promise<ProcessInfo[]> {
  const script = `
$processes = Get-CimInstance Win32_Process |
  Select-Object ProcessId, ParentProcessId, Name, CommandLine
$processes | ConvertTo-Json -Compress
`;

  const output = await runProcess('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script,
  ]);
  const parsed = JSON.parse(output || '[]') as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.flatMap((row) => {
    if (!isWindowsProcessRow(row)) {
      return [];
    }

    return {
      pid: row.ProcessId,
      parentPid: row.ParentProcessId,
      name: row.Name ?? '',
      commandLine: row.CommandLine ?? '',
    };
  });
}

async function getPosixProcesses(): Promise<ProcessInfo[]> {
  const output = await runProcess('ps', ['-eo', 'pid=,ppid=,comm=,args=']);
  const lines = output.split(/\r?\n/);

  return lines.flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/u.exec(line);
    if (!match) {
      return [];
    }

    const [, pid, parentPid, name, commandLine] = match;
    return {
      pid: Number(pid),
      parentPid: Number(parentPid),
      name: name ?? '',
      commandLine: commandLine ?? '',
    };
  });
}

function runProcess(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `${command} exited with code ${code}.`));
      }
    });
  });
}

function isWindowsProcessRow(row: unknown): row is {
  readonly ProcessId: number;
  readonly ParentProcessId: number;
  readonly Name?: string;
  readonly CommandLine?: string;
} {
  if (typeof row !== 'object' || row === null) {
    return false;
  }

  const candidate = row as {
    readonly ProcessId?: unknown;
    readonly ParentProcessId?: unknown;
  };

  return (
    typeof candidate.ProcessId === 'number' &&
    typeof candidate.ParentProcessId === 'number'
  );
}
