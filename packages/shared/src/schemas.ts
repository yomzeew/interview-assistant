import { z } from 'zod';

export const LanguageSchema = z.enum(['en', 'fr', 'es', 'de', 'pt', 'ar', 'yo', 'ig', 'ha']);

export const AnswerStyleSchema = z.enum([
  'concise',
  'star',
  'technical',
  'behavioural',
  'leadership',
  'system-design',
]);

export const ExperienceLevelSchema = z.enum([
  'junior',
  'mid-level',
  'senior',
  'lead',
  'principal',
]);

export const GeneratePracticeAnswerInputSchema = z.object({
  question: z.string().min(5).max(2000),
  role: z.string().min(2).max(200),
  experienceLevel: ExperienceLevelSchema,
  answerStyle: AnswerStyleSchema,
  technologies: z.array(z.string().max(50)).max(20).default([]),
  experienceNotes: z.string().max(3000).optional(),
});

export const GeneratePracticeAnswerOutputSchema = z.object({
  answer: z.string(),
  keyPoints: z.array(z.string()),
  missingDetails: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
});

export const GenerateFollowUpsInputSchema = z.object({
  question: z.string().min(5).max(2000),
  answer: z.string().min(5).max(5000),
  role: z.string().min(2).max(200),
});

export const ReviewAnswerInputSchema = z.object({
  question: z.string().min(5).max(2000),
  answer: z.string().min(5).max(5000),
  role: z.string().min(2).max(200),
  experienceLevel: ExperienceLevelSchema,
});

export const ReviewAnswerOutputSchema = z.object({
  feedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  score: z.number().int().min(0).max(10),
});

export const CreateSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  websocketToken: z.string(),
  websocketUrl: z.string().url(),
});

export const AppSettingsSchema = z.object({
  backendUrl: z.string().url(),
  spokenLanguage: LanguageSchema,
  targetLanguage: LanguageSchema,
  autoDetectLanguage: z.boolean(),
  fontSize: z.enum(['small', 'medium', 'large']),
  compactMode: z.boolean(),
  saveTranscriptsLocally: z.boolean(),
  audioRetentionDays: z.number().int().min(0).max(365),
  practiceDisclaimerAcknowledged: z.boolean(),
  privacyAccepted: z.boolean(),
});

export const LiveAnswerInputSchema = z.object({
  transcriptId: z.string(),
  question: z.string().min(5).max(2000),
  role: z.string().max(200).optional(),
});
