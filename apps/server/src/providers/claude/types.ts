import type {
  GeneratePracticeAnswerInput,
  GeneratePracticeAnswerOutput,
  ReviewPracticeAnswerInput,
  ReviewPracticeAnswerOutput,
  LiveAnswerResult,
} from '@ica/shared';

export interface PracticeCoachProvider {
  generateAnswer(input: GeneratePracticeAnswerInput): Promise<GeneratePracticeAnswerOutput>;
  reviewAnswer(input: ReviewPracticeAnswerInput): Promise<ReviewPracticeAnswerOutput>;
  generateFollowUps(input: { question: string; answer: string; role: string }): Promise<string[]>;
}

export interface LiveAnswerProvider {
  answerQuestion(input: {
    transcriptId: string;
    question: string;
    role?: string;
    userProfile?: string;
    jobDescription?: string;
    jobEssentials?: string;
    skillsRequired?: string;
    cvText?: string;
    interviewData?: string;
    dislikedAnswerPatterns?: string;
  }): Promise<LiveAnswerResult>;
}

export interface SessionSummaryInput {
  durationSeconds: number;
  jobDescription?: string;
  userProfile?: string;
  transcripts: Array<{
    text: string;
    isQuestion: boolean;
    speakerLabel?: string;
    answer?: string;
    keyPoints?: string[];
    rating?: 'good' | 'bad';
  }>;
}

export interface SummaryProvider {
  generateSessionSummary(input: SessionSummaryInput): Promise<string>;
}
