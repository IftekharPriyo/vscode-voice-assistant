export interface SpeechRecognitionState {
  readonly status: string;
  readonly transcript: string;
  readonly isError: boolean;
  readonly canStart: boolean;
  readonly canStop: boolean;
}
