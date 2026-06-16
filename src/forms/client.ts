import { useEffect, useState } from "react";
import type { FormSchema } from "@/lib/schema";

export interface RejectedForm {
  file: string;
  errors: string[];
}
export interface FormsState {
  forms: FormSchema[];
  rejected: RejectedForm[];
  loading: boolean;
}

/**
 * Fetches the runtime-loaded forms from the BFF (GET /api/forms) once on mount.
 * Degrades to an empty list when the endpoint is unavailable (e.g. the BFF-less
 * `dev:vite` server), mirroring the /api/config fallback.
 */
export function useForms(): FormsState {
  const [state, setState] = useState<FormsState>({
    forms: [],
    rejected: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/forms")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: { forms?: FormSchema[]; rejected?: RejectedForm[] } | null) => {
          if (cancelled) return;
          setState({
            forms: data?.forms ?? [],
            rejected: data?.rejected ?? [],
            loading: false,
          });
        },
      )
      .catch(() => {
        if (!cancelled) setState({ forms: [], rejected: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
