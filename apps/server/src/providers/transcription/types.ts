export interface PartialTranscriptEvent {
  id: string;
  text: string;
  startedAt: number;
}

export interface FinalTranscriptEvent {
  id: string;
  text: string;
  startedAt: number;
  endedAt: number;
  isQuestion: boolean;
}

export interface TranscriptionSession {
  sendAudio(chunk: Buffer): Promise<void>;
  close(): Promise<void>;
  onPartial(callback: (event: PartialTranscriptEvent) => void): void;
  onFinal(callback: (event: FinalTranscriptEvent) => void): void;
}

export interface TranscriptionProvider {
  createSession(options: {
    language?: string;
    sampleRate: number;
  }): Promise<TranscriptionSession>;
}
