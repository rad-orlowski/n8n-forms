import { createContext } from "react";

/**
 * Provides the opaque `data` payload returned by the BFF after each wizard
 * step to all field components in the active page.
 *
 * `null` means no step data exists yet (page 0 or pre-submit state).
 * Field components that support `optionsFrom` / `valueFrom` read from this
 * context and fall back to static `def.options` / `def.value` when null.
 */
export const StepDataContext = createContext<unknown>(null);
