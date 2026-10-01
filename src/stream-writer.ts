import { readFileSync, writeFileSync } from "node:fs";

const INBOX_HEADER = "## Входящее";
const INBOX_LINE_RE = /^-\s+\[[ xX]\]\s+((?:\d{4}-\d{2}-\d{2}\s+)?\d{2}:\d{2})\s+—\s+(.+)$/;

/** Штамп МСК (UTC+3): YYYY-MM-DD HH:MM. */
function nowStamp(): string {
  const msk = new Date(Date.now() + 3 * 3600_000);
  return msk.toISOString().slice(0, 16).replace("T", " ");
}

/** Границы секции ## Входящее: [первая строка после заголовка, первая строка следующей секции). */
function inboxRange(lines: string[]): [number, number] {
  const start = lines.findIndex((l) => l.trim() === INBOX_HEADER);
  if (start === -1) return [-1, -1];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i].trim())) {
      end = i;
      break;
    }
  }
  return [start + 1, end];
}

/** Добавляет запись чекбоксом `- [ ] YYYY-MM-DD HH:MM — текст` в секцию Входящее, новой сверху. */
export function appendEntry(
  filePath: string,
  text: string,
  opts?: { needsClarify?: boolean }
): void {
  const content = readFileSync(filePath, "utf-8");
  const stamp = nowStamp();
  const suffix = opts?.needsClarify ? " ❓" : "";
  const entryLine = `- [ ] ${stamp} — ${text}${suffix}`;
  const lines = content.split("\n");

  const idx = lines.findIndex((l) => l.trim() === INBOX_HEADER);
  if (idx === -1) {
    // Секции ещё нет — создаём над «Открыта» (или над первым ## заголовком).
    const openIdx = lines.findIndex((l) => /^## Открыта\s*$/.test(l));
    const firstHeading = lines.findIndex((l) => /^##\s/.test(l));
    const insertAt =
      openIdx !== -1 ? openIdx : firstHeading !== -1 ? firstHeading : lines.length;
    lines.splice(insertAt, 0, INBOX_HEADER, "", entryLine, "");
  } else {
    let insertAt = idx + 1;
    if (lines[insertAt] !== undefined && lines[insertAt].trim() === "") insertAt++;
    lines.splice(insertAt, 0, entryLine);
  }

  writeFileSync(filePath, lines.join("\n"), "utf-8");
}

/** Переписывает тело первой подходящей записи: newBody + тег домена и (если есть) проекта. */
export function refineEntry(
  filePath: string,
  oldText: string,
  newBody: string,
  domain: string,
  project?: string | null
): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const [start, end] = inboxRange(lines);
  if (start === -1) return;

  const tags = [`\`#${domain}\``];
  if (project) tags.push(`\`#${project}\``);
  const tagSuffix = " " + tags.join(" ");

  for (let i = start; i < end; i++) {
    const m = lines[i].match(INBOX_LINE_RE);
    if (!m) continue;
    if (m[2].includes("`#")) continue; // уже размечена
    if (m[2].includes(oldText)) {
      lines[i] = `- [ ] ${m[1]} — ${newBody}${tagSuffix}`;
      break;
    }
  }

  writeFileSync(filePath, lines.join("\n"), "utf-8");
}

/** Зачёркивает запись как trash: `- [ ] ~~HH:MM — текст~~`. */
export function strikeTrash(filePath: string, oldText: string): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const [start, end] = inboxRange(lines);
  if (start === -1) return;

  for (let i = start; i < end; i++) {
    const m = lines[i].match(INBOX_LINE_RE);
    if (!m) continue;
    if (m[2].includes("`#")) continue;
    if (m[2].includes(oldText)) {
      lines[i] = `- [ ] ~~${m[1]} — ${oldText}~~`;
      break;
    }
  }

  writeFileSync(filePath, lines.join("\n"), "utf-8");
}
