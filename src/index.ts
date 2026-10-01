import { Bot } from "grammy";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "./config.js";
import { appendEntry, refineEntry, strikeTrash } from "./stream-writer.js";
import { classify, generateClarifyQuestion, type Classification } from "./classifier.js";
import { needsClarification } from "./needs-clarification.js";

import { gitPull, gitCommitAndPush } from "./git-sync.js";
import { parseInbox, findUntaggedInbox, findNeedsClarify } from "./stream-parser.js";

const bot = new Bot(config.telegram.botToken);
const inboxPath = resolve(config.wiki.path, config.wiki.inboxFile);

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
  content: "Контент",
};

// Ожидаемый ответ на вопрос /clarify. Один за раз, ключ — message_id вопроса.
let currentQuestion: { messageId: number; text: string } | null = null;

bot.command("start", (ctx) => {
  ctx.reply("Stream Bot — скидывай мысли, идеи, задачи. Я разберусь.");
});

bot.command("stream", (ctx) => {
  try {
    gitPull(config.wiki.path);
    const content = readFileSync(inboxPath, "utf-8");
    const entries = parseInbox(content);
    const untagged = entries.filter((e) => e.tags.length === 0 && !e.needsClarify).length;
    const pending = entries.filter((e) => e.needsClarify).length;
    ctx.reply(`Входящее: ${entries.length} (без тега: ${untagged}, требуют уточнения: ${pending})`);
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

bot.command("clarify", async (ctx) => {
  if (ctx.match.trim() === "skip") {
    await skipClarification(ctx);
    return;
  }

  try {
    gitPull(config.wiki.path);
    const content = readFileSync(inboxPath, "utf-8");
    const pending = findNeedsClarify(content);
    if (pending.length === 0) {
      ctx.reply("Всё чисто, уточнять нечего.");
      return;
    }

    const entry = pending[0];
    let question: string;
    try {
      question = await generateClarifyQuestion(entry.text);
    } catch {
      question = "Что имелось в виду под этой записью?";
    }

    const q = await ctx.reply(
      `❓ ${question}\n\nОтветь на это сообщение, или /clarify skip`
    );
    currentQuestion = { messageId: q.message_id, text: entry.text };
  } catch (e) {
    ctx.reply(`Ошибка: ${(e as Error).message}`);
  }
});

bot.on("message:text", async (ctx) => {
  const chatId = ctx.message.chat.id.toString();
  const isForwarded = !!(ctx.message as any).forward_date;
  console.log(`[msg] chat=${chatId} forward=${isForwarded} len=${ctx.message.text.length} preview=${ctx.message.text.slice(0, 80)}`);
  if (chatId !== config.telegram.chatId) return;

  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return;

  // Ответ на вопрос /clarify: reply на сообщение бота с вопросом.
  const replyTo = ctx.message.reply_to_message?.message_id;
  if (currentQuestion && replyTo === currentQuestion.messageId) {
    try {
      await answerClarification(ctx, text);
    } catch (e) {
      ctx.reply(`Не удалось уточнить: ${(e as Error).message}`);
    }
    return;
  }

  try {
    gitPull(config.wiki.path);

    if (needsClarification(text)) {
      appendEntry(inboxPath, text, { needsClarify: true });
      gitCommitAndPush(config.wiki.path, `stream: ${text.slice(0, 50)}`);
      await ctx.react("👌");
      ctx.reply("💬 Сохранено. Требует уточнения — /clarify");
      return;
    }

    appendEntry(inboxPath, text);
    gitCommitAndPush(config.wiki.path, `stream: ${text.slice(0, 50)}`);
    await ctx.react("👌");

    const result = await classify(text);
    gitPull(config.wiki.path);
    applyClassification(text, result);
    gitCommitAndPush(config.wiki.path, `triage: ${result.type}`);

    const domainLabel = DOMAIN_LABELS[result.domain] ?? result.domain;
    ctx.reply(formatReply(result.type, domainLabel, text));
  } catch (e) {
    ctx.reply(`Сохранено, но триаг не удался: ${(e as Error).message}`);
  }
});

async function answerClarification(ctx: any, answer: string): Promise<void> {
  const original = currentQuestion!.text;
  currentQuestion = null;

  gitPull(config.wiki.path);
  const combined = `${original} — ${answer}`;
  const result = await classify(combined);
  gitPull(config.wiki.path);
  applyClassification(original, result);
  gitCommitAndPush(config.wiki.path, `clarify: ${result.type}`);

  const domainLabel = DOMAIN_LABELS[result.domain] ?? result.domain;
  ctx.reply(formatReply(result.type, domainLabel, original));
}

async function skipClarification(ctx: any): Promise<void> {
  if (!currentQuestion) {
    ctx.reply("Нечего пропускать.");
    return;
  }
  const original = currentQuestion.text;
  currentQuestion = null;

  gitPull(config.wiki.path);
  const result = await classify(original);
  gitPull(config.wiki.path);
  applyClassification(original, result);
  gitCommitAndPush(config.wiki.path, `clarify-skip: ${result.type}`);
  ctx.reply(`Пропущено, классифицировано как ${result.type}.`);
}

/** Применяет результат классификации к записи в stream.md. */
function applyClassification(originalText: string, result: Classification): void {
  if (result.type === "trash") {
    strikeTrash(inboxPath, originalText);
  } else {
    const body =
      result.type === "task" && result.task_text ? result.task_text : originalText;
    refineEntry(inboxPath, originalText, body, result.domain, result.project);
  }
}

function formatReply(type: string, domain: string, text: string): string {
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
  const content = readFileSync(inboxPath, "utf-8");
  const untagged = findUntaggedInbox(content);

  for (const entry of untagged) {
    const result = await classify(entry.text);
    applyClassification(entry.text, result);
  }

  gitCommitAndPush(config.wiki.path, `triage: batch ${untagged.length} entries`);
}

console.log("Stream bot started");
bot.start();
