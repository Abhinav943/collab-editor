import config from "../config.js";

const TIMEOUT_MS = 30_000;

async function gemini({ system, prompt }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config.geminiApiKey,
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok)
    throw new Error(
      `gemini ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text)
    .join("");
}

async function groq({ system, prompt }) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.groqModel,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok)
    throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Generate text with the primary provider, falling back to the other. */
export async function generate(args) {
  const impls = { gemini, groq };
  const keys = { gemini: config.geminiApiKey, groq: config.groqApiKey };
  const order =
    config.aiProvider === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];

  const errors = [];
  for (const name of order) {
    if (!keys[name]) {
      errors.push(`${name}: no API key`);
      continue;
    }
    try {
      return await impls[name](args);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }
  throw new Error(`All AI providers failed — ${errors.join(" | ")}`);
}
