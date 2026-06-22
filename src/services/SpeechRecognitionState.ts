export interface SpeechRecognitionState {
  readonly status: string;
  readonly transcript: string;
  readonly audioLevel: number;
  readonly isError: boolean;
  readonly canStart: boolean;
  readonly canStop: boolean;
}
