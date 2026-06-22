import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

import type { SpeechRecognitionState } from './SpeechRecognitionState';
import { WhisperRuntimeManager, type WhisperRuntime } from './WhisperRuntimeManager';

const READY_STATE: SpeechRecognitionState = {
  status: 'Ready',
  transcript: '',
  isError: false,
  canStart: true,
  canStop: false,
};

export class WhisperSpeechRecognitionService implements vscode.Disposable {
  private readonly stateEmitter = new vscode.EventEmitter<SpeechRecognitionState>();
  private readonly runtimeManager: WhisperRuntimeManager;
  private recorder: ChildProcessWithoutNullStreams | undefined;
  private transcriber: ChildProcessWithoutNullStreams | undefined;
  private state: SpeechRecognitionState = READY_STATE;
  private outputBuffer = '';
  private errorOutput = '';
  private recordingPath: string | undefined;
  private starting = false;

  public readonly onDidChangeState = this.stateEmitter.event;

  public constructor(
    private readonly storagePath: string,
    private readonly recorderScriptPath: string,
  ) {
    this.runtimeManager = new WhisperRuntimeManager(storagePath);
  }

  public get currentState(): SpeechRecognitionState {
    return this.state;
  }

  public start(): void {
    if (this.starting || this.recorder || this.transcriber) {
      return;
    }

    this.starting = true;
    this.updateState({
      status: 'Preparing local speech recognition...',
      transcript: '',
      isError: false,
      canStart: false,
      canStop: false,
    });
    void this.startRecording();
  }

  public stop(): void {
    if (!this.recorder) {
      this.updateState({
        status: 'Recording has not started.',
        isError: true,
        canStart: !this.starting && !this.transcriber,
        canStop: false,
      });
      return;
    }

    this.updateState({
      status: 'Stopping recording...',
      isError: false,
      canStart: false,
      canStop: false,
    });
    this.recorder.stdin.write('STOP\n');
  }

  public dispose(): void {
    this.recorder?.kill();
    this.transcriber?.kill();
    this.recorder = undefined;
    this.transcriber = undefined;
    this.stateEmitter.dispose();
  }

  private async startRecording(): Promise<void> {
    try {
      const runtime = await this.runtimeManager.ensureRuntime((status) => {
        this.updateState({ status });
      });
      const recordingsDirectory = path.join(this.storagePath, 'recordings');
      await mkdir(recordingsDirectory, { recursive: true });
      // The legacy Windows MCI recorder requires an 8.3-style basename even
      // though the containing directory may use a normal long Windows path.
      const recordingName = `r${Date.now().toString(36).slice(-7)}.wav`;
      this.recordingPath = path.join(recordingsDirectory, recordingName);
      this.launchRecorder(runtime, this.recordingPath);
    } catch (error) {
      this.fail(toErrorMessage(error));
    } finally {
      this.starting = false;
    }
  }

  private launchRecorder(runtime: WhisperRuntime, recordingPath: string): void {
    this.outputBuffer = '';
    this.errorOutput = '';
    const recorder = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        this.recorderScriptPath,
        '-OutputPath',
        recordingPath,
      ],
      { windowsHide: true },
    );
    this.recorder = recorder;
    recorder.stdout.setEncoding('utf8');
    recorder.stderr.setEncoding('utf8');
    recorder.stdout.on('data', (chunk: string) => this.handleRecorderOutput(chunk, runtime));
    recorder.stderr.on('data', (chunk: string) => {
      this.errorOutput += chunk;
    });
    recorder.on('error', (error) => this.fail(`Unable to start the microphone: ${error.message}`));
    recorder.on('exit', (code) => {
      if (this.recorder !== recorder) {
        return;
      }
      this.recorder = undefined;
      if (code !== 0) {
        this.fail(this.errorOutput.trim() || 'The microphone recorder stopped unexpectedly.');
      }
    });
  }

  private handleRecorderOutput(chunk: string, runtime: WhisperRuntime): void {
    this.outputBuffer += chunk;
    const lines = this.outputBuffer.split(/\r?\n/);
    this.outputBuffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === 'READY') {
        this.updateState({
          status: 'Recording...',
          isError: false,
          canStart: false,
          canStop: true,
        });
      } else if (line.startsWith('COMPLETE:')) {
        const recordingPath = decodeMessage(line.slice('COMPLETE:'.length));
        const recorder = this.recorder;
        this.recorder = undefined;
        recorder?.stdin.end();
        void this.transcribe(runtime, recordingPath);
      } else if (line.startsWith('ERROR:')) {
        this.fail(decodeMessage(line.slice('ERROR:'.length)) || 'Microphone recording failed.');
      }
    }
  }

  private async transcribe(runtime: WhisperRuntime, recordingPath: string): Promise<void> {
    this.updateState({
      status: 'Transcribing locally with Whisper...',
      isError: false,
      canStart: false,
      canStop: false,
    });
    const outputPath = `${recordingPath}.transcript`;
    this.errorOutput = '';

    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          runtime.executablePath,
          [
            '--model',
            runtime.modelPath,
            '--file',
            recordingPath,
            '--language',
            'en',
            '--output-txt',
            '--output-file',
            outputPath,
            '--no-timestamps',
            '--no-gpu',
            '--no-prints',
          ],
          { cwd: path.dirname(runtime.executablePath), windowsHide: true },
        );
        this.transcriber = child;
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk: string) => {
          this.errorOutput += chunk;
        });
        child.on('error', reject);
        child.on('exit', (code) => {
          this.transcriber = undefined;
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(this.errorOutput.trim() || `Whisper exited with code ${code}.`));
          }
        });
      });

      const transcript = (await readFile(`${outputPath}.txt`, 'utf8')).trim();
      this.updateState({
        status: 'Transcription complete.',
        transcript: transcript || 'No speech recognized.',
        isError: false,
        canStart: true,
        canStop: false,
      });
    } catch (error) {
      this.fail(toErrorMessage(error));
    } finally {
      await Promise.all([
        rm(recordingPath, { force: true }),
        rm(`${outputPath}.txt`, { force: true }),
      ]);
      this.recordingPath = undefined;
    }
  }

  private fail(message: string): void {
    this.starting = false;
    const recorder = this.recorder;
    const transcriber = this.transcriber;
    this.recorder = undefined;
    this.transcriber = undefined;
    recorder?.kill();
    transcriber?.kill();
    if (this.recordingPath) {
      void rm(this.recordingPath, { force: true });
      this.recordingPath = undefined;
    }
    this.updateState({
      status: message,
      isError: true,
      canStart: true,
      canStop: false,
    });
  }

  private updateState(update: Partial<SpeechRecognitionState>): void {
    this.state = { ...this.state, ...update };
    this.stateEmitter.fire(this.state);
  }
}

function decodeMessage(encodedMessage: string): string {
  try {
    return Buffer.from(encodedMessage, 'base64').toString('utf8').trim();
  } catch {
    return '';
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Local speech recognition failed.';
}
