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
  /** Confidence score [0, 1] from question detector */
  confidence: number;
  /** Speaker label assigned by diarization (e.g. "Speaker 1") */
  speakerLabel?: string;
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
