import type { FieldOption } from "@/lib/schema";

/**
 * Decides whether an `onValueChange` from Radix `Select` is a spurious empty
 * clear that should be ignored. Radix can emit `onValueChange("")` on mount when
 * a controlled value is set before its items register — which would clobber a
 * preselected value (prefillFromQuery / valueFrom). That noise is identifiable:
 * the incoming value is empty *and* the field still holds a value that is itself
 * a valid option. A genuine clear — the selected option vanished from a refreshed
 * list, so the current value is no longer an option — is NOT spurious and must
 * propagate. (Radix disallows empty-string option values, so a real user
 * selection is never `""`.)
 *
 * Lives in its own module (not select-field.tsx) so the component file only
 * exports a component — the react-refresh / fast-refresh constraint.
 */
export function isSpuriousEmptyChange(
  next: string,
  current: unknown,
  options: FieldOption[],
): boolean {
  return next === "" && !!current && options.some((o) => o.value === current);
}
