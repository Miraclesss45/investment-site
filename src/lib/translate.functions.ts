import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  lang: z.string().min(2).max(10),
  language: z.string().min(2).max(40),
  texts: z.array(z.string()).min(1).max(120),
});

export const translateTexts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Translation service is not configured");

    const payload = data.texts.map((text, index) => ({ i: index, t: text }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              `You are a professional website localiser. Translate each string from English into ${data.language}. ` +
              "Keep the meaning, tone and capitalisation style (if the source is ALL CAPS, keep it ALL CAPS). " +
              "Never translate brand names (MeridianVest), currency codes, crypto names (Bitcoin, USDT, Ethereum, Litecoin), " +
              "email addresses, URLs, numbers, dates or wallet addresses. " +
              'Reply with JSON only: {"items":[{"i":0,"t":"translated"}, ...]} with exactly the same indexes.',
          },
          { role: "user", content: JSON.stringify({ items: payload }) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Translation failed (${response.status}): ${detail.slice(0, 200)}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { items?: Array<{ i: number; t: string }> } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const out: Record<string, string> = {};
    for (const item of parsed.items ?? []) {
      const source = data.texts[item.i];
      if (typeof source === "string" && typeof item.t === "string" && item.t.trim()) out[source] = item.t;
    }
    return out;
  });
