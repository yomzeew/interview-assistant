/**
 * Detects whether a transcript segment is an interview question.
 *
 * Covers:
 *  - Explicit question marks
 *  - Standard interrogative openers (what, how, why, can you…)
 *  - Conversational interview openers (tell me, walk me, talk me, share, give me, describe)
 *  - Behavioural / STAR openers (describe a time, give an example, have you ever)
 *  - Indirect questions (I'd like to know, I'm curious, I want to understand)
 */

// Patterns checked from the START of the sentence
const START_PATTERNS: RegExp[] = [
  /\?/,                                                                          // any question mark
  /^(what|how|why|where|when|who|which|whose|whom)\b/i,
  /^(can|could|would|should|will|shall|may|might|must)\s+you\b/i,
  /^(do|does|did|have|has|had|is|are|was|were|am)\s+(you|your|the|a|an|it|they|we)\b/i,
  /^(tell|talk|walk|take)\s+(me|us)\b/i,
  /^(describe|explain|define|discuss|share|give|outline|elaborate|summarise|summarize)\b/i,
  /^(think about|imagine|suppose|let's say|say you|assume)\b/i,
  /^(have you (ever|previously|before|worked|used|dealt|managed|led|built|designed|handled))/i,
  /^(are you|were you|did you|do you|have you)\b/i,
];

// Phrases checked ANYWHERE in the text
const ANYWHERE_PATTERNS: RegExp[] = [
  /\btell (me|us) (about|more|a bit|a little|your|how|why|what|when|where)\b/i,
  /\bwalk (me|us) (through|about)\b/i,
  /\btalk (me|us) (through|about|more)\b/i,
  /\bgive (me|us) (an example|a sense|some insight|more detail|your|an overview)\b/i,
  /\bdescribe a time\b/i,
  /\bgive (me |us )?an example\b/i,
  /\bhave you ever\b/i,
  /\bwhat (is|are|was|were|would|do|did|has|have|can|could|should|will|might)\b/i,
  /\bhow (do|did|would|have|has|can|could|will|might|should)\b/i,
  /\bwhy (did|do|would|have|has|are|were|is|was|should)\b/i,
  /\bdifference between\b/i,
  /\bcompare .{0,40} (with|to|and|vs)\b/i,
  /\bwhat (are|were|would be) your\b/i,
  /\bwhat (is|was) your\b/i,
  /\bhow would you\b/i,
  /\bhow have you\b/i,
  /\bcan you (explain|describe|tell|walk|talk|share|give|outline|elaborate)\b/i,
  /\bcould you (explain|describe|tell|walk|talk|share|give|outline|elaborate)\b/i,
  /\bwould you (say|describe|consider|explain|mind|rate|call)\b/i,
  /\bi('d| would) (like to|love to|want to) (know|hear|understand|learn|ask)\b/i,
  /\bi('m| am) (curious|interested|wondering)\b/i,
  /\bwhat (motivates|drives|excites|challenges|interests) you\b/i,
  /\bwhere do you see\b/i,
  /\bhow (long|many|much|often|soon|far)\b/i,
  /\bstrengths? (and|or) weaknesses?\b/i,
  /\bgreatest (strength|weakness|achievement|challenge|accomplishment|failure)\b/i,
  /\btell (me|us) something\b/i,
  /\bhow (do|did) you handle\b/i,
  /\bhow (do|did) you deal\b/i,
  /\bwhat (do|did) you do when\b/i,
  /\bsituation (where|when|in which)\b/i,
  /\bexperience (with|in|using|building|leading|managing)\b/i,
  /\bworked (with|on|at|in|for)\b/i,
  /\bfamiliar with\b/i,
  /\bwhat (brought|brings) you\b/i,
  /\bwhy (are you|do you want|did you choose|did you apply|did you leave)\b/i,
  /\btell us about yourself\b/i,
  /\bintroduce yourself\b/i,
  /\bbackground (in|with|and)\b/i,
  /\bwhat (kind of|type of|sort of) (work|projects?|experience|role|team)\b/i,
  /\bhow do you (approach|handle|deal|manage|prioritise|prioritize)\b/i,
  /\bwhat (would|do) you (do|say|think|consider|recommend) (if|when|in)\b/i,
];

// First words that by themselves strongly suggest a question opener
const QUESTION_FIRST_WORDS = new Set([
  'what', 'how', 'why', 'where', 'when', 'who', 'which', 'whose', 'whom',
  'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might',
  'do', 'does', 'did', 'have', 'has', 'had',
  'is', 'are', 'was', 'were', 'am',
  'tell', 'describe', 'explain', 'walk', 'talk', 'share', 'give', 'outline',
  'think', 'imagine', 'suppose', 'introduce',
]);

export function detectQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (START_PATTERNS.some((p) => p.test(t))) return true;
  if (ANYWHERE_PATTERNS.some((p) => p.test(t))) return true;

  const firstWord = t.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  return QUESTION_FIRST_WORDS.has(firstWord);
}
