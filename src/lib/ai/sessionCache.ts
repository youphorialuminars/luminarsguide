/**
 * Session Analysis Cache
 *
 * Stores AI-generated analyses in localStorage keyed by studentId.
 * When a new session is submitted, it checks whether a sufficiently
 * similar previous session exists and returns the cached analysis
 * (optionally adapted) instead of calling Gemini.
 *
 * Similarity is determined by:
 *  1. Exact topic match (required)
 *  2. Score proximity — within ±15 points (or both null)
 *  3. Keyword overlap in observations — Jaccard similarity ≥ 0.25
 *
 * If all three conditions are met the cache is considered a hit.
 */

export interface CachedAnalysis {
  strengths: string[];
  weaknesses: string[];
  approach: string[];
  tasks: string[];
}

export interface CachedSession {
  id: string;           // unique cache entry id
  studentId: string;
  topic: string;
  score: number | null;
  observationKeywords: string[]; // normalised keyword tokens
  analysis: CachedAnalysis;
  cachedAt: number;     // unix ms timestamp
}

const CACHE_KEY = 'luminar_analysis_cache';
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Tokenise a string into lowercase, de-duplicated, meaningful words (≥4 chars). */
function tokenise(text: string): string[] {
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'they', 'have', 'been', 'were',
    'will', 'would', 'could', 'should', 'their', 'there', 'when',
    'what', 'which', 'also', 'into', 'more', 'very', 'some', 'than',
    'then', 'each', 'much', 'such', 'well', 'just', 'does', 'your',
    'about', 'after', 'before', 'during', 'while', 'because', 'however',
  ]);
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !stopWords.has(w))
    ),
  ];
}

/** Jaccard similarity between two token sets. */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  setA.forEach((t) => { if (setB.has(t)) intersection++; });
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadCache(): CachedSession[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed: CachedSession[] = JSON.parse(raw);
    const now = Date.now();
    // Evict expired entries
    return parsed.filter((e) => now - e.cachedAt < CACHE_TTL_MS);
  } catch {
    return [];
  }
}

function saveCache(entries: CachedSession[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage quota exceeded — silently skip caching
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SimilarityResult {
  hit: boolean;
  score: number;           // 0–1 composite similarity score
  cachedSession: CachedSession | null;
  adaptedAnalysis: CachedAnalysis | null;
}

/**
 * Check whether a sufficiently similar cached session exists for this student.
 *
 * @param studentId  - student identifier
 * @param topic      - session topic / pillar
 * @param scoreInput - numeric score string or empty string
 * @param observations - raw observations text
 */
export function checkSessionCache(
  studentId: string,
  topic: string,
  scoreInput: string,
  observations: string
): SimilarityResult {
  const cache = loadCache();
  const newScore = scoreInput ? Number(scoreInput) : null;
  const newTokens = tokenise(observations);

  // Filter to same student + same topic
  const candidates = cache.filter(
    (e) => e.studentId === studentId && e.topic === topic
  );

  if (candidates.length === 0) {
    return { hit: false, score: 0, cachedSession: null, adaptedAnalysis: null };
  }

  let bestMatch: CachedSession | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    // 1. Score proximity check
    let scoreComponent = 0;
    if (newScore === null && candidate.score === null) {
      scoreComponent = 1; // both observation-only
    } else if (newScore !== null && candidate.score !== null) {
      const diff = Math.abs(newScore - candidate.score);
      if (diff > 15) continue; // outside acceptable range — skip
      scoreComponent = 1 - diff / 15; // 1.0 at diff=0, ~0 at diff=15
    } else {
      // One has a score, the other doesn't — lower similarity
      scoreComponent = 0.3;
    }

    // 2. Observation keyword overlap
    const obsComponent = jaccardSimilarity(newTokens, candidate.observationKeywords);

    // Composite: topic already matched (weight 0), score 40%, obs 60%
    const composite = scoreComponent * 0.4 + obsComponent * 0.6;

    if (composite > bestScore) {
      bestScore = composite;
      bestMatch = candidate;
    }
  }

  // Threshold: topic match + score within range + obs similarity ≥ 0.25
  const THRESHOLD = 0.25;
  if (!bestMatch || bestScore < THRESHOLD) {
    return { hit: false, score: bestScore, cachedSession: null, adaptedAnalysis: null };
  }

  // Adapt the cached analysis by appending a contextual note
  const adaptedAnalysis = adaptAnalysis(bestMatch.analysis, topic, newScore, observations);

  return {
    hit: true,
    score: bestScore,
    cachedSession: bestMatch,
    adaptedAnalysis,
  };
}

/**
 * Lightly adapt a cached analysis to the new session context.
 * Adds a contextual preamble to each section's first item so the
 * educator knows this was adapted from a prior session.
 */
function adaptAnalysis(
  cached: CachedAnalysis,
  topic: string,
  newScore: number | null,
  observations: string
): CachedAnalysis {
  const scoreNote = newScore !== null ? ` (current score: ${newScore}/100)` : '';
  const adaptNote = `[Adapted from prior ${topic} session${scoreNote}] `;

  return {
    strengths: [adaptNote + cached.strengths[0], ...cached.strengths.slice(1)],
    weaknesses: [adaptNote + cached.weaknesses[0], ...cached.weaknesses.slice(1)],
    approach: [adaptNote + cached.approach[0], ...cached.approach.slice(1)],
    tasks: [adaptNote + cached.tasks[0], ...cached.tasks.slice(1)],
  };
}

/**
 * Persist a newly generated AI analysis to the cache.
 *
 * @param studentId    - student identifier
 * @param topic        - session topic / pillar
 * @param scoreInput   - numeric score string or empty string
 * @param observations - raw observations text
 * @param analysis     - the AI-generated analysis to cache
 */
export function cacheSessionAnalysis(
  studentId: string,
  topic: string,
  scoreInput: string,
  observations: string,
  analysis: CachedAnalysis
): void {
  const cache = loadCache();
  const newEntry: CachedSession = {
    id: `cache-${studentId}-${topic}-${Date.now()}`,
    studentId,
    topic,
    score: scoreInput ? Number(scoreInput) : null,
    observationKeywords: tokenise(observations),
    analysis,
    cachedAt: Date.now(),
  };

  // Keep at most 5 cached entries per student+topic combination to avoid stale bloat
  const filtered = cache.filter(
    (e) => !(e.studentId === studentId && e.topic === topic)
      || cache
          .filter((x) => x.studentId === studentId && x.topic === topic)
          .sort((a, b) => b.cachedAt - a.cachedAt)
          .slice(0, 4)
          .some((x) => x.id === e.id)
  );

  saveCache([newEntry, ...filtered]);
}
