// Hindi <-> English bridge. Phrase map covers the scripted demo lines; anything
// else falls through. M3 upgrades the fallback to the Anthropic API
// (claude-haiku-4-5) behind this same signature. Skips when src === dst.

export type Lang = "hi" | "en";

// Scripted demo lines (both directions) — deterministic, offline.
const PHRASES: Array<{ hi: string; en: string }> = [
  {
    hi: "मेरी फ्लाइट का टाइम बदल गया है और मुझे व्हीलचेयर चाहिए",
    en: "My flight time has changed and I need a wheelchair",
  },
  {
    hi: "मुझे दवाई के लिए पानी चाहिए",
    en: "I need water for my medicine",
  },
  {
    hi: "मैं यहाँ आपकी मदद के लिए हूँ",
    en: "I am here to help you",
  },
];

function lookup(text: string, src: Lang, dst: Lang): string | null {
  const needle = text.trim();
  for (const p of PHRASES) {
    if (p[src] === needle) return p[dst];
  }
  return null;
}

export interface TranslateResult {
  text: string;
  translated: boolean; // false = passthrough (no mapping and no API available)
}

const LANG_NAME: Record<Lang, string> = { hi: "Hindi", en: "English" };

let _client: import("@anthropic-ai/sdk").default | null = null;
async function anthropic() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  _client = new Anthropic();
  return _client;
}

export async function translate(
  text: string,
  src: Lang,
  dst: Lang
): Promise<TranslateResult> {
  if (src === dst) return { text, translated: true };

  // Scripted lines first — deterministic, offline, no API cost.
  const mapped = lookup(text, src, dst);
  if (mapped) return { text: mapped, translated: true };

  // Fall back to the Anthropic API (claude-haiku-4-5 — cheap/fast for short lines).
  const client = await anthropic();
  if (!client) return { text, translated: false };
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system: `Translate the user's message from ${LANG_NAME[src]} to ${LANG_NAME[dst]}. Reply with ONLY the translation — no quotes, no notes, no preamble.`,
      messages: [{ role: "user", content: text }],
    });
    const out = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return out ? { text: out, translated: true } : { text, translated: false };
  } catch {
    return { text, translated: false };
  }
}
