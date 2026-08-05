import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { PracticeCoachProvider, LiveAnswerProvider } from './types.js';
import type {
  GeneratePracticeAnswerInput,
  GeneratePracticeAnswerOutput,
  ReviewPracticeAnswerInput,
  ReviewPracticeAnswerOutput,
  LiveAnswerResult,
} from '@ica/shared';

function buildContext(input: {
  userProfile?: string; jobDescription?: string;
  jobEssentials?: string; skillsRequired?: string; cvText?: string; interviewData?: string;
}): string {
  const parts: string[] = [];
  if (input.userProfile)    parts.push(`## Candidate Ba0ckground\n${input.userProfile}`);
  if (input.cvText)         parts.push(`## CV / Resume\n${input.cvText.slice(0, 3000)}`);
  if (input.jobDescription) parts.push(`## Job Description\n${input.jobDescription.slice(0, 1500)}`);
  if (input.jobEssentials)  parts.push(`## Key Job Essentials\n${input.jobEssentials}`);
  if (input.skillsRequired) parts.push(`## Required Skills\n${input.skillsRequired}`);
  if (input.interviewData)  parts.push(`## Interview Preparation Notes & Example Answers\nUse these as a reference to understand how the candidate likes to answer questions. Mirror their style and examples.\n${input.interviewData.slice(0, 4000)}`);
  return parts.join('\n\n');
}

function safeJson<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
    return JSON.parse(match[1] ?? text) as T;
  } catch {
    return fallback;
  }
}

export class ClaudeProvider implements PracticeCoachProvider, LiveAnswerProvider {
  private readonly client: Anthropic;

  constructor() {
    if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  // ── Practice Mode ──────────────────────────────────────────────────────────
  async generateAnswer(input: GeneratePracticeAnswerInput): Promise<GeneratePracticeAnswerOutput> {
    const systemPrompt = `You are an expert interview coach helping a candidate prepare for a ${input.role} role.
Generate a structured interview answer using the ${input.answerStyle.toUpperCase()} style.

IMPORTANT RULES:
- Do NOT invent experience the candidate hasn't mentioned.
- When relevant experience is missing, use placeholders like:
  [Insert a relevant project], [Add a measurable result], [Describe your personal contribution]
- Return ONLY a JSON object matching this schema:
{
  "answer": "string",
  "keyPoints": ["string"],
  "missingDetails": ["string"],
  "followUpQuestions": ["string"]
}`;

    const userMessage = `Question: ${input.question}
Role: ${input.role}
Experience Level: ${input.experienceLevel}
Technologies: ${input.technologies.join(', ')}
${input.experienceNotes ? `My Experience: ${input.experienceNotes}` : '(No personal experience notes provided)'}`;

    try {
      const response = await this.client.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return safeJson<GeneratePracticeAnswerOutput>(text, {
        answer: text,
        keyPoints: [],
        missingDetails: [],
        followUpQuestions: [],
      });
    } catch (err) {
      logger.error({ err }, 'Claude generateAnswer error');
      throw err;
    }
  }

  async reviewAnswer(input: ReviewPracticeAnswerInput): Promise<ReviewPracticeAnswerOutput> {
    const systemPrompt = `You are an expert interview coach. Review the candidate's answer to the interview question.
Return ONLY a JSON object:
{
  "feedback": "string",
  "strengths": ["string"],
  "improvements": ["string"],
  "score": number (0-10)
}`;

    const userMessage = `Question: ${input.question}
Role: ${input.role} (${input.experienceLevel})
Candidate's Answer: ${input.answer}`;

    const response = await this.client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return safeJson<ReviewPracticeAnswerOutput>(text, {
      feedback: text,
      strengths: [],
      improvements: [],
      score: 5,
    });
  }

  async generateFollowUps(input: { question: string; answer: string; role: string }): Promise<string[]> {
    const response = await this.client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 512,
      system: 'You are an expert interviewer. Generate 3–5 follow-up questions based on the candidate answer. Return a JSON array of strings only.',
      messages: [{ role: 'user', content: `Q: ${input.question}\nA: ${input.answer}\nRole: ${input.role}` }],
    });
    const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
    return safeJson<string[]>(text, []);
  }

  // ── Live Captions: Answer detected questions in real time ──────────────────
  async answerQuestion(input: {
    transcriptId: string;
    question: string;
    role?: string;
    userProfile?: string;
    jobDescription?: string;
    jobEssentials?: string;
    skillsRequired?: string;
    cvText?: string;
    interviewData?: string;
  }): Promise<LiveAnswerResult> {
    const contextBlock = buildContext(input);

    const systemPrompt = `You are a real-time interview coach helping a candidate answer questions live.

RULES — follow every one strictly:
1. Use the STAR method: Situation → Task → Action → Result.
2. ALWAYS pull real examples from the candidate's CV, interview prep data, or background below. Never invent experience.
3. If a matching example exists in the data, use it verbatim (names, numbers, technologies). If no good match exists, use a placeholder like [mention your most relevant project here].
4. Keep the answer speakable in under 60 seconds — concise but complete.
5. Write in first person as if the candidate is speaking ("I led…", "We built…", "My team…").
6. End with a concrete Result/impact wherever possible (numbers, percentages, outcomes).

${contextBlock}

Return ONLY valid JSON — no markdown, no explanation:
{
  "answer": "STAR-structured answer the candidate can speak aloud",
  "keyPoints": ["S: one-line situation", "T: one-line task", "A: one-line action", "R: one-line result"]
}`;

    const question = input.question;
    const roleCtx = input.role ? ` for a ${input.role} role` : '';

    try {
      const response = await this.client.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Interview question${roleCtx}: ${question}` }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const parsed = safeJson<{ answer: string; keyPoints: string[] }>(text, { answer: text, keyPoints: [] });

      return {
        transcriptId: input.transcriptId,
        question,
        answer: parsed.answer,
        keyPoints: parsed.keyPoints,
      };
    } catch (err: unknown) {
      // Gracefully degrade when API credits are exhausted or key is invalid
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('credit balance') || msg.includes('invalid_api_key') || msg.includes('401') || msg.includes('400')) {
        logger.warn('Claude API unavailable (credits/key issue) — returning placeholder answer');
        return {
          transcriptId: input.transcriptId,
          question,
          answer: '⚠️ Claude AI unavailable — add credits at console.anthropic.com/settings/billing to enable live answers.',
          keyPoints: ['Top up Anthropic credits to enable AI-powered answers'],
        };
      }
      throw err;
    }
  }
}
