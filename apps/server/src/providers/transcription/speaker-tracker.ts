/**
 * Simple speaker diarization using 8-band energy fingerprinting.
 *
 * For each PCM chunk we compute the mean absolute amplitude in 8 equal
 * frequency bands (via a lightweight DFT over a 512-sample window), producing
 * a normalised 8-float fingerprint. Consecutive utterances are compared with
 * cosine similarity. When similarity drops below CHANGE_THRESHOLD we assume a
 * speaker change and either assign a new speaker or match against a known one.
 *
 * This is intentionally simple — no ML model required. It works well for the
 * interview use-case (2 speakers, clear turns, different vocal ranges) and
 * degrades gracefully when audio is noisy (returns "Speaker 1" throughout).
 */

const BANDS = 8;            // frequency bands to split the spectrum into
const WINDOW = 512;         // DFT window size (samples)
const CHANGE_THRESHOLD = 0.82; // cosine similarity below this → speaker change
const MIN_MATCH_SCORE = 0.88;  // similarity needed to re-identify a known speaker

export type SpeakerLabel = string; // "Speaker 1", "Speaker 2", …

/**
 * Compute a normalised 8-band energy fingerprint from raw PCM (Int16LE).
 * Returns a Float32Array of length BANDS summing to 1.
 */
function fingerprint(pcm: Buffer): Float32Array {
  const samples = Math.min(Math.floor(pcm.length / 2), 4096); // cap at 4096 samples
  const energy = new Float32Array(BANDS);

  // Walk the buffer in WINDOW-sized frames, accumulate band energies
  for (let offset = 0; offset + WINDOW * 2 <= pcm.length && offset / 2 < samples; offset += WINDOW * 2) {
    const frame = new Float32Array(WINDOW);
    for (let i = 0; i < WINDOW; i++) {
      frame[i] = pcm.readInt16LE(offset + i * 2) / 32768.0;
    }

    // Simplified DFT: for each band compute mean power of its frequency bins
    const binsPerBand = Math.floor(WINDOW / 2 / BANDS);
    for (let b = 0; b < BANDS; b++) {
      let power = 0;
      const binStart = b * binsPerBand;
      const binEnd = binStart + binsPerBand;
      // Compute real DFT for these bins
      for (let k = binStart; k < binEnd; k++) {
        let re = 0;
        let im = 0;
        const twoPiKOverN = (2 * Math.PI * k) / WINDOW;
        for (let n = 0; n < WINDOW; n++) {
          re += (frame[n] ?? 0) * Math.cos(twoPiKOverN * n);
          im -= (frame[n] ?? 0) * Math.sin(twoPiKOverN * n);
        }
        power += re * re + im * im;
      }
      energy[b] = (energy[b] ?? 0) + power / binsPerBand;
    }
  }

  // Normalise so the vector sums to 1
  const total = energy.reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (let i = 0; i < BANDS; i++) energy[i] = (energy[i] ?? 0) / total;
  }
  return energy;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < BANDS; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  if (normA === 0 || normB === 0) return 1; // treat silence as same speaker
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface KnownSpeaker {
  label: SpeakerLabel;
  /** Running average fingerprint */
  fingerprint: Float32Array;
  /** Number of utterances seen (for weighted average) */
  count: number;
}

export class SpeakerTracker {
  private speakers: KnownSpeaker[] = [];
  private lastFingerprint: Float32Array | null = null;

  /**
   * Given a PCM chunk, return the speaker label for this utterance.
   * Creates new speaker labels as needed (max 5 to avoid drift issues).
   */
  identify(pcm: Buffer): SpeakerLabel {
    const fp = fingerprint(pcm);

    // --- Step 1: check if this sounds like a known speaker ---
    let bestLabel: SpeakerLabel | null = null;
    let bestScore = 0;
    for (const spk of this.speakers) {
      const score = cosine(fp, spk.fingerprint);
      if (score > bestScore) {
        bestScore = score;
        bestLabel = spk.label;
      }
    }

    if (bestLabel !== null && bestScore >= MIN_MATCH_SCORE) {
      // Update the speaker's running average fingerprint
      const spk = this.speakers.find((s) => s.label === bestLabel)!;
      const w = 1 / (spk.count + 1);
      for (let i = 0; i < BANDS; i++) {
        spk.fingerprint[i] = (spk.fingerprint[i] ?? 0) * (1 - w) + (fp[i] ?? 0) * w;
      }
      spk.count++;
      this.lastFingerprint = fp;
      return bestLabel;
    }

    // --- Step 2: check for change vs last utterance ---
    if (this.lastFingerprint !== null) {
      const similarity = cosine(fp, this.lastFingerprint);
      if (similarity >= CHANGE_THRESHOLD) {
        // Same speaker as last time — if we have a label for them, reuse it
        if (bestLabel !== null) {
          this.lastFingerprint = fp;
          return bestLabel;
        }
      }
    }

    // --- Step 3: new speaker (or first utterance) ---
    if (this.speakers.length < 5) {
      const label = `Speaker ${this.speakers.length + 1}`;
      this.speakers.push({ label, fingerprint: fp, count: 1 });
      this.lastFingerprint = fp;
      return label;
    }

    // Fallback: too many speakers detected, assign to closest known
    this.lastFingerprint = fp;
    return bestLabel ?? this.speakers[0]?.label ?? 'Speaker 1';
  }

  /** Reset state (call at session start) */
  reset(): void {
    this.speakers = [];
    this.lastFingerprint = null;
  }
}
