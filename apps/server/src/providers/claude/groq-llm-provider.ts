/**
 * Groq LLM provider — free tier using LLaMA 3.
 * Implements the same LiveAnswerProvider + PracticeCoachProvider interfaces as Claude.
 * Get a free key at https://console.groq.com
 */
import { logger } from '../../utils/logger.js';
import type { PracticeCoachProvider, LiveAnswerProvider, SummaryProvider, SessionSummaryInput } from './types.js';
import type {
  GeneratePracticeAnswerInput,
  GeneratePracticeAnswerOutput,
  ReviewPracticeAnswerInput,
  ReviewPracticeAnswerOutput,
  LiveAnswerResult,
} from '@ica/shared';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Best available Groq production LLM as of 2026 — 120B, 500 t/s */
const MODEL = 'openai/gpt-oss-120b';

function buildContext(input: {
  userProfile?: string; jobDescription?: string;
  jobEssentials?: string; skillsRequired?: string; cvText?: string; interviewData?: string;
  projectsContext?: string;
}): string {
  const parts: string[] = [];
  if (input.userProfile)      parts.push(`## Candidate Background\n${input.userProfile}`);
  if (input.cvText)           parts.push(`## CV / Resume\n${input.cvText.slice(0, 3000)}`);
  if (input.projectsContext)  parts.push(`## Past Projects — Pick the most relevant one as the Action in your STAR answer\n${input.projectsContext}`);
  if (input.jobDescription)   parts.push(`## Job Description\n${input.jobDescription.slice(0, 1500)}`);
  if (input.jobEssentials)    parts.push(`## Key Job Essentials\n${input.jobEssentials}`);
  if (input.skillsRequired)   parts.push(`## Required Skills\n${input.skillsRequired}`);
  if (input.interviewData)    parts.push(`## Interview Preparation Notes & Example Answers\nUse these as a reference to understand how the candidate likes to answer questions. Mirror their style and examples.\n${input.interviewData.slice(0, 4000)}`);
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

async function chat(
  apiKey: string,
  system: string,
  user: string,
  maxTokens = 1024
): Promise<string> {
  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Groq LLM HTTP ${res.status}: ${body}`);

  const json = JSON.parse(body) as {
    choices: { message: { content: string } }[];
  };
  return json.choices[0]?.message?.content ?? '';
}

export class GroqLLMProvider implements LiveAnswerProvider, PracticeCoachProvider, SummaryProvider {
  constructor(private readonly apiKey: string) {}

  // ── Live Captions ────────────────────────────────────────────────────────────
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
    dislikedAnswerPatterns?: string;
    projectsContext?: string;
  }): Promise<LiveAnswerResult> {
    const contextBlock = buildContext(input);
    const dislikedBlock = input.dislikedAnswerPatterns
      ? `\n\nCANDIDATE FEEDBACK — the candidate rated these answer styles negatively. Avoid them:\n${input.dislikedAnswerPatterns}`
      : '';

    const system = `You are a real-time interview coach helping a candidate answer questions live.

RULES — follow every one strictly:
1. Use the STAR method: Situation → Task → Action → Result.
2. ALWAYS pull real examples from the candidate's CV, interview prep data, or background below. Never invent experience.
3. If a matching example exists in the data, use it verbatim (names, numbers, technologies). If no good match exists, use a placeholder like [mention your most relevant project here].
4. Keep the answer speakable in under 60 seconds — concise but complete.
5. Write in first person as if the candidate is speaking ("I led…", "We built…", "My team…").
6. End with a concrete Result/impact wherever possible (numbers, percentages, outcomes).

${contextBlock}${dislikedBlock}

Return ONLY valid JSON — no markdown, no explanation:
{ "answer": "STAR-structured answer the candidate can speak aloud", "keyPoints": ["S: situation", "T: task", "A: action", "R: result"] }`;

    const roleCtx = input.role ? ` for a ${input.role} role` : '';

    try {
      const raw = await chat(
        this.apiKey,
        system,
        `Interview question${roleCtx}: ${input.question}`,
        800
      );
      const parsed = safeJson<{ answer: string; keyPoints: string[] }>(
        raw,
        { answer: raw, keyPoints: [] }
      );
      return {
        transcriptId: input.transcriptId,
        question: input.question,
        answer: parsed.answer,
        keyPoints: parsed.keyPoints,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Hard failures — throw so FallbackProvider can try Claude instead
      const isHardFailure =
        msg.includes('401') || msg.includes('invalid_api_key') ||  // bad key
        msg.includes('404') || msg.includes('does not exist') ||   // model removed
        msg.includes('GROQ_API_KEY') || msg.includes('required');  // not configured
      if (isHardFailure) {
        logger.error({ err }, 'Groq LLM hard failure — rethrowing for fallback');
        throw err;
      }
      // Soft failures (rate limit, transient) — return a failure marker so the UI can retry
      const reason = msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota')
        ? 'Groq rate limit hit — wait a moment and retry.'
        : `Groq error: ${msg.slice(0, 100)}`;
      logger.error({ err }, 'Groq LLM live answer error');
      return {
        transcriptId: input.transcriptId,
        question: input.question,
        answer: `⚠️ AI answer unavailable — ${reason}`,
        keyPoints: [],
      };
    }
  }

  // ── Practice Mode ────────────────────────────────────────────────────────────
  async generateAnswer(input: GeneratePracticeAnswerInput): Promise<GeneratePracticeAnswerOutput> {
    const system = `You are an expert interview coach helping a candidate prepare for a ${input.role} role.
Generate a structured interview answer using the ${input.answerStyle.toUpperCase()} method.
Do NOT invent experience the candidate hasn't mentioned. Use placeholders like [Insert relevant project] when needed.
Return ONLY a JSON object: { "answer": "string", "keyPoints": ["string"], "missingDetails": ["string"], "followUpQuestions": ["string"] }`;

    const raw = await chat(
      this.apiKey,
      system,
      `Question: ${input.question}\nRole: ${input.role}\nLevel: ${input.experienceLevel}\nTech: ${input.technologies.join(', ')}\n${input.experienceNotes ? `My experience: ${input.experienceNotes}` : ''}`,
      2048
    );
    return safeJson<GeneratePracticeAnswerOutput>(raw, {
      answer: raw,
      keyPoints: [],
      missingDetails: [],
      followUpQuestions: [],
    });
  }

  async reviewAnswer(input: ReviewPracticeAnswerInput): Promise<ReviewPracticeAnswerOutput> {
    const system = `You are an expert interview coach. Review the candidate's answer.
Return ONLY a JSON object: { "feedback": "string", "strengths": ["string"], "improvements": ["string"], "score": number }`;

    const raw = await chat(
      this.apiKey,
      system,
      `Question: ${input.question}\nRole: ${input.role} (${input.experienceLevel})\nAnswer: ${input.answer}`,
      1024
    );
    return safeJson<ReviewPracticeAnswerOutput>(raw, {
      feedback: raw,
      strengths: [],
      improvements: [],
      score: 5,
    });
  }

  async generateFollowUps(input: { question: string; answer: string; role: string }): Promise<string[]> {
    const raw = await chat(
      this.apiKey,
      'You are an expert interviewer. Generate 3-5 follow-up questions. Return a JSON array of strings only.',
      `Q: ${input.question}\nA: ${input.answer}\nRole: ${input.role}`,
      512
    );
    return safeJson<string[]>(raw, []);
  }

  async generateSessionSummary(input: SessionSummaryInput): Promise<string> {
    const minutes = Math.round(input.durationSeconds / 60);
    const qas = input.transcripts
      .filter((t) => t.isQuestion && t.answer)
      .map((t, i) => `### Q${i + 1}: ${t.text}\n**Answer given:** ${t.answer}${t.rating ? `\n*(Candidate rated: ${t.rating === 'good' ? '👍' : '👎'})*` : ''}`)
      .join('\n\n');

    const allQuestions = input.transcripts
      .filter((t) => t.isQuestion)
      .map((t) => `- ${t.text}`)
      .join('\n');

    const system = `You are an expert interview coach. Generate a structured post-interview summary in Markdown.

The summary must include these sections exactly:
1. **Session Overview** — duration, number of questions, overall impression
2. **Questions Asked** — bullet list of every question detected
3. **Detailed Q&A Review** — for each question: what was said, key STAR points used, what was strong
4. **Topics Covered** — thematic grouping of the interview areas
5. **Gaps & Preparation Priorities** — specific areas to prepare for next time, ranked by importance
6. **Suggested Practice Questions** — 3-5 follow-up questions the interviewer might ask next round

Be specific, actionable, and honest. Use the candidate's actual answers to identify strengths and weaknesses.`;

    const user = `Interview duration: ${minutes} minutes
${input.jobDescription ? `Job: ${input.jobDescription.slice(0, 500)}` : ''}
${input.userProfile ? `Candidate: ${input.userProfile}` : ''}

All questions detected:
${allQuestions}

Questions with answers:
${qas || '(No AI answers were generated this session)'}`;

    try {
      return await chat(this.apiKey, system, user, 2000);
    } catch (err) {
      logger.error({ err }, 'Groq: generateSessionSummary failed');
      return `# Interview Summary\n\n*Summary generation failed. Here are the questions that were detected:*\n\n${allQuestions}`;
    }
  }
}
