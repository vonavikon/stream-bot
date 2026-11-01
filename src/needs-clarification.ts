/**
 * Deterministic "needs clarification" trigger.
 * Independent of the LLM: whether a question is needed is decided by the text's structure, not semantics.
 * Experience on 32 entries: the LLM signal over-triggered (84% → 59% after tightening),
 * while the genuinely unclear ones were almost all bare links and verbless fragments.
 */

// The whole text is a link: http(s) or a bare domain with a TLD.
const BARE_LINK_RE =
  /^(?:https?:\/\/\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?)$/i;

// Explicit uncertainty markers: the author did not specify or does not remember.
const UNCERTAINTY_MARKERS = [
  "какой-то",
  "какая-то",
  "какое-то",
  "какие-то",
  "каких-то",
  "какую-то",
  "то самое",
  "не помню",
  "хз",
  "кое-что",
  "что-то",
  "нечто",
];

// Infinitive endings, a sign of a verb. The anchor [^а-яё]|$ instead of \b:
// in JS \w covers only [A-Za-z0-9_], so \b does not work with Cyrillic.
// Nouns ending in -ость/-сть (новость, возможность) do not match this list.
const VERB_ENDING_RE = /(?:ться|тся|ать|ять|еть|ить|ыть|уть|оть|чь|ти)(?=[^а-яё]|$)/i;

export function needsClarification(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (BARE_LINK_RE.test(t)) return true;

  const withoutUrls = t.replace(/https?:\/\/\S+/g, " ").trim();
  const lower = withoutUrls.toLowerCase();

  if (UNCERTAINTY_MARKERS.some((m) => lower.includes(m))) return true;

  const words = withoutUrls.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && !VERB_ENDING_RE.test(withoutUrls)) return true;

  return false;
}
