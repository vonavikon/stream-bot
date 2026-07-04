import { Bot } from "grammy";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "./config.js";
import {
  appendEntry,
  tagEntry,
  updateCounters,
  strikethroughEntry,
} from "./stream-writer.js";
import { classify } from "./classifier.js";

import { gitPull, gitCommitAndPush } from "./git-sync.js";
import { parseStream, findUntagged, countByType } from "./stream-parser.js";

const bot = new Bot(config.telegram.botToken);
const streamPath = resolve(config.wiki.path, config.wiki.streamFile);

const DOMAIN_LABELS: Record<string, string> = {
  ai: "AI",
  career: "Карьера",
  dev: "Dev",
  infra: "Инфра",
  product: "Продукт",
  pm: "PM",
  personal: "Личное",
  naumen: "Naumen",
  learning: "Обучение",
};

bot.command("start", (ctx) => {
  ctx.reply("Stream Bot — скидывай мысли, идеи, задачи. Я разберусь.");
});

bot.command("stream", (ctx) => {
  try {
    gitPull(config.wiki.path);
    const content = readFileSync(streamPath, "utf-8");
    const parsed = parseStream(content);
    const untagged = findUntagged(parsed);
    const counts = countByType(parsed);
    ctx.reply(
      `Необработанных: ${untagged.length} | Идей: ${counts.idea} | Вопросов: ${counts.question} | Задач: ${counts.task}`
    );
  } catch (e) {
    ctx.reply(`Ошибка: ${(e as Error).message}`);
  }
});

bot.command("triage", async (ctx) => {
  const msg = await ctx.reply("Триагую...");
  try {
    gitPull(config.wiki.path);
    await triageAll();
    ctx.reply("Триаг завершён.");
  } catch (e) {
    ctx.reply(`Ошибка триага: ${(e as Error).message}`);
  }
  bot.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
});

bot.on("message:text", async (ctx) => {
  const chatId = ctx.message.chat.id.toString();
  const isForwarded = !!(ctx.message as any).forward_date;
  console.log(`[msg] chat=${chatId} forward=${isForwarded} len=${ctx.message.text.length} preview=${ctx.message.text.slice(0, 80)}`);
  if (chatId !== config.telegram.chatId) return;

  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return;

  try {
    // Save raw entry
    gitPull(config.wiki.path);
    appendEntry(streamPath, text);
    gitCommitAndPush(config.wiki.path, `stream: ${text.slice(0, 50)}`);
    await ctx.react("👌");

    // Background triage
    const today = new Date().toISOString().slice(0, 10);
    const result = await classify(text);

    const tags = [`#${result.type}`, `#${result.domain}`];

    gitPull(config.wiki.path);

    if (result.type === "trash") {
      strikethroughEntry(streamPath, today, text, "trash");
    } else {
      tagEntry(streamPath, today, text, tags);
    }

    if (result.type === "task" && result.task_text) {
      // Task stays in stream.md — user creates it in Kanban manually
    }

    updateCounters(streamPath);
    gitCommitAndPush(config.wiki.path, `triage: ${result.type}`);

    const domainLabel = DOMAIN_LABELS[result.domain] ?? result.domain;
    const reply = formatReply(result.type, domainLabel, text);
    ctx.reply(reply);
  } catch (e) {
    ctx.reply(`Сохранено, но триаг не удался: ${(e as Error).message}`);
  }
});

function formatReply(
  type: string,
  domain: string,
  text: string
): string {
  switch (type) {
    case "task":
      return `✅ Задача: ${text} — добавлена`;
    case "idea":
      return `💡 Идея (${domain}): ${text}`;
    case "question":
      return `❓ Вопрос (${domain}): ${text}`;
    case "reference":
      return `📎 Справка (${domain}): ${text}`;
    case "trash":
      return `🗑️ Удалено: ${text}`;
    default:
      return `✅ Сохранено: ${text}`;
  }
}

async function triageAll(): Promise<void> {
  const content = readFileSync(streamPath, "utf-8");
  const parsed = parseStream(content);
  const untagged = findUntagged(parsed);

  for (const entry of untagged) {
    const result = await classify(entry.text);
    const tags = [`#${result.type}`, `#${result.domain}`];

    const section = parsed.sections.find((s) =>
      s.entries.some((e) => e.raw === entry.raw)
    );
    if (!section) continue;

    if (result.type === "trash") {
      strikethroughEntry(streamPath, section.date, entry.text, "trash");
    } else {
      tagEntry(streamPath, section.date, entry.text, tags);
    }

    if (result.type === "task" && result.task_text) {
      // Task stays in stream.md — user creates it in Kanban manually
    }
  }

  updateCounters(streamPath);
  gitCommitAndPush(
    config.wiki.path,
    `triage: batch ${untagged.length} entries`
  );
}

console.log("Stream bot started");
bot.start();
