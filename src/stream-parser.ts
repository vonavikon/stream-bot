export interface InboxEntry {
  time: string;
  text: string; // текст без тегов и без маркера ❓
  tags: string[]; // теги вида "#ai", "#stream-bot"
  needsClarify: boolean;
  raw: string;
}

export const INBOX_HEADER = "## Входящее";

const INBOX_LINE_RE = /^-\s+\[[ xX]\]\s+((?:\d{4}-\d{2}-\d{2}\s+)?\d{2}:\d{2})\s+—\s+(.+)$/;
const TAG_RE = /`(#[\w-]+)`/g;
const CLARIFY_RE = /❓/;

function extractTags(line: string): string[] {
  const tags: string[] = [];
  const re = new RegExp(TAG_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) tags.push(m[1]);
  return tags;
}

/** Записи секции ## Входящее. Зачёркнутые (trash) не попадают — не матчат регулярку. */
export function parseInbox(content: string): InboxEntry[] {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.trim() === INBOX_HEADER);
  if (start === -1) return [];

  const entries: InboxEntry[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^##\s/.test(trimmed)) break; // следующая секция
    const m = trimmed.match(INBOX_LINE_RE);
    if (!m) continue;
    const tags = extractTags(trimmed);
    const needsClarify = CLARIFY_RE.test(m[2]);
    const textWithoutTags = m[2]
      .replace(/`#[\w-]+`/g, "")
      .replace(/❓/g, "")
      .trim();
    entries.push({ time: m[1], text: textWithoutTags, tags, needsClarify, raw: trimmed });
  }
  return entries;
}

/** Записи без тега и без маркера уточнения — кандидаты на триаг. */
export function findUntaggedInbox(content: string): InboxEntry[] {
  return parseInbox(content).filter((e) => e.tags.length === 0 && !e.needsClarify);
}

/** Записи, ожидающие уточнения (маркер ❓). */
export function findNeedsClarify(content: string): InboxEntry[] {
  return parseInbox(content).filter((e) => e.needsClarify);
}
