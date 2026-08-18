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

/**
 * A past project the candidate worked on.
 * The AI uses these as ready-made Action examples in STAR answers.
 */
export interface Project {
  id: string;
  /** Project / product name */
  name: string;
  /** Candidate's role on this project, e.g. "Lead Frontend Engineer" */
  role: string;
  /** Comma-separated technologies, e.g. "React, Node.js, PostgreSQL, AWS" */
  stack: string;
  /** 1-2 sentence description of what the project does */
  description: string;
  /** Concrete outcomes / impact — numbers are great, e.g. "Reduced latency by 40%, scaled to 3× traffic" */
  achievements: string;
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
   * AI provider for live answers and session summaries.
   * 'server-default' uses whatever AI_PROVIDER env var says.
   */
  aiProvider: 'server-default' | 'groq' | 'claude';
  /**
   * Transcription provider for this user's sessions.
   * 'server-default' uses whatever TRANSCRIPTION_PROVIDER env var says.
   * 'groq' / 'assemblyai' override that choice per session.
   */
  transcriptionProvider: 'server-default' | 'groq' | 'assemblyai';
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
  /**
   * Past projects to use as Action examples in STAR answers.
   * The AI will pick the most relevant project for each question.
   */
  projects: Project[];
  /**
   * Optional user-supplied Anthropic API key.
   * When set, takes precedence over the server's ANTHROPIC_API_KEY env var.
   * Stored locally in the extension — never logged by the server.
   */
  anthropicApiKey: string;
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
