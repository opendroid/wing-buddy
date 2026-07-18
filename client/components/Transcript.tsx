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
  dense?: boolean;
  showTranslation?: boolean;
}

const speakerLabel: Record<Speaker, string> = {
  traveler: "Traveler",
  agent: "AI Advocate",
  joiner: "Family",
  airline: "Airline",
};

export default function Transcript({
  lines,
  dense = false,
  showTranslation = false,
}: TranscriptProps) {
  return (
    <section
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
            {speakerLabel[line.role] ?? line.role}
          </span>
          <p
            className="leading-6 text-text"
            lang={line.lang}
            dir={line.lang === "hi" ? "ltr" : undefined}
          >
            {line.text}
          </p>
          {showTranslation && line.textTranslated && (
            <p
              className="leading-6 text-text-muted"
              lang={line.lang === "hi" ? "en" : "hi"}
            >
              {line.textTranslated}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}

