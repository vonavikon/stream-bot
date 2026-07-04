export interface StreamEntry {
  time: string;
  text: string;
  tags: string[];
  raw: string;
  stricken: boolean;
}

export interface ProcessedEntry {
  text: string;
  link: string;
  date: string;
  raw: string;
}

export interface DateSection {
  date: string;
  entries: StreamEntry[];
}

export interface StreamCounters {
  raw: number;
  task: number;
  idea: number;
  question: number;
  reference: number;
}

export interface ParsedStream {
  counters: StreamCounters;
  sections: DateSection[];
  processed: ProcessedEntry[];
  archive: string[];
}

const TYPE_TAGS = new Set(["#task", "#idea", "#question", "#reference", "#trash"]);

const ENTRY_RE = /^(\d{2}:\d{2})\s*—\s+(.+)$/;
const STRICKEN_ENTRY_RE = /^~~(\d{2}:\d{2})\s*—\s+(.+?)~~\s*→\s*(.+)$/;
const TAG_RE = /`(#\w+)`/g;
const COUNTER_RE =
  /Необработанных:\s*(\d+)\s*·\s*Задач:\s*(\d+)\s*·\s*Идей:\s*(\d+)\s*·\s*Вопросов:\s*(\d+)/;
const DATE_RE = /^## (\d{4}-\d{2}-\d{2})$/;

export function parseStream(content: string): ParsedStream {
  const lines = content.split("\n");
  const result: ParsedStream = {
    counters: { raw: 0, task: 0, idea: 0, question: 0, reference: 0 },
    sections: [],
    processed: [],
    archive: [],
  };

  for (const line of lines) {
    const match = line.match(COUNTER_RE);
    if (match) {
      result.counters.raw = parseInt(match[1]);
      result.counters.task = parseInt(match[2]);
      result.counters.idea = parseInt(match[3]);
      result.counters.question = parseInt(match[4]);
      break;
    }
  }

  let currentSection: string | null = null;
  let currentZone: "entries" | "processed" | "archive" = "entries";

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    if (dateMatch) {
      currentSection = dateMatch[1];
      currentZone = "entries";
      result.sections.push({ date: currentSection, entries: [] });
      continue;
    }

    if (line.trim() === "## Обработано") {
      currentZone = "processed";
      continue;
    }

    if (line.trim() === "## Архив") {
      currentZone = "archive";
      continue;
    }

    if (currentZone === "archive") {
      if (line.trim()) result.archive.push(line);
      continue;
    }

    if (currentZone === "processed") {
      const match = line.trim().match(STRICKEN_ENTRY_RE);
      if (match) {
        const linkPart = match[3].trim();
        const linkMatch = linkPart.match(/\[\[(.+?)\]\]/);
        result.processed.push({
          text: match[2],
          link: linkMatch ? linkMatch[1] : linkPart,
          date: linkPart.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] ?? "",
          raw: line,
        });
      }
      continue;
    }

    if (currentSection && currentZone === "entries") {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const strickenMatch = trimmed.match(STRICKEN_ENTRY_RE);
      if (strickenMatch) {
        const tags = extractTags(trimmed);
        result.sections[result.sections.length - 1].entries.push({
          time: strickenMatch[1],
          text: strickenMatch[2],
          tags,
          raw: trimmed,
          stricken: true,
        });
        continue;
      }

      const match = trimmed.match(ENTRY_RE);
      if (match) {
        const tags = extractTags(trimmed);
        const textWithoutTags = match[2].replace(/`#\w+`/g, "").trim();
        result.sections[result.sections.length - 1].entries.push({
          time: match[1],
          text: textWithoutTags,
          tags,
          raw: trimmed,
          stricken: false,
        });
      }
    }
  }

  return result;
}

function extractTags(line: string): string[] {
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(TAG_RE);
  while ((match = re.exec(line)) !== null) {
    tags.push(match[1]);
  }
  return tags;
}

export function countByType(parsed: ParsedStream): Record<string, number> {
  const counts: Record<string, number> = {
    task: 0,
    idea: 0,
    question: 0,
    reference: 0,
    trash: 0,
  };
  for (const section of parsed.sections) {
    for (const entry of section.entries) {
      for (const tag of entry.tags) {
        if (TYPE_TAGS.has(tag)) {
          const key = tag.slice(1);
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
    }
  }
  return counts;
}

export function findUntagged(parsed: ParsedStream): StreamEntry[] {
  return parsed.sections.flatMap((s) =>
    s.entries.filter(
      (e) => !e.stricken && !e.tags.some((t) => TYPE_TAGS.has(t))
    )
  );
}
