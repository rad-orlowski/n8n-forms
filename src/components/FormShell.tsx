import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get } from "es-toolkit/compat";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FIELD_REGISTRY, STATIC_FIELD_REGISTRY } from "@/components/fields";
import { StepDataContext } from "@/components/StepDataContext";
import {
  buildZodSchema,
  defaultValues,
  isStaticField,
  type FieldDef,
  type FormSchema,
  type ResponseConfig,
} from "@/lib/schema";
import {
  openEventStream,
  startForm,
  stepForm,
} from "@/lib/submit";

// ── wizard state ─────────────────────────────────────────────────────────────

type WizardPhase =
  | { kind: "form" }           // filling out the active page
  | { kind: "pending" }        // waiting for SSE callback
  | { kind: "error"; message: string; status: number }
  | { kind: "done"; data: unknown };

// ── main component ────────────────────────────────────────────────────────────

export function FormShell({
  schema,
  token,
}: {
  schema: FormSchema;
  token: string | null;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // stepData is the `data` payload from the BFF for the *current* page.
  // It starts null (page 0 has no n8n data yet), then is set after each step.
  const [stepData, setStepData] = useState<unknown>(null);
  const [phase, setPhase] = useState<WizardPhase>({ kind: "form" });

  const page = schema.pages[currentPage];

  // Pre-compute per-page zod schema and default values from this page's fields.
  // valueFrom pre-fills fields whose values come from n8n step data.
  const zodSchema = useMemo(
    () => buildZodSchema(page.fields),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage, page.fields],
  );

  const resolvedDefaults = useMemo(() => {
    const base = defaultValues(page.fields);
    // Apply valueFrom bindings for pages ≥ 1 that have stepData available
    if (stepData !== null) {
      for (const f of page.fields) {
        if (f.valueFrom && f.name) {
          const v = get(stepData as object, f.valueFrom);
          if (v !== undefined) base[f.name] = v;
        }
      }
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, stepData]);

  const form = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: resolvedDefaults,
    mode: "onTouched",
  });

  // Reset the RHF instance whenever the page advances.
  useEffect(() => {
    form.reset(resolvedDefaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const formRef = useRef<HTMLFormElement>(null);

  // ── SSE handling ────────────────────────────────────────────────────────────

  const handleSse = useCallback(
    (sid: string) => {
      setPhase({ kind: "pending" });
      const es = openEventStream(sid);

      es.addEventListener("step", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data as string) as {
            data: unknown;
            done: boolean;
          };
          es.close();
          if (payload.done) {
            setStepData(payload.data);
            setPhase({ kind: "done", data: payload.data });
          } else {
            setStepData(payload.data);
            setCurrentPage((p) => p + 1);
            setPhase({ kind: "form" });
          }
        } catch {
          es.close();
          setPhase({
            kind: "error",
            message: "Received malformed data from the server.",
            status: 0,
          });
        }
      });

      es.onerror = () => {
        es.close();
        setPhase({
          kind: "error",
          message: "Lost connection to the server while waiting for a response.",
          status: 0,
        });
      };
    },
    [],
  );

  // ── submit handler ──────────────────────────────────────────────────────────

  async function onSubmit(values: Record<string, unknown>) {
    setPhase({ kind: "pending" });

    if (currentPage === 0) {
      // First page — kick off a new n8n execution
      const res = await startForm(schema.slug, values, token);

      if ("ok" in res) {
        // BffError
        setPhase({ kind: "error", message: res.message, status: res.status });
        return;
      }

      setSessionId(res.sessionId);

      if (res.pending) {
        handleSse(res.sessionId);
        return;
      }

      // Sync result
      if (res.done) {
        setStepData(res.data);
        setPhase({ kind: "done", data: res.data });
      } else {
        setStepData(res.data);
        setCurrentPage(1);
        setPhase({ kind: "form" });
      }
    } else {
      // Subsequent pages — resume the n8n execution
      if (!sessionId) {
        setPhase({ kind: "error", message: "No active session.", status: 0 });
        return;
      }

      const res = await stepForm(sessionId, values);

      if ("ok" in res) {
        setPhase({ kind: "error", message: res.message, status: res.status });
        return;
      }

      if (res.pending) {
        handleSse(sessionId);
        return;
      }

      if (res.done) {
        setStepData(res.data);
        setPhase({ kind: "done", data: res.data });
      } else {
        setStepData(res.data);
        setCurrentPage((p) => p + 1);
        setPhase({ kind: "form" });
      }
    }
  }

  // ── start over ───────────────────────────────────────────────────────────────

  function startOver() {
    setCurrentPage(0);
    setSessionId(null);
    setStepData(null);
    setPhase({ kind: "form" });
    form.reset(defaultValues(schema.pages[0].fields));
  }

  // ── shake animation on invalid submit ────────────────────────────────────────

  function onInvalidSubmit() {
    const el = formRef.current;
    if (!el) return;
    el.classList.remove("animate-shake");
    void el.offsetWidth;
    el.classList.add("animate-shake");
    el.addEventListener(
      "animationend",
      () => el.classList.remove("animate-shake"),
      { once: true },
    );
  }

  // ── done (success) state ─────────────────────────────────────────────────────

  if (phase.kind === "done") {
    return (
      <section className="animate-rise">
        <BackLink />
        <div className="animate-panel-in mt-6 rounded-lg border border-success/40 bg-success/5 p-8">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <h2 className="mt-4 text-2xl font-semibold">Sent</h2>
            <p className="mt-2 text-muted-foreground">
              {schema.successMessage ??
                "Your submission was handed off to the workflow."}
            </p>
          </div>

          {schema.response && phase.data !== undefined && (
            <ResponsePanel
              responseConfig={schema.response}
              data={phase.data}
            />
          )}

          <div className="mt-6 text-center">
            <Button variant="outline" onClick={startOver}>
              Submit another
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // ── error state ───────────────────────────────────────────────────────────────

  if (phase.kind === "error") {
    return (
      <section className="animate-rise">
        <BackLink />
        <div className="animate-panel-in mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-8">
          <div className="text-center">
            <TriangleAlert className="mx-auto h-10 w-10 text-destructive" />
            <h2 className="mt-4 text-2xl font-semibold">Error</h2>
            <p className="mt-2 text-muted-foreground">
              {phase.message}
              {phase.status ? ` (HTTP ${phase.status})` : ""}
            </p>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            {/* Retry is only offered when the active page explicitly opts in */}
            {page.retryable && (
              <Button
                variant="outline"
                onClick={() => setPhase({ kind: "form" })}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
            <Button variant="outline" onClick={startOver}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start over
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // ── pending (SSE wait) state ──────────────────────────────────────────────────

  if (phase.kind === "pending") {
    return (
      <section className="animate-rise">
        <BackLink />
        <div className="mt-6 flex flex-col items-center gap-4 py-16 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm">Waiting for workflow response…</p>
          <Button variant="ghost" size="sm" onClick={startOver}>
            Cancel
          </Button>
        </div>
      </section>
    );
  }

  // ── form (active page) state ──────────────────────────────────────────────────

  const pageCount = schema.pages.length;

  return (
    <section className="animate-rise">
      <BackLink />

      <header className="mt-6">
        <p className="label-tech">
          form · {schema.slug}
          {pageCount > 1 && (
            <span className="ml-2 text-muted-foreground">
              · step {currentPage + 1}/{pageCount}
            </span>
          )}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {schema.icon && (
            <schema.icon className="h-8 w-8 shrink-0 text-primary opacity-80" />
          )}
          <h1 className="text-3xl font-bold md:text-4xl">{schema.title}</h1>
        </div>
        {/* Page-level title (if different from form title) */}
        {page.title && page.title !== schema.title && (
          <h2 className="mt-1 text-xl font-semibold text-muted-foreground">
            {page.title}
          </h2>
        )}
        {(page.description ?? schema.description) && (
          <p className="mt-2 max-w-prose text-muted-foreground">
            {page.description ?? schema.description}
          </p>
        )}
        <div className="rule-tech mt-5" />
      </header>

      {/* Provide step data to all field components so optionsFrom / valueFrom can resolve */}
      <StepDataContext.Provider value={stepData}>
        <Form {...form}>
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)}
            className="mt-6 space-y-6"
          >
            {page.fields.map((def, i) => {
              if (isStaticField(def)) {
                const StaticComponent = STATIC_FIELD_REGISTRY[def.type];
                if (!StaticComponent) return null;
                return (
                  <StaticComponent
                    key={def.name ?? `__static_${i}`}
                    def={def}
                  />
                );
              }
              return (
                <FormField
                  key={def.name ?? `__input_${i}`}
                  control={form.control}
                  name={def.name ?? `__input_${i}`}
                  render={({ field }) => <FieldRow def={def} field={field} />}
                />
              );
            })}

            <div className="flex items-center justify-between gap-4 pt-2">
              {/* Start over is always available once a session exists */}
              {sessionId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="font-mono text-xs text-muted-foreground"
                  onClick={startOver}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Start over
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" className="min-w-36">
                <Send className="mr-2 h-4 w-4" />
                {schema.submitLabel ?? (currentPage < pageCount - 1 ? "Next" : "Submit")}
              </Button>
            </div>
          </form>
        </Form>
      </StepDataContext.Provider>
    </section>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({
  def,
  field,
}: {
  def: FieldDef;
  field: Parameters<
    NonNullable<React.ComponentProps<typeof FormField>["render"]>
  >[0]["field"];
}) {
  const Component = FIELD_REGISTRY[def.type] ?? FIELD_REGISTRY.text;
  const required = def.required ? (
    <span className="ml-1 text-primary">*</span>
  ) : null;

  // Checkbox reads best with the control beside the label.
  if (def.type === "checkbox") {
    return (
      <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border border-border/60 p-4">
        <FormControl>
          <Component field={field} def={def} />
        </FormControl>
        <div className="space-y-1 leading-none">
          {def.label && (
            <FormLabel>
              {def.label}
              {required}
            </FormLabel>
          )}
          {def.description && (
            <FormDescription>{def.description}</FormDescription>
          )}
          <FormMessage className="animate-error-in" />
        </div>
      </FormItem>
    );
  }

  return (
    <FormItem>
      {def.label && (
        <FormLabel>
          {def.label}
          {required}
        </FormLabel>
      )}
      <FormControl>
        <Component field={field} def={def} />
      </FormControl>
      {def.description && <FormDescription>{def.description}</FormDescription>}
      <FormMessage className="animate-error-in" />
    </FormItem>
  );
}

// ── BackLink ──────────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <a
      href="#/"
      className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      console
    </a>
  );
}

// ── resolveResponseValue ──────────────────────────────────────────────────────

/**
 * Resolve a response dot-path against the BFF's `data` payload, which may
 * arrive as a bare object `{...}` or array-wrapped `[{...}]`. We unwrap a
 * single-element array so object-style paths ("body.message") work either way,
 * and still tolerate legacy "0."-prefixed paths.
 */
function resolveResponseValue(data: unknown, key: string): unknown {
  const root = Array.isArray(data) && data.length === 1 ? data[0] : data;
  let v = get(root as object, key);
  if (v === undefined && key.startsWith("0.")) v = get(root as object, key.slice(2));
  if (v === undefined) v = get(data as object, key);
  return v;
}

// ── ResponsePanel ─────────────────────────────────────────────────────────────

/**
 * Renders the declared response fields from the BFF's `data` payload.
 * Falls back to displaying the raw JSON string if no structured fields match.
 */
function ResponsePanel({
  responseConfig,
  data,
}: {
  responseConfig: ResponseConfig;
  data: unknown;
}) {
  function formatValue(raw: unknown): string {
    if (raw === undefined || raw === null) return "—";
    if (typeof raw === "boolean") return raw ? "Yes" : "No";
    if (typeof raw === "object") return JSON.stringify(raw);
    return String(raw);
  }

  const hasStructured =
    data !== null && data !== undefined && typeof data === "object";

  return (
    <div className="mt-6 border-t border-success/20 pt-5">
      <p className="label-tech mb-3">{responseConfig.title ?? "Response"}</p>

      {hasStructured ? (
        <dl className="space-y-2">
          {responseConfig.fields.map(({ key, label }, i) => {
            const raw = resolveResponseValue(data, key);
            return (
              <div
                key={key}
                className="animate-field-in flex flex-col gap-0.5"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <dt className="label-tech text-[10px]">{label ?? key}</dt>
                <dd className="font-mono text-sm text-foreground break-all">
                  {formatValue(raw)}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        // Non-object fallback — show raw value truncated to 500 chars
        data != null &&
        String(data).trim() && (
          <pre className="rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
            {String(data).slice(0, 500)}
          </pre>
        )
      )}
    </div>
  );
}
