import { config } from "./config.js";

export function buildClassifierPrompt(entryText: string, taxonomy: string): string {
  const types = config.types.join(", ");

  return `Ты — триаг-помощник для персональной базы знаний. Классифицируй запись пользователя.

Запись: "${entryText}"

Таксономия (домены и проекты):
${taxonomy}

Верни ТОЛЬКО JSON (без markdown):
{
  "type": "task|idea|question|reference|trash",
  "domain": "один из доменов таксономии",
  "project": "один из проектов, если определяется однозначно, иначе null",
  "task_text": "переформулировка для kanban-доски (только если type=task, иначе null)"
}

Правила:
- type: task — конкретное действие, которое можно выполнить; idea — мысль/гипотеза без немедленного действия; question — открытый вопрос для исследования; reference — ссылка/справка; trash — повтор или устаревшее
- domain: ровно один, строго из списка доменов
- project: строго из списка проектов; если не совпадает уверенно — null, не выдумывай
- task_text: чёткая формулировка с глаголом, дедлайном если есть; для остальных типов — null

Типы: ${types}`;
}

export function buildClarifyPrompt(entryText: string): string {
  return `Пользователь отправил короткую запись в GTD-inbox, но её смысл невнятен.

Запись: "${entryText}"

Задай ОДИН короткий вопрос по-русски, чтобы уточнить цель/назначение записи. Ответ должен предполагать одно предложение.

Верни ТОЛЬКО JSON:
{ "question": "текст вопроса" }`;
}
