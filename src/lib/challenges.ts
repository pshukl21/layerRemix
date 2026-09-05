// Fixed set of structured "what's needed" categories. Kept as a shared
// constant (rather than freeform text, like the regular tags field) so the
// gallery can be filtered by a specific gap — "show me pieces that need
// color grading" — without depending on how someone happened to phrase
// their description.
export const OPEN_CHALLENGES = [
  'Background',
  'Color Grading',
  'Typography',
  'Lighting',
  'Texture',
  '3D Elements',
  'Compositing',
  'Effects',
  'Cleanup',
] as const;

export type OpenChallenge = (typeof OPEN_CHALLENGES)[number];

export function isValidOpenChallenge(value: string): value is OpenChallenge {
  return (OPEN_CHALLENGES as readonly string[]).includes(value);
}
