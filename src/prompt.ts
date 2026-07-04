import { config } from "./config.js";

export function buildClassifierPrompt(entryText: string): string {
  const types = config.types.join(", ");
  const domains = config.domains.join(", ");

  return `Ты — триаг-помощник для персональной базы знаний. Классифицируй запись пользователя.

Запись: "${entryText}"

Верни ТОЛЬКО JSON (без markdown):
{
  "type": "task|idea|question|reference|trash",
  "domain": "один из: ${domains}",
  "task_text": "переформулировка для kanban-доски (только если type=task, иначе null)"
}

Правила:
- task: конкретное действие, которое можно выполнить. task_text — чёткая формулировка с дедлайном если есть
- idea: мысль, гипотеза, задумка. Не требует немедленного действия
- question: открытый вопрос, требующий исследования
- reference: ссылка, рекомендация к прочтению, справочная информация
- trash: повтор, уточнение, потерявшее актуальность

Типы: ${types}
Домены: ${domains}`;
}
