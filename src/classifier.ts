import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { buildClassifierPrompt } from "./prompt.js";

export interface Classification {
  type: string;
  domain: string;
  task_text: string | null;
}

const client = new Anthropic({
  apiKey: config.anthropic.apiKey,
  baseURL: config.anthropic.baseUrl,
});

export async function classify(text: string): Promise<Classification> {
  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 200,
    messages: [{ role: "user", content: buildClassifierPrompt(text) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in classification response");
  }

  let json = textBlock.text.trim();
  json = json.replace(/^```json?\n?/, "").replace(/\n?```$/, "");

  return JSON.parse(json) as Classification;
}
