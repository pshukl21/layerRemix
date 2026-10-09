// Lightweight "is this keyboard mashing?" checks for upload text fields.
//
// This is a heuristic, not a dictionary: it looks for the patterns that
// random typing produces (long runs of consonants, words with no vowels,
// the same character repeated) and deliberately lets through anything
// short, all-caps (PSD, HDR, UI), containing digits, or written in a
// non-Latin script, so legitimate titles in other languages aren't blocked.
//
// It runs in the browser only, so it stops casual junk, not a determined
// user posting straight to the API. Pair it with a server-side check if
// you want a hard guarantee.

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

// Longest legitimate English consonant run is around 5 ("strengths"), so
// 6+ in a row (with y counted as a vowel) is almost always mashing.
const MAX_CONSONANT_RUN = 6;
const MAX_REPEATED_CHAR = 4;

function wordLooksLikeGibberish(word: string): boolean {
  // Only judge plain Latin-letter words of a meaningful length.
  if (!/^[A-Za-z]+$/.test(word)) return false;
  if (word.length < 5) return false;
  // Acronyms like HTML / PSDS are fine.
  if (word === word.toUpperCase()) return false;

  const lower = word.toLowerCase();

  // aaaaa, hhhhh
  if (new RegExp(`(.)\\1{${MAX_REPEATED_CHAR - 1},}`).test(lower)) return true;

  // No vowels at all in a 5+ letter word
  if (![...lower].some((c) => VOWELS.has(c))) return true;

  // A long consonant run
  let run = 0;
  for (const c of lower) {
    if (VOWELS.has(c)) {
      run = 0;
    } else {
      run += 1;
      if (run >= MAX_CONSONANT_RUN) return true;
    }
  }
  return false;
}

export interface TextQualityOptions {
  /** Minimum number of words (default 1). */
  minWords?: number;
  /** Minimum number of letters+digits overall (default 3). */
  minChars?: number;
}

/**
 * Returns a human-readable problem with the text, or null if it looks fine.
 * `label` is used in the message, e.g. "title", "description", "tag".
 */
export function getTextQualityIssue(
  text: string,
  label: string,
  { minWords = 1, minChars = 3 }: TextQualityOptions = {}
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null; // emptiness is handled by the required checks

  const alnum = trimmed.replace(/[^\p{L}\p{N}]/gu, '');
  if (alnum.length < minChars) {
    return `Your ${label} is too short — please use at least ${minChars} characters.`;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < minWords) {
    return `Your ${label} needs at least ${minWords} words.`;
  }

  // Strip punctuation around each word before judging it.
  const cleaned = words.map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));
  if (cleaned.some(wordLooksLikeGibberish)) {
    return `Your ${label} doesn't look like real words — please write something people will understand.`;
  }

  return null;
}
