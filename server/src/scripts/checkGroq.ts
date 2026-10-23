import "dotenv/config";

const key = process.env.GROQ_API_KEY;
const base = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const models = [process.env.GROQ_MODEL, process.env.GROQ_MODEL_FALLBACK].filter(Boolean) as string[];

console.log("GROQ_API_KEY set:", Boolean(key));
console.log("GROQ_ENABLED:", process.env.GROQ_ENABLED);
console.log("models to try:", models.join(", "));

for (const model of models) {
  const t0 = performance.now();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_completion_tokens: 600,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: 'Reply with JSON only: {"ok":true}' },
        { role: "user", content: "ping" },
      ],
    }),
  });
  const ms = Math.round(performance.now() - t0);
  const body: any = await res.json().catch(() => ({}));
  const text = body?.choices?.[0]?.message?.content ?? "";
  console.log(`${model} -> HTTP ${res.status} in ${ms}ms, reply chars=${text.length}, tokens=${JSON.stringify(body?.usage ?? {})}`);
  if (!res.ok) console.log("error type:", body?.error?.type, "| message:", body?.error?.message);
  if (res.ok) { console.log("GROQ OK with", model); process.exit(0); }
}
console.log("GROQ FAILED for all models");
process.exit(1);
