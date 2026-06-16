import type { FieldDef } from "./schema";
import { evaluateCondition } from "./expr";

/**
 * Given a page's fields and the current form values, return the fields that
 * should render: drop any whose `visibleIf` is false, and resolve `required`
 * from `requiredIf` where present.
 */
export function resolveVisibleFields(
  fields: FieldDef[],
  values: Record<string, unknown>,
): FieldDef[] {
  const out: FieldDef[] = [];
  for (const f of fields) {
    if (f.visibleIf && !evaluateCondition(f.visibleIf, values)) continue;
    if (f.requiredIf) {
      out.push({ ...f, required: evaluateCondition(f.requiredIf, values) });
    } else {
      out.push(f);
    }
  }
  return out;
}
