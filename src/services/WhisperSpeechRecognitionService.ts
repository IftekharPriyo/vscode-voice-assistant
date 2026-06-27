import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

import type { SpeechRecognitionState } from './SpeechRecognitionState';
import { WhisperRuntimeManager, type WhisperRuntime } from './WhisperRuntimeManager';

const READY_STATE: SpeechRecognitionState = {
  status: 'Ready',
  transcript: '',
  audioLevel: 0,
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
  private smoothedAudioLevel = 0;
  private macLevelTimer: NodeJS.Timeout | undefined;
  private macLevelOffset = 44;

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
    this.smoothedAudioLevel = 0;
    this.updateState({
      status: 'Preparing local speech recognition...',
      audioLevel: 0,
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
      audioLevel: 0,
      isError: false,
      canStart: false,
      canStop: false,
    });
    if (process.platform === 'darwin') {
      this.recorder.kill('SIGINT');
    } else {
      this.recorder.stdin.write('STOP\n');
    }
  }

  public resetTranscript(): void {
    this.updateState({ transcript: '' });
  }

  public dispose(): void {
    this.recorder?.kill();
    this.transcriber?.kill();
    this.recorder = undefined;
    this.transcriber = undefined;
    this.stopMacLevelMonitor();
    this.stateEmitter.dispose();
  }

  private async startRecording(): Promise<void> {
    try {
      const runtime = await this.runtimeManager.ensureRuntime((status) => {
        this.updateState({ status });
      });
      const recordingsDirectory = path.join(this.storagePath, 'recordings');
      await mkdir(recordingsDirectory, { recursive: true });
      const recordingName = `recording-${Date.now()}.wav`;
      this.recordingPath = path.join(recordingsDirectory, recordingName);
      this.launchRecorder(runtime, this.recordingPath);
    } catch (error) {
      this.fail(toErrorMessage(error));
    } finally {
      this.starting = false;
    }
  }

  private launchRecorder(runtime: WhisperRuntime, recordingPath: string): void {
    if (process.platform === 'darwin') {
      this.launchMacRecorder(runtime, recordingPath);
      return;
    }

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

  private launchMacRecorder(runtime: WhisperRuntime, recordingPath: string): void {
    if (!runtime.recorderPath) {
      throw new Error('The macOS microphone recorder is unavailable.');
    }

    this.errorOutput = '';
    const recorder = spawn(
      runtime.recorderPath,
      ['capture', '--output', recordingPath, '--rate', '16000', '--channels', '1', '--quiet'],
      { windowsHide: true },
    );
    this.recorder = recorder;
    recorder.stderr.setEncoding('utf8');
    recorder.stderr.on('data', (chunk: string) => {
      this.errorOutput += chunk;
    });
    recorder.on('spawn', () => {
      this.updateState({
        status: 'Recording...',
        isError: false,
        canStart: false,
        canStop: true,
      });
      this.startMacLevelMonitor(recordingPath);
    });
    recorder.on('error', (error) => {
      this.fail(`Unable to start the microphone: ${error.message}`);
    });
    recorder.on('exit', (code, signal) => {
      if (this.recorder !== recorder) {
        return;
      }
      this.recorder = undefined;
      this.stopMacLevelMonitor();
      // decibri finalizes the WAV after SIGINT. Some Node/macOS combinations
      // report the terminating signal even though the recording is complete.
      if (code === 0 || signal === 'SIGINT') {
        void this.transcribe(runtime, recordingPath);
      } else {
        const detail = this.errorOutput.trim();
        const permissionHint = /permission|denied|not authorized/i.test(detail)
          ? ' Allow Visual Studio Code microphone access in System Settings > Privacy & Security > Microphone.'
          : '';
        this.fail((detail || 'The microphone recorder stopped unexpectedly.') + permissionHint);
      }
    });
  }

  private startMacLevelMonitor(recordingPath: string): void {
    this.stopMacLevelMonitor();
    this.macLevelOffset = 44;
    let reading = false;
    this.macLevelTimer = setInterval(() => {
      if (reading) {
        return;
      }
      reading = true;
      void this.readMacAudioLevel(recordingPath).finally(() => {
        reading = false;
      });
    }, 120);
  }

  private async readMacAudioLevel(recordingPath: string): Promise<void> {
    let file;
    try {
      file = await open(recordingPath, 'r');
      const stats = await file.stat();
      const availableBytes = stats.size - this.macLevelOffset;
      if (availableBytes < 2) {
        return;
      }
      const bytesToRead = Math.min(availableBytes - (availableBytes % 2), 16_000);
      const buffer = Buffer.allocUnsafe(bytesToRead);
      const result = await file.read(buffer, 0, bytesToRead, this.macLevelOffset);
      this.macLevelOffset += result.bytesRead;
      let sumSquares = 0;
      const sampleCount = Math.floor(result.bytesRead / 2);
      for (let index = 0; index < sampleCount; index += 1) {
        const sample = buffer.readInt16LE(index * 2);
        sumSquares += sample * sample;
      }
      if (sampleCount > 0) {
        const rms = Math.sqrt(sumSquares / sampleCount);
        const targetLevel = normalizeAudioLevel(rms);
        const smoothing = targetLevel > this.smoothedAudioLevel ? 0.65 : 0.25;
        this.smoothedAudioLevel += (targetLevel - this.smoothedAudioLevel) * smoothing;
        this.updateState({ audioLevel: this.smoothedAudioLevel });
      }
    } catch {
      // The WAV may not exist until CoreAudio delivers its first buffer.
    } finally {
      await file?.close();
    }
  }

  private stopMacLevelMonitor(): void {
    if (this.macLevelTimer) {
      clearInterval(this.macLevelTimer);
      this.macLevelTimer = undefined;
    }
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
      } else if (line.startsWith('LEVEL:')) {
        const rawLevel = Number(line.slice('LEVEL:'.length));
        if (Number.isFinite(rawLevel)) {
          const targetLevel = normalizeAudioLevel(rawLevel);
          const smoothing = targetLevel > this.smoothedAudioLevel ? 0.65 : 0.25;
          this.smoothedAudioLevel +=
            (targetLevel - this.smoothedAudioLevel) * smoothing;
          this.updateState({ audioLevel: this.smoothedAudioLevel });
        }
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
      audioLevel: 0,
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
      const previousTranscript = this.state.transcript.trim();
      const accumulatedTranscript = transcript
        ? [previousTranscript, transcript].filter(Boolean).join('\n\n')
        : previousTranscript;
      this.updateState({
        status: transcript ? 'Transcription complete.' : 'No speech recognized.',
        transcript: accumulatedTranscript,
        audioLevel: 0,
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
    this.stopMacLevelMonitor();
    if (this.recordingPath) {
      void rm(this.recordingPath, { force: true });
      this.recordingPath = undefined;
    }
    this.updateState({
      status: message,
      audioLevel: 0,
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

function normalizeAudioLevel(rawLevel: number): number {
  // The recorder reports RMS amplitude from signed 16-bit PCM. Remove a small
  // noise floor, then use a square-root curve so normal speech remains lively
  // without making quiet room noise dominate the animation.
  const adjustedLevel = Math.max(0, Math.abs(rawLevel) - 12);
  return Math.min(1, Math.sqrt(adjustedLevel / 1800));
}
