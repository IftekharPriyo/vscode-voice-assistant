import { spawn } from 'node:child_process';
import { access, mkdir, rm } from 'node:fs/promises';
import * as path from 'node:path';

import { WHISPER_MODEL, WHISPER_RUNTIME_VERSION, WINDOWS_X64_RUNTIME } from '../config/whisperRuntime';
import { downloadFile } from '../utils/downloadFile';
import { calculateFileHash } from '../utils/fileHash';

export interface WhisperRuntime {
  readonly executablePath: string;
  readonly modelPath: string;
}

type ProgressReporter = (message: string) => void;

export class WhisperRuntimeManager {
  private provisioning: Promise<WhisperRuntime> | undefined;

  public constructor(private readonly storagePath: string) {}

  public ensureRuntime(reportProgress: ProgressReporter): Promise<WhisperRuntime> {
    this.provisioning ??= this.provisionRuntime(reportProgress).finally(() => {
      this.provisioning = undefined;
    });
    return this.provisioning;
  }

  private async provisionRuntime(reportProgress: ProgressReporter): Promise<WhisperRuntime> {
    if (process.platform !== 'win32' || process.arch !== 'x64') {
      throw new Error(
        `Local Whisper is not packaged yet for ${process.platform}-${process.arch}.`,
      );
    }

    await mkdir(this.storagePath, { recursive: true });
    const runtimeDirectory = path.join(this.storagePath, 'runtime', WHISPER_RUNTIME_VERSION);
    const executablePath = path.join(
      runtimeDirectory,
      WINDOWS_X64_RUNTIME.executableRelativePath,
    );

    if (!(await fileExists(executablePath))) {
      await this.installWindowsRuntime(runtimeDirectory, reportProgress);
    }

    const modelDirectory = path.join(this.storagePath, 'models');
    const modelPath = path.join(modelDirectory, WHISPER_MODEL.fileName);
    if (!(await fileExists(modelPath))) {
      reportProgress('Downloading Whisper base.en model...');
      await downloadFile(WHISPER_MODEL.url, modelPath, (percentage) => {
        reportProgress(
          percentage === undefined
            ? 'Downloading Whisper base.en model...'
            : `Downloading Whisper base.en model... ${percentage}%`,
        );
      });
      await this.verifyFile(modelPath, 'sha256', WHISPER_MODEL.sha256, 'Whisper model');
    }

    return { executablePath, modelPath };
  }

  private async installWindowsRuntime(
    runtimeDirectory: string,
    reportProgress: ProgressReporter,
  ): Promise<void> {
    await rm(runtimeDirectory, { recursive: true, force: true });
    await mkdir(runtimeDirectory, { recursive: true });
    const archivePath = path.join(this.storagePath, WINDOWS_X64_RUNTIME.archiveName);

    reportProgress('Downloading local Whisper runtime...');
    await downloadFile(WINDOWS_X64_RUNTIME.url, archivePath, (percentage) => {
      reportProgress(
        percentage === undefined
          ? 'Downloading local Whisper runtime...'
          : `Downloading local Whisper runtime... ${percentage}%`,
      );
    });

    await this.verifyFile(
      archivePath,
      'sha256',
      WINDOWS_X64_RUNTIME.sha256,
      'Whisper runtime',
    );
    reportProgress('Installing local Whisper runtime...');
    await runProcess('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -LiteralPath '${escapePowerShellLiteral(archivePath)}' ` +
        `-DestinationPath '${escapePowerShellLiteral(runtimeDirectory)}' -Force`,
    ]);
    await rm(archivePath, { force: true });
  }

  private async verifyFile(
    filePath: string,
    algorithm: 'sha1' | 'sha256',
    expectedHash: string,
    label: string,
  ): Promise<void> {
    const actualHash = await calculateFileHash(filePath, algorithm);
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      await rm(filePath, { force: true });
      throw new Error(`${label} failed its integrity check. Please try again.`);
    }
  }
}

function escapePowerShellLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let errorOutput = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      errorOutput += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(errorOutput.trim() || `${command} exited with code ${code}.`));
      }
    });
  });
}
