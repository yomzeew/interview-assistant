// ─── Core domain types ────────────────────────────────────────────────────────

export type Language =
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'pt'
  | 'ar'
  | 'yo'
  | 'ig'
  | 'ha';

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  pt: 'Portuguese',
  ar: 'Arabic',
  yo: 'Yoruba',
  ig: 'Igbo',
  ha: 'Hausa',
};

export type AnswerStyle =
  | 'concise'
  | 'star'
  | 'technical'
  | 'behavioural'
  | 'leadership'
  | 'system-design';

export type ExperienceLevel = 'junior' | 'mid-level' | 'senior' | 'lead' | 'principal';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'paused' | 'error' | 'disconnected';

export interface TranscriptSegment {
  id: string;
  text: string;
  startedAt: number;
  endedAt?: number;
  isPartial: boolean;
  isQuestion: boolean;
  /** Confidence score [0, 1] from question detector */
  confidence?: number;
  /** Speaker label from diarization, e.g. "Speaker 1" */
  speakerLabel?: string;
}

export interface TranslationResult {
  transcriptId: string;
  text: string;
  language: Language;
  detectedLanguage?: Language;
}

export interface SessionInfo {
  sessionId: string;
  startTime: number;
  endTime?: number;
  meetingTitle?: string;
  sourceTabId?: number;
  spokenLanguage: Language;
  targetLanguage: Language;
  connectionState: ConnectionState;
}

export interface SavedQuestion {
  id: string;
  transcriptId?: string;
  text: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  backendUrl: string;
  spokenLanguage: Language;
  targetLanguage: Language;
  autoDetectLanguage: boolean;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  saveTranscriptsLocally: boolean;
  audioRetentionDays: number;
  practiceDisclaimerAcknowledged: boolean;
  privacyAccepted: boolean;
  /** Who you are — e.g. "Software developer, 8 years experience in React and Node.js" */
  userProfile: string;
  /** Paste the job description you're interviewing for */
  jobDescription: string;
  /** Key essentials the role requires */
  jobEssentials: string;
  /** Comma-separated skills the role requires */
  skillsRequired: string;
  /** Extracted text from uploaded CV */
  cvText: string;
  /** Interview preparation notes / example Q&A uploaded as .txt */
  interviewData: string;
  /**
   * Minimum confidence [0–1] for a transcript to be treated as a question.
   * Segments below this score are shown without AI answers.
   * Default 0.65 (tier 4 behavioral patterns).
   */
  questionConfidenceThreshold: number;
  /**
   * Speaker label to exclude from question detection (e.g. "Speaker 2" if that
   * is the candidate's own voice echoing back in a panel). Empty = no filter.
   */
  excludedSpeaker: string;
}

export interface GeneratePracticeAnswerInput {
  question: string;
  role: string;
  experienceLevel: ExperienceLevel;
  answerStyle: AnswerStyle;
  technologies: string[];
  experienceNotes?: string;
}

export interface GeneratePracticeAnswerOutput {
  answer: string;
  keyPoints: string[];
  missingDetails: string[];
  followUpQuestions: string[];
}

export interface ReviewPracticeAnswerInput {
  question: string;
  answer: string;
  role: string;
  experienceLevel: ExperienceLevel;
}

export interface ReviewPracticeAnswerOutput {
  feedback: string;
  strengths: string[];
  improvements: string[];
  score: number;
}

export interface LiveAnswerResult {
  transcriptId: string;
  question: string;
  answer: string;
  keyPoints: string[];
}

export interface UserContext {
  userProfile?: string;
  jobDescription?: string;
}
