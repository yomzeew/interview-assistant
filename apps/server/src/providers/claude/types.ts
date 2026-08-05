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
  }): Promise<LiveAnswerResult>;
}
