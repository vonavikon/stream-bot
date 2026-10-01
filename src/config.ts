import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(path: string): void {
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env file is optional
  }
}

loadEnv(resolve(__dirname, "..", ".env"));

export const config = {
  telegram: {
    botToken: required("TELEGRAM_BOT_TOKEN"),
    chatId: required("TELEGRAM_CHAT_ID"),
  },
  llm: {
    // OpenAI-совместимый шлюз. По умолчанию bothub (https://openai.bothub.chat/v1),
    // любой другой шлюз — заменой BOTHUB_BASE_URL. Для reasoning-моделей добавлять reasoning_effort: "none".
    apiKey: required("BOTHUB_API_KEY"),
    baseUrl: process.env.BOTHUB_BASE_URL ?? "https://openai.bothub.chat/v1",
    model: process.env.MODEL ?? "claude-haiku-4.5",
  },
  wiki: {
    // WIKI_PATH — корень git-репо заметок (с .git). Захват пишется в <WIKI_PATH>/wiki/inbox/stream.md (## Входящее).
    // tasks.md бот не трогает — это пользовательская зона (через Obsidian Fit), иначе два писателя рождают _fit-конфликты.
    path: process.env.WIKI_PATH ?? resolve(__dirname, "..", ".."),
    inboxFile: "wiki/stream.md",
  },
  // Таксономия (домены + проекты/темы) — в taxonomy.md рядом с кодом.
  // Источник истины для категорий классификатора, подмешивается в промпт.
  taxonomyPath: process.env.TAXONOMY_PATH ?? resolve(__dirname, "..", "taxonomy.md"),
  types: ["task", "idea", "question", "reference", "trash"] as const,
} as const;

export type EntryType = (typeof config.types)[number];

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}
