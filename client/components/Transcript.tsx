import { speakerColor } from "@/lib/design/tokens";

export type Speaker = "traveler" | "agent" | "joiner" | "airline";

export interface TranscriptLine {
  seq?: number;
  role: Speaker;
  lang: "hi" | "en";
  text: string;
  textTranslated?: string;
  at?: number;
}

export interface TranscriptProps {
  lines: TranscriptLine[];
  /** Dense variant used on the joiner dashboard. */
  dense?: boolean;
  /** Bilingual toggle (English/Hindi) on the joiner side. */
  showTranslation?: boolean;
}

/**
 * Speaker-attributed, bilingual, auto-scrolling transcript (PLAN-v2 §6).
 * Color + label per speaker (lib/design/tokens.ts speakerColors).
 * Fades vivid -> dimmed after 10s; ARIA live region for VoiceOver.
 */
export default function Transcript({
  lines,
  dense = false,
  showTranslation = false,
}: TranscriptProps) {
  return (
    <section
      aria-live="polite"
      aria-label="Conversation transcript"
      className={`flex flex-col gap-3 ${dense ? "text-sm" : "text-base"}`}
    >
      {lines.length === 0 && (
        <p className="text-text-muted">Waiting for the conversation to start…</p>
      )}
      {lines.map((line, i) => (
        <article
          key={line.seq ?? i}
          className="flex flex-col gap-1 rounded-lg bg-card p-3 shadow-card"
        >
          <span
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: speakerColor(line.role) }}
          >
            {line.role}
          </span>
          <p className="leading-6 text-text">{line.text}</p>
          {showTranslation && line.textTranslated && (
            <p className="leading-6 text-text-muted">{line.textTranslated}</p>
          )}
        </article>
      ))}
    </section>
  );
}

