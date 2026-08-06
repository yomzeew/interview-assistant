/**
 * Detects whether a transcript segment is an interview question,
 * returning a confidence score in [0, 1] alongside the boolean result.
 *
 * Confidence tiers:
 *   0.95 — explicit question mark
 *   0.90 — strong interrogative starter (what/how/why + auxiliary patterns)
 *   0.80 — direct imperative opener (tell me, describe, explain…)
 *   0.75 — anywhere patterns: direct interrogatives embedded mid-sentence
 *   0.65 — anywhere patterns: behavioral / indirect / contextual
 *   0.55 — first-word-only heuristic (weak signal on its own)
 *
 * isQuestion is true when the highest-matching tier confidence ≥ 0.65.
 */

export interface QuestionDetectionResult {
  isQuestion: boolean;
  confidence: number;
}

// ── Tier 1 (0.90) — strong interrogative starters ────────────────────────────
const TIER1_START: RegExp[] = [
  /^(what|how|why|where|when|who|which|whose|whom)\b/i,
  /^(can|could|would|should|will|shall|may|might|must)\s+you\b/i,
  /^(do|does|did|have|has|had|is|are|was|were|am)\s+(you|your|the|a|an|it|they|we)\b/i,
  /^(are you|were you|did you|do you|have you)\b/i,
  /^(have you (ever|previously|before|worked|used|dealt|managed|led|built|designed|handled))/i,
];

// ── Tier 2 (0.80) — direct imperative / behavioural starters ─────────────────
const TIER2_START: RegExp[] = [
  /^(tell|talk|walk|take)\s+(me|us)\b/i,
  /^(describe|explain|define|discuss|share|give|outline|elaborate|summarise|summarize)\b/i,
  /^(think about|imagine|suppose|let's say|say you|assume)\b/i,
];

// ── Tier 3 (0.75) — direct interrogatives anywhere in the text ───────────────
const TIER3_ANYWHERE: RegExp[] = [
  /\bwhat (is|are|was|were|would|do|did|has|have|can|could|should|will|might)\b/i,
  /\bhow (do|did|would|have|has|can|could|will|might|should)\b/i,
  /\bwhy (did|do|would|have|has|are|were|is|was|should)\b/i,
  /\bhow would you\b/i,
  /\bhow have you\b/i,
  /\bwhat (are|were|would be) your\b/i,
  /\bwhat (is|was) your\b/i,
  /\bcan you (explain|describe|tell|walk|talk|share|give|outline|elaborate)\b/i,
  /\bcould you (explain|describe|tell|walk|talk|share|give|outline|elaborate)\b/i,
  /\bwould you (say|describe|consider|explain|mind|rate|call)\b/i,
  /\bdifference between\b/i,
  /\bwhere do you see\b/i,
  /\bhow (long|many|much|often|soon|far)\b/i,
  /\bwhy (are you|do you want|did you choose|did you apply|did you leave)\b/i,
  /\bwhat (do|did) you do when\b/i,
  /\bhow (do|did) you handle\b/i,
  /\bhow (do|did) you deal\b/i,
];

// ── Tier 4 (0.65) — behavioral, indirect, and contextual patterns ─────────────
const TIER4_ANYWHERE: RegExp[] = [
  /\btell (me|us) (about|more|a bit|a little|your|how|why|what|when|where)\b/i,
  /\bwalk (me|us) (through|about)\b/i,
  /\btalk (me|us) (through|about|more)\b/i,
  /\bgive (me|us) (an example|a sense|some insight|more detail|your|an overview)\b/i,
  /\bdescribe a time\b/i,
  /\bgive (me |us )?an example\b/i,
  /\bhave you ever\b/i,
  /\bi('d| would) (like to|love to|want to) (know|hear|understand|learn|ask)\b/i,
  /\bi('m| am) (curious|interested|wondering)\b/i,
  /\bwhat (motivates|drives|excites|challenges|interests) you\b/i,
  /\bstrengths? (and|or) weaknesses?\b/i,
  /\bgreatest (strength|weakness|achievement|challenge|accomplishment|failure)\b/i,
  /\btell (me|us) something\b/i,
  /\bsituation (where|when|in which)\b/i,
  /\bexperience (with|in|using|building|leading|managing)\b/i,
  /\bworked (with|on|at|in|for)\b/i,
  /\bfamiliar with\b/i,
  /\bwhat (brought|brings) you\b/i,
  /\btell us about yourself\b/i,
  /\bintroduce yourself\b/i,
  /\bbackground (in|with|and)\b/i,
  /\bwhat (kind of|type of|sort of) (work|projects?|experience|role|team)\b/i,
  /\bhow do you (approach|handle|deal|manage|prioritise|prioritize)\b/i,
  /\bwhat (would|do) you (do|say|think|consider|recommend) (if|when|in)\b/i,
  /\bcompare .{0,40} (with|to|and|vs)\b/i,
];

// ── Tier 5 (0.55) — first-word heuristic (weak signal) ───────────────────────
const QUESTION_FIRST_WORDS = new Set([
  'what', 'how', 'why', 'where', 'when', 'who', 'which', 'whose', 'whom',
  'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might',
  'do', 'does', 'did', 'have', 'has', 'had',
  'is', 'are', 'was', 'were', 'am',
  'tell', 'describe', 'explain', 'walk', 'talk', 'share', 'give', 'outline',
  'think', 'imagine', 'suppose', 'introduce',
]);

const QUESTION_THRESHOLD = 0.65;

export function detectQuestion(text: string): QuestionDetectionResult {
  const t = text.trim();
  if (!t) return { isQuestion: false, confidence: 0 };

  // Explicit question mark → highest confidence
  if (/\?/.test(t)) return { isQuestion: true, confidence: 0.95 };

  if (TIER1_START.some((p) => p.test(t))) return { isQuestion: true, confidence: 0.90 };
  if (TIER2_START.some((p) => p.test(t))) return { isQuestion: true, confidence: 0.80 };
  if (TIER3_ANYWHERE.some((p) => p.test(t))) return { isQuestion: true, confidence: 0.75 };
  if (TIER4_ANYWHERE.some((p) => p.test(t))) return { isQuestion: true, confidence: 0.65 };

  const firstWord = t.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  if (QUESTION_FIRST_WORDS.has(firstWord)) {
    return { isQuestion: false, confidence: 0.55 }; // below threshold — treat as non-question
  }

  return { isQuestion: false, confidence: 0 };
}
