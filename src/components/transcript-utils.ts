/** Single source of truth for which messages are rendered in the transcript. */
export function visibleMessages(messages: Array<Record<string, string>>) {
  return messages.filter((m) => m.status !== "superseded");
}
