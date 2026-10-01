import { config } from "./config.js";
import { buildClassifierPrompt, buildClarifyPrompt } from "./prompt.js";
import { loadTaxonomy } from "./taxonomy.js";

export interface Classification {
  type: string;
  domain: string;
  project: string | null;
  task_text: string | null;
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function completeJson(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 300
): Promise<any> {
  const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llm.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.llm.model,
      max_tokens: maxTokens,
      temperature: 0,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `LLM request failed: ${response.status} ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No text in LLM response");
  }

  let json = content.trim();
  json = json.replace(/^```json?\n?/, "").replace(/\n?```$/, "");

  return JSON.parse(json);
}

export async function classify(text: string): Promise<Classification> {
  const taxonomy = loadTaxonomy();
  return (await completeJson([
    { role: "user", content: buildClassifierPrompt(text, taxonomy) },
  ])) as Classification;
}

export async function generateClarifyQuestion(text: string): Promise<string> {
  const result = (await completeJson(
    [{ role: "user", content: buildClarifyPrompt(text) }],
    100
  )) as { question: string };
  return result.question;
}
