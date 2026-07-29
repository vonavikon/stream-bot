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
  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
    baseUrl: process.env.ANTHROPIC_BASE_URL,
    model: "claude-haiku-4-5-2025-10-01",
  },
  wiki: {
    // WIKI_PATH — корень git-репо заметок (с .git). Захват пишется в <WIKI_PATH>/wiki/tasks.md (## Входящее)
    path: process.env.WIKI_PATH ?? resolve(__dirname, "..", ".."),
    tasksFile: "wiki/tasks.md",
  },
  types: ["task", "idea", "question", "reference", "trash"] as const,
  domains: [
    "ai",
    "career",
    "dev",
    "infra",
    "product",
    "pm",
    "personal",
    "naumen",
    "learning",
  ] as const,
} as const;

export type EntryType = (typeof config.types)[number];
export type EntryDomain = (typeof config.domains)[number];

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}
