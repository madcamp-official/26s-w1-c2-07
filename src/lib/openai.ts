import OpenAI from "openai";

export function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}
