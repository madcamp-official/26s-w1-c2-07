import OpenAI from "openai";

function isConfiguredSecret(value: string | undefined) {
  return Boolean(value && !value.startsWith("replace-with-"));
}

export function getSeatMapAnalysisModel() {
  return process.env.OPENAI_SEAT_MAP_MODEL ?? "gpt-5.4-mini";
}

export function createOpenAIClient() {
  if (!isConfiguredSecret(process.env.OPENAI_API_KEY)) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}
