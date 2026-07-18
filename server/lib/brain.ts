// The WingBuddy brain. Deterministic keyword intent routing (kept simple for a
// reliable demo), calls into lib/sabre.ts (mock or real) + lib/facilities.ts,
// appends events, and returns ONE short Hindi sentence. The medical guardrail is
// enforced HERE as well as in the VB prompt (CLAUDE.md).

import type { Session } from "./session-store";
import { appendEvent, mutateSession } from "./session-store";
import { addSSR, readSSR } from "./sabre";
import { detectNeed, lookupFacility } from "./facilities";

export type Intent =
  | "wheelchair"
  | "medical_decline"
  | "facilities"
  | "flight_recheck"
  | "flight_status"
  | "notify_family"
  | "reassure";

const REASSURE = "आप ठीक कर रहे हैं।"; // "you're doing fine."

function pnr(): string {
  return process.env.SABRE_TEST_PNR || "MOCKPNR";
}

// --- keyword detectors ---

const SYMPTOM = ["pain", "fever", "chest", "dizzy", "nausea", "breath", "bleeding", "दर्द", "बुखार", "चक्कर", "सांस", "साँस"];
const DOSING = ["dose", "dosage", "how much", "how many", "overdose", "कितनी", "कितना", "खाऊँ", "खाऊं", "लूँ", "लूं"];
const MEDICINE = ["medicine", "medication", "pill", "tablet", "दवा", "दवाई", "गोली"];
const WHEELCHAIR = ["wheelchair", "व्हीलचेयर", "व्हील चेयर", "wchr"];
const RECHECK = ["re-check", "recheck", "check booking", "flight changed", "gate change", "गेट बदल", "फिर से", "दोबारा"];
const STATUS = ["status", "flight", "gate", "time", "delay", "फ्लाइट", "गेट", "समय", "देरी"];
const NOTIFY = ["tell my family", "notify", "inform", "परिवार को बता", "family ko"];

function has(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

// Advice-seeking about symptoms or dosing (not a plain facility ask).
export function isMedicalAdvice(text: string): boolean {
  if (has(text, SYMPTOM)) return true;
  if (has(text, DOSING) && has(text, MEDICINE)) return true;
  return false;
}

export function classifyIntent(text: string): Intent {
  if (has(text, WHEELCHAIR)) return "wheelchair";
  if (isMedicalAdvice(text)) return "medical_decline";
  if (detectNeed(text)) return "facilities";
  if (has(text, RECHECK)) return "flight_recheck";
  if (has(text, NOTIFY)) return "notify_family";
  if (has(text, STATUS)) return "flight_status";
  return "reassure";
}

export interface BrainResult {
  intent: Intent;
  answer: string; // one Hindi sentence
}

export async function handleQuery(
  session: Session,
  query: string
): Promise<BrainResult> {
  const intent = classifyIntent(query);

  switch (intent) {
    case "wheelchair": {
      const value = await addSSR(pnr(), "WCHR");
      await mutateSession(session, (s) => {
        s.ssr = value;
      });
      await appendEvent(session, { type: "agent_action", label: "Filed wheelchair (WCHR)" });
      await appendEvent(session, { type: "ssr_update", value });
      return {
        intent,
        answer: `मैंने आपकी व्हीलचेयर की व्यवस्था कर दी है, यह आपके गेट ${session.flight.gate} पर मिलेगी। ${REASSURE}`,
      };
    }

    case "flight_recheck": {
      // Re-check the booking; if the SSR was silently dropped, re-add it.
      const current = session.ssr === "dropped" ? await readSSR(pnr()) : session.ssr;
      let value = current;
      if (session.ssr === "dropped") {
        value = await addSSR(pnr(), "WCHR");
        await appendEvent(session, {
          type: "agent_action",
          label: "Re-checked booking; re-added WCHR",
        });
        await appendEvent(session, { type: "ssr_update", value });
      } else {
        await appendEvent(session, {
          type: "agent_action",
          label: "Re-checked booking; wheelchair OK",
        });
      }
      await mutateSession(session, (s) => {
        s.ssr = value;
      });
      return {
        intent,
        answer: `आपका गेट बदलकर ${session.flight.gate} हो गया है, और आपकी व्हीलचेयर फिर से confirm हो गई है। ${REASSURE}`,
      };
    }

    case "facilities": {
      const need = detectNeed(query)!;
      const fac = lookupFacility(session.flight.origin, need);
      if (fac) {
        await appendEvent(session, {
          type: "facilities",
          airport: fac.airport,
          need: fac.need,
          result: fac.result,
        });
        await appendEvent(session, { type: "agent_action", label: `Facilities: ${need}` });
        return {
          intent,
          answer: `आपको जो चाहिए वह पास में है — ${fac.result} मैं आपके परिवार को भी बता सकती हूँ। ${REASSURE}`,
        };
      }
      return {
        intent,
        answer: `मैं पास की सुविधा ढूँढ़ रही हूँ, एक पल दीजिए। ${REASSURE}`,
      };
    }

    case "medical_decline": {
      // Never advise on medication/symptoms/dosing. Logistics only.
      await appendEvent(session, {
        type: "agent_action",
        label: "Declined medical advice; offered facilities + family",
      });
      return {
        intent,
        answer: `मैं दवा के बारे में सलाह नहीं दे सकती, पर मैं मदद कर सकती हूँ — पास में मेडिकल रूम है और मैं आपके परिवार को बता सकती हूँ। ${REASSURE}`,
      };
    }

    case "flight_status": {
      await appendEvent(session, { type: "agent_action", label: "Checked flight status" });
      const f = session.flight;
      const statusHi =
        f.status === "delayed"
          ? `${f.delayMin} मिनट देरी से`
          : f.status === "cancelled"
            ? "रद्द"
            : "समय पर";
      return {
        intent,
        answer: `आपकी फ्लाइट ${f.carrier} ${f.number} ${statusHi} है, गेट ${f.gate}। ${REASSURE}`,
      };
    }

    case "notify_family": {
      await appendEvent(session, { type: "agent_action", label: "Offered to notify family" });
      return {
        intent,
        answer: `मैं आपके परिवार को अभी बता देती हूँ। ${REASSURE}`,
      };
    }

    default: {
      return {
        intent: "reassure",
        answer: `मैं आपके साथ हूँ, धीरे-धीरे बताइए क्या चाहिए। ${REASSURE}`,
      };
    }
  }
}
