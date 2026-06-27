import { spawn } from 'node:child_process';
import { access, chmod, mkdir, rm } from 'node:fs/promises';
import * as path from 'node:path';

import {
  MACOS_RECORDER,
  MACOS_WHISPER_RUNTIMES,
  WHISPER_MODEL,
  WHISPER_RUNTIME_VERSION,
  WINDOWS_X64_RUNTIME,
} from '../config/whisperRuntime';
import { downloadFile } from '../utils/downloadFile';
import { calculateFileHash } from '../utils/fileHash';

export interface WhisperRuntime {
  readonly executablePath: string;
  readonly modelPath: string;
  readonly recorderPath?: string;
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
    const isWindows = process.platform === 'win32' && process.arch === 'x64';
    const isMac = process.platform === 'darwin' && (process.arch === 'arm64' || process.arch === 'x64');
    if (!isWindows && !isMac) {
      throw new Error(
        `Local Whisper is not packaged yet for ${process.platform}-${process.arch}.`,
      );
    }

    await mkdir(this.storagePath, { recursive: true });
    const runtimeDirectory = path.join(
      this.storagePath,
      'runtime',
      isWindows ? WHISPER_RUNTIME_VERSION : `macos-${MACOS_WHISPER_RUNTIMES.version}-${process.arch}`,
    );
    const executablePath = isWindows
      ? path.join(runtimeDirectory, WINDOWS_X64_RUNTIME.executableRelativePath)
      : path.join(runtimeDirectory, MACOS_WHISPER_RUNTIMES.executableRelativePath);
    let recorderPath: string | undefined;

    if (!(await fileExists(executablePath))) {
      if (isWindows) {
        await this.installWindowsRuntime(runtimeDirectory, reportProgress);
      } else {
        await this.installMacWhisperRuntime(runtimeDirectory, reportProgress);
      }
    }

    if (isMac) {
      recorderPath = path.join(
        this.storagePath,
        'recorders',
        `decibri-${MACOS_RECORDER.version}`,
        MACOS_RECORDER.executableRelativePath,
      );
      if (!(await fileExists(recorderPath))) {
        await this.installMacRecorder(path.dirname(recorderPath), reportProgress);
      }
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

    return { executablePath, modelPath, recorderPath };
  }

  private async installMacWhisperRuntime(
    runtimeDirectory: string,
    reportProgress: ProgressReporter,
  ): Promise<void> {
    const architecture = process.arch as 'arm64' | 'x64';
    const runtime = MACOS_WHISPER_RUNTIMES[architecture];
    await rm(runtimeDirectory, { recursive: true, force: true });
    await mkdir(runtimeDirectory, { recursive: true });
    const archivePath = path.join(this.storagePath, runtime.archiveName);
    reportProgress('Downloading macOS Whisper runtime...');
    await downloadFile(runtime.url, archivePath, (percentage) => {
      reportProgress(`Downloading macOS Whisper runtime...${percentage === undefined ? '' : ` ${percentage}%`}`);
    });
    await this.verifyFile(archivePath, 'sha256', runtime.sha256, 'macOS Whisper runtime');
    reportProgress('Installing macOS Whisper runtime...');
    await runProcess('/usr/bin/ditto', ['-x', '-k', archivePath, runtimeDirectory]);
    await chmod(path.join(runtimeDirectory, MACOS_WHISPER_RUNTIMES.executableRelativePath), 0o755);
    await rm(archivePath, { force: true });
  }

  private async installMacRecorder(
    recorderDirectory: string,
    reportProgress: ProgressReporter,
  ): Promise<void> {
    await rm(recorderDirectory, { recursive: true, force: true });
    await mkdir(recorderDirectory, { recursive: true });
    const archivePath = path.join(this.storagePath, MACOS_RECORDER.archiveName);
    reportProgress('Downloading macOS microphone recorder...');
    await downloadFile(MACOS_RECORDER.url, archivePath, (percentage) => {
      reportProgress(`Downloading macOS microphone recorder...${percentage === undefined ? '' : ` ${percentage}%`}`);
    });
    await this.verifyFile(archivePath, 'sha256', MACOS_RECORDER.sha256, 'macOS microphone recorder');
    reportProgress('Installing macOS microphone recorder...');
    await runProcess('/usr/bin/tar', ['-xzf', archivePath, '-C', recorderDirectory]);
    await chmod(path.join(recorderDirectory, MACOS_RECORDER.executableRelativePath), 0o755);
    await rm(archivePath, { force: true });
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
