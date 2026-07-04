import { readFileSync, writeFileSync } from "node:fs";
import {
  parseStream,
  countByType,
  findUntagged,
  type ParsedStream,
} from "./stream-parser.js";

const COUNTER_RE = /^_Необработанных:.*_$/m;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  return new Date().toISOString().slice(11, 16);
}

export function appendEntry(filePath: string, text: string): void {
  const content = readFileSync(filePath, "utf-8");
  const date = today();
  const time = nowTime();
  const entryLine = `${time} — ${text}`;
  const dateHeader = `## ${date}`;

  const lines = content.split("\n");

  const dateIdx = lines.findIndex((l) => l.trim() === dateHeader);

  if (dateIdx === -1) {
    const counterIdx = lines.findIndex((l) => COUNTER_RE.test(l));
    const insertAt = counterIdx !== -1 ? counterIdx + 1 : 2;
    const newSection = ["", dateHeader, entryLine];
    lines.splice(insertAt, 0, ...newSection);
  } else {
    let insertAt = dateIdx + 1;
    while (
      insertAt < lines.length &&
      lines[insertAt].match(/^\d{2}:\d{2}\s*—/)
    ) {
      insertAt++;
    }
    lines.splice(insertAt, 0, entryLine);
  }

  writeFileSync(filePath, lines.join("\n"), "utf-8");
}

export function tagEntry(
  filePath: string,
  date: string,
  entryText: string,
  tags: string[]
): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const dateHeader = `## ${date}`;
  let inSection = false;

  const tagSuffix = tags.map((t) => "`" + t + "`").join(" ");

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === dateHeader) {
      inSection = true;
      continue;
    }
    if (inSection && lines[i].match(/^## /)) break;
    if (inSection) {
      const trimmed = lines[i].trim();
      if (
        trimmed.includes(entryText) &&
        trimmed.match(/^\d{2}:\d{2}\s*—/) &&
        !trimmed.includes("`#")
      ) {
        lines[i] = trimmed + " " + tagSuffix;
        break;
      }
    }
  }

  writeFileSync(filePath, lines.join("\n"), "utf-8");
}

export function strikethroughEntry(
  filePath: string,
  date: string,
  entryText: string,
  target: string
): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const dateStr = today();

  const dateHeader = `## ${date}`;
  let inSection = false;
  const newLines: string[] = [];
  let removed = false;

  for (const line of lines) {
    if (line.trim() === dateHeader) {
      inSection = true;
      newLines.push(line);
      continue;
    }
    if (inSection && line.match(/^## /)) inSection = false;

    if (inSection && !removed && line.trim().includes(entryText)) {
      const timeMatch = line.trim().match(/^(\d{2}:\d{2})/);
      const time = timeMatch ? timeMatch[1] : "00:00";
      const strickenLine = `~~${time} — ${entryText}~~ → ${target} (${dateStr})`;
      removed = true;

      const processedIdx = newLines.findIndex(
        (l) => l.trim() === "## Обработано"
      );
      if (processedIdx !== -1) {
        newLines.splice(processedIdx + 1, 0, strickenLine);
      }
      continue;
    }
    newLines.push(line);
  }

  writeFileSync(filePath, newLines.join("\n"), "utf-8");
}

export function updateCounters(filePath: string): void {
  const content = readFileSync(filePath, "utf-8");
  const parsed = parseStream(content);
  const untagged = findUntagged(parsed).length;
  const typeCounts = countByType(parsed);

  const counterLine = `_Необработанных: ${untagged} · Задач: ${typeCounts.task} · Идей: ${typeCounts.idea} · Вопросов: ${typeCounts.question}_`;

  const newContent = content.replace(COUNTER_RE, counterLine);
  writeFileSync(filePath, newContent, "utf-8");
}
