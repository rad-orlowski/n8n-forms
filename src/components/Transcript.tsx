// src/components/Transcript.tsx
import { sanitizeHtml } from "@/lib/sanitize";

/** Single source of truth for which messages are rendered in the transcript. */
export function visibleMessages(messages: Array<Record<string, string>>) {
  return messages.filter((m) => m.status !== "superseded");
}

export function Transcript({ messages }: { messages: Array<Record<string, string>> }) {
  const visible = visibleMessages(messages);
  if (!visible.length) return null;
  return (
    <ol className="transcript">
      {visible.map((m, i) => {
        const dir = m.direction === "inbound" ? "in" : m.status === "draft" ? "draft" : "out";
        const who = dir === "in" ? "← recruiter" : dir === "draft" ? "draft" : "→ you";
        const meta = [who, m.channel, m.status, m.ts].filter(Boolean).join(" · ");
        return (
          <li key={m.ts ?? i} className="transcript-row">
            <span className={`transcript-dot ${dir}`} aria-hidden />
            <div>
              <div className="label-tech text-[10px] mb-0.5 text-muted-foreground">{meta}</div>
              <div className="text-sm text-foreground/90 break-words leading-snug"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.body ?? "") }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
