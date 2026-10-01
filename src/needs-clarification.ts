/**
 * Детерминированный триггер «нужно уточнение».
 * Не зависит от LLM: нужность вопроса определяется структурой текста, а не семантикой.
 * Опыт на 32 записях: LLM-сигнал перестреливал (84% → 59% после ужесточения),
 * а реально невнятные — почти все голые ссылки и обрывки без глагола.
 */

// Текст целиком — ссылка: http(s) или голый домен с TLD.
const BARE_LINK_RE =
  /^(?:https?:\/\/\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?)$/i;

// Маркеры явной неопределённости — автор сам не уточнил/не помнит.
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

// Окончания инфинитивов — признак глагола. Якорь [^а-яё]|$ вместо \b:
// в JS \w покрывает только [A-Za-z0-9_], поэтому \b не работает с кириллицей.
// Существительные на -ость/-сть (новость, возможность) в список не попадают.
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
