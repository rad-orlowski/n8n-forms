import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { get } from "es-toolkit/compat";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { SelectedItemsContext } from "@/components/SelectedItemsContext";
import {
  buildZodSchema,
  defaultValues,
  isStaticField,
  resolveTimeoutMs,
  type FieldDef,
  type FormSchema,
  type ResponseConfig,
} from "@/lib/schema";
import { resolveVisibleFields } from "@/lib/resolve-fields";
import { expressionVariables } from "@/lib/expr";
import { resolveIcon } from "@/lib/icons";
import { openEventStream, startForm, stepForm } from "@/lib/submit";
import { TableRenderer } from "./table/TableRenderer";
import type { Row } from "./table/registry";
// Loads form-supplied table renderer extensions (registers cell/section
// renderers by name) before any table renders. Generic — no domain knowledge.
import "./table/extensions";
import { Transcript } from "./Transcript";
import { visibleMessages } from "./transcript-utils";

// ── response panel defaults ────────────────────────────────────────────────────

const DEFAULT_HEADING = "Sent";
const DEFAULT_MESSAGE = "Your submission was handed off to the workflow.";
const DEFAULT_TITLE = "Response";

// ── wizard state ─────────────────────────────────────────────────────────────

type WizardPhase =
  | { kind: "form" } // filling out the active page
  | { kind: "pending" } // waiting for SSE callback
  | { kind: "error"; message: string; status: number }
  | { kind: "done"; data: unknown };

// Warn once per unknown field type. FieldDef.type is an open string at runtime
// (forms are data, not code), so a typo like `type: "emil"` has no compile-time
// guard — without this it would silently fall through to a text input (or render
// nothing for a static slot). Deduped so a repeated type warns only once.
const warnedFieldTypes = new Set<string>();
function warnUnknownFieldType(type: string, kind: "input" | "static") {
  if (warnedFieldTypes.has(type)) return;
  warnedFieldTypes.add(type);
  console.warn(
    `[forms] unknown ${kind} field type "${type}" — ${
      kind === "input"
        ? "falling back to a text input."
        : "nothing will render."
    }`,
  );
}

// ── main component ────────────────────────────────────────────────────────────

/**
 * Resolves the set of valid option *values* for a dynamic select from n8n step
 * data. Mirrors select-field.tsx's two modes (raw-object mapping via
 * optionValue, or pre-shaped `[{label,value}]`). Used to guard prefillFromQuery
 * so a stale value (e.g. an opp already acted on) is never silently preselected.
 */
function optionValuesFromStepData(stepData: unknown, def: FieldDef): string[] {
  if (!def.optionsFrom || stepData === null) return [];
  const arr = get(stepData as object, def.optionsFrom);
  if (!Array.isArray(arr)) return [];
  if (def.optionValue) {
    return arr
      .map((raw) => String(get(raw as object, def.optionValue!)))
      .filter((v) => v !== "undefined" && v !== "null");
  }
  return arr
    .map((o) => String((o as { value?: unknown })?.value))
    .filter((v) => v !== "undefined" && v !== "null");
}

export function FormShell({
  schema,
  queryParams,
}: {
  schema: FormSchema;
  queryParams?: Record<string, string>;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // stepData is the `data` payload from the BFF for the *current* page.
  // It starts null (page 0 has no n8n data yet), then is set after each step.
  const [stepData, setStepData] = useState<unknown>(null);
  const [phase, setPhase] = useState<WizardPhase>({ kind: "form" });
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshable = schema.pages.length === 1 && schema.pages[0].method === "GET";
  // selectedItems holds the full raw n8n object for each select field on the
  // active page; used by sibling fields that declare valueFromField.
  const [selectedItems, setSelectedItems] = useState<Record<string, unknown>>(
    {},
  );
  const setItem = useCallback(
    (name: string, raw: unknown) =>
      setSelectedItems((p) => ({ ...p, [name]: raw })),
    [],
  );

  const page = schema.pages[currentPage];

  // Pre-compute per-page default values from this page's fields.
  // valueFrom pre-fills fields whose values come from n8n step data.
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
    // Apply prefillFromQuery bindings: seed a field from a URL query param.
    // For a dynamic select, only apply when the value matches a loaded option
    // so a stale value is neither preselected nor submitted untouched.
    if (queryParams) {
      for (const f of page.fields) {
        if (!f.prefillFromQuery || !f.name) continue;
        const qv = queryParams[f.prefillFromQuery];
        if (!qv) continue;
        if (f.optionsFrom) {
          if (stepData === null) continue;
          if (!optionValuesFromStepData(stepData, f).includes(qv)) continue;
        }
        base[f.name] = qv;
      }
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, stepData, queryParams]);

  // True when a prefillFromQuery param was present but matched no loaded option
  // (e.g. a deep-linked opp already acted on). Drives an explanatory notice so
  // the user understands why nothing is preselected. Null while step data for a
  // dynamic field hasn't loaded yet, so no premature notice on the load page.
  const prefillMiss = useMemo(() => {
    if (!queryParams) return false;
    for (const f of page.fields) {
      if (!f.prefillFromQuery || !f.name) continue;
      const qv = queryParams[f.prefillFromQuery];
      if (!qv) continue;
      if (f.optionsFrom) {
        if (stepData === null) return false;
        if (!optionValuesFromStepData(stepData, f).includes(qv)) return true;
      }
    }
    return false;
  }, [page.fields, stepData, queryParams]);

  // Ref-backed schema so RHF's resolver always validates against the current
  // set of visible/required fields (RHF captures the resolver at init and
  // won't re-read it on re-render; the ref bridges that gap).
  const schemaRef = useRef(buildZodSchema(page.fields));

  const form = useForm({
    resolver: (values, ctx, opts) =>
      zodResolver(schemaRef.current)(values, ctx, opts),
    defaultValues: resolvedDefaults,
    mode: "onTouched",
  });

  // Field names referenced by any visibleIf/requiredIf on this page. We narrow
  // form.watch to just these so typing in a field no condition depends on does
  // not re-render the whole shell (the prior `form.watch()` watched everything).
  const conditionDeps = useMemo(() => {
    const names = new Set<string>();
    for (const f of page.fields) {
      for (const key of ["visibleIf", "requiredIf"] as const) {
        const expr = f[key];
        if (expr) for (const v of expressionVariables(expr)) names.add(v);
      }
    }
    return [...names];
  }, [page.fields]);

  // Values of only the condition-referenced fields. Empty array when the page
  // has no conditional fields → no per-keystroke re-render at all.
  const watchedDeps = form.watch(conditionDeps);
  const watchScope = useMemo(() => {
    const scope: Record<string, unknown> = {};
    conditionDeps.forEach((name, i) => {
      scope[name] = watchedDeps[i];
    });
    return scope;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionDeps, JSON.stringify(watchedDeps)]);

  // Recompute visible/required fields whenever a referenced value changes.
  // (page.fields identity changes per page, so currentPage isn't a dep.)
  const resolvedFields = useMemo(
    () => resolveVisibleFields(page.fields, watchScope),
    [page.fields, watchScope],
  );
  // Keep the resolver's schema in sync with the resolved (visible) fields.
  // Assigning a memoized value to a ref during render is intentional and safe
  // here: it's deterministic, and the resolver closure reads schemaRef.current
  // at validation time (never during render), so there's no tearing.
  schemaRef.current = useMemo(
    () => buildZodSchema(resolvedFields),
    [resolvedFields],
  );

  // Names of the input fields currently visible on this page.
  const visibleInputNames = useMemo(() => {
    const set = new Set<string>();
    for (const f of resolvedFields) {
      if (!isStaticField(f) && f.name) set.add(f.name);
    }
    return set;
  }, [resolvedFields]);

  // Strip values of fields hidden by `visibleIf` out of the RHF store so
  // form.handleSubmit never delivers them to n8n. resolveVisibleFields only
  // narrows rendering + Zod validation; without this the last value of a field
  // hidden for the current branch would still be submitted. A field shown again
  // re-registers from defaults via its FormField.
  useEffect(() => {
    for (const f of page.fields) {
      if (isStaticField(f) || !f.name) continue;
      if (!visibleInputNames.has(f.name)) form.unregister(f.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleInputNames, currentPage]);

  // Reset the RHF instance and selected-item context whenever the page advances.
  useEffect(() => {
    form.reset(resolvedDefaults);
    // Intentional: clear selected raw items when navigating to a new page so a
    // prior page's selection can't leak into a sibling field's valueFromField.
    setSelectedItems({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const formRef = useRef<HTMLFormElement>(null);

  // ── SSE handling ────────────────────────────────────────────────────────────

  const handleSse = useCallback((sid: string) => {
    setPhase({ kind: "pending" });
    const es = openEventStream(sid);

    es.addEventListener("step", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data as string) as {
          data: unknown;
          done: boolean;
          workflowError?: boolean;
          errorMessage?: string;
        };
        es.close();
        // Workflow-level business error: n8n signalled __error: true.
        if (payload.workflowError) {
          setPhase({
            kind: "error",
            message: payload.errorMessage ?? "The workflow reported an error.",
            status: 0,
          });
          return;
        }
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
  }, []);

  // ── submit handler ──────────────────────────────────────────────────────────

  async function onSubmit(values: Record<string, unknown>) {
    setPhase({ kind: "pending" });

    if (currentPage === 0) {
      // First page — kick off a new n8n execution
      const res = await startForm(
        schema.slug,
        values,
        page.resumeUrlPath,
        page.method,
        resolveTimeoutMs(schema, page),
      );

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

      const res = await stepForm(
        sessionId,
        values,
        page.resumeUrlPath,
        page.method,
        resolveTimeoutMs(schema, page),
      );

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

  // ── refresh (single-page GET forms only) ────────────────────────────────────

  async function refresh() {
    // Re-entrance guard: don't start a second refresh if one is already running.
    // The disabled button state on the UI is a first line of defence; this guard
    // covers programmatic calls or rapid double-clicks that bypass the DOM.
    if (refreshing) return;

    const page = schema.pages[0];
    setRefreshing(true);
    const res = await startForm(schema.slug, {}, page.resumeUrlPath, page.method, resolveTimeoutMs(schema, page));
    setRefreshing(false);

    if ("ok" in res) {
      // BffError
      setPhase({ kind: "error", message: res.message, status: res.status });
      return;
    }

    if (res.pending) {
      // Async path: n8n replied 202 — open SSE stream, same as onSubmit page-0.
      setSessionId(res.sessionId);
      handleSse(res.sessionId);
      return;
    }

    // Sync result
    if (res.done) {
      setStepData(res.data);
      setPhase({ kind: "done", data: res.data });
    }
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
    const header = schema.response?.header;
    const headerStyle = header?.style ?? "compact";
    const heading = header?.heading ?? DEFAULT_HEADING;
    const message = header?.message ?? DEFAULT_MESSAGE;

    return (
      <section className="animate-rise">
        <BackLink />
        <div className="animate-panel-in mt-6 space-y-6 rounded-lg border border-border/50 bg-card/20 p-5 sm:p-7">
          {headerStyle === "full" ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h2 className="mt-4 text-2xl font-semibold">{heading}</h2>
              <p className="mt-2 text-muted-foreground">{message}</p>
            </div>
          ) : headerStyle === "compact" ? (
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-success/40 bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold leading-none">
                  {heading}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{message}</p>
              </div>
            </div>
          ) : null}

          {isRefreshable && (
            <button type="button" onClick={refresh} disabled={refreshing} aria-busy={refreshing}
              className="mb-3 inline-flex items-center gap-2 border border-amber-400 text-amber-400 rounded px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}

          {schema.response && phase.data !== undefined && (
            <ResponsePanel responseConfig={schema.response} data={phase.data} />
          )}

          <div className="text-center">
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
  const HeaderIcon = resolveIcon(schema.icon);

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
          {HeaderIcon &&
            createElement(HeaderIcon, {
              className: "h-8 w-8 shrink-0 text-primary opacity-80",
            })}
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
        {/* Provide raw selected items so valueFromField can reactively prefill siblings */}
        <SelectedItemsContext.Provider
          value={{ items: selectedItems, setItem }}
        >
          <Form {...form}>
            <form
              ref={formRef}
              onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)}
              className="mt-6 space-y-6"
            >
              {prefillMiss && (
                <p className="animate-error-in rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  The item linked here is no longer available — select one
                  below.
                </p>
              )}
              {resolvedFields.map((def, i) => {
                if (isStaticField(def)) {
                  const StaticComponent = STATIC_FIELD_REGISTRY[def.type];
                  if (!StaticComponent) {
                    warnUnknownFieldType(def.type, "static");
                    return null;
                  }
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
                  {page.submitLabel ??
                    schema.submitLabel ??
                    (currentPage < pageCount - 1 ? "Next" : "Submit")}
                </Button>
              </div>
            </form>
          </Form>
        </SelectedItemsContext.Provider>
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
  if (!FIELD_REGISTRY[def.type]) warnUnknownFieldType(def.type, "input");
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
  if (v === undefined && key.startsWith("0."))
    v = get(root as object, key.slice(2));
  if (v === undefined) v = get(data as object, key);
  return v;
}

// ── ResponsePanel ─────────────────────────────────────────────────────────────

type ResolvedField = {
  key: string;
  label?: string;
  format?: "heading" | "tags" | "list" | "transcript" | "copy" | "table";
  prose?: boolean;
  section?: string;
  columns?: import("@/lib/schema").TableColumn[];
  expand?: import("@/lib/schema").TableExpand[];
  filters?: import("@/lib/schema").TableFilter[];
  /** null means "empty but should still render as —" */
  value:
    | string
    | string[]
    | Array<Record<string, string>>
    | Array<Record<string, unknown>>
    | null;
};

/** A contiguous run of resolved fields sharing the same `section`. */
type FieldGroup = {
  section?: string;
  fields: ResolvedField[];
};

/**
 * Normalises a raw response value into a renderable form.
 * Returns `null` to signal "empty" — callers decide whether to hide or show "—".
 */
function normaliseValue(
  raw: unknown,
  format?: "heading" | "tags" | "list" | "transcript" | "copy" | "table",
):
  | string
  | string[]
  | Array<Record<string, string>>
  | Array<Record<string, unknown>>
  | null {
  if (raw === undefined || raw === null) return null;
  if (format === "transcript") {
    if (!Array.isArray(raw)) return null;
    // Drop superseded messages here so an all-superseded transcript normalises
    // to null (→ "—") instead of rendering an empty <ol> with a stray timeline bar.
    const messages = visibleMessages(raw as Array<Record<string, string>>);
    return messages.length ? messages : null;
  }
  if (format === "table") {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw; // array of row objects; TableRenderer (ResponseCell) consumes it
  }
  if (format === "copy") {
    // Copy surfaces a single copyable string; coerce arrays/objects explicitly
    // so an array value doesn't silently comma-join via String([]).
    if (Array.isArray(raw)) {
      const joined = raw.filter(Boolean).map(String).join("\n");
      return joined ? joined : null;
    }
    if (typeof raw === "object") return JSON.stringify(raw, null, 2);
    const s = String(raw).trim();
    return s ? s : null;
  }
  if (Array.isArray(raw)) {
    const tags = raw.filter(Boolean).map(String);
    return tags.length ? tags : null;
  }
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (typeof raw === "object") return JSON.stringify(raw);
  const s = String(raw).trim();
  if (!s) return null;
  // Explicit tags/list format on a plain string → split by comma
  if (format === "tags" || format === "list") {
    return s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return s;
}

function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed">
      <button
        type="button"
        onClick={async () => {
          // `navigator.clipboard` is undefined in non-secure contexts and
          // writeText rejects on permission denial — guard so the button shows
          // a failure state instead of dropping an unhandled promise rejection.
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setFailed(true);
            setTimeout(() => setFailed(false), 2000);
          }
        }}
        className="label-tech absolute right-2 top-2 rounded border border-border px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10"
      >
        {copied ? "✓ copied" : failed ? "copy failed" : "copy"}
      </button>
      <span className="whitespace-pre-wrap break-words pr-12">{text}</span>
    </div>
  );
}

/**
 * Renders the declared response fields from the BFF's `data` payload as a set
 * of defined panels, grouped by `section`.
 * - Skips fields whose resolved value is null / undefined / empty (hideIfEmpty).
 * - Arrays (and `format:"tags"`) render as Badge chips.
 * - `format:"list"` renders a checklist.
 * - `format:"heading"` renders large full-width text; `prose` renders sans body text.
 * - A field with a `section` starts a new panel; section-less fields join the current one.
 * Falls back to displaying the raw JSON string if no structured fields match.
 */
function ResponsePanel({
  responseConfig,
  data,
}: {
  responseConfig: ResponseConfig;
  data: unknown;
}) {
  const fields = responseConfig.fields ?? [];
  const hasStructured =
    data !== null && data !== undefined && typeof data === "object";

  // Resolve fields; respect hideIfEmpty — when false/omitted, keep null so "—" renders.
  // A `section` lives on its anchor field; if that anchor is hidden (hideIfEmpty),
  // carry the section label forward to the next surviving field so the panel
  // heading survives even when its first field is empty.
  const resolved: ResolvedField[] = [];
  if (hasStructured) {
    let carriedSection: string | undefined;
    for (const f of fields) {
      const raw = resolveResponseValue(data, f.key);
      const value = normaliseValue(raw, f.format);
      if (value === null && f.hideIfEmpty) {
        if (f.section) carriedSection = f.section; // remember the orphaned section
        continue;
      }
      const section = f.section ?? carriedSection;
      carriedSection = undefined; // consumed by the first visible field
      resolved.push({
        key: f.key,
        label: f.label,
        format: f.format,
        prose: f.prose,
        section,
        columns: f.columns,
        expand: f.expand,
        filters: f.filters,
        value,
      });
    }
  }

  // Group into panels: a field with `section` starts a new group; section-less
  // fields join the current one. The first group may be section-less.
  const groups: FieldGroup[] = [];
  for (const f of resolved) {
    if (f.section || groups.length === 0) {
      groups.push({ section: f.section, fields: [f] });
    } else {
      groups[groups.length - 1].fields.push(f);
    }
  }

  // Nothing to render if no fields were configured at all.
  if (fields.length === 0) return null;

  const title = responseConfig.header?.title ?? DEFAULT_TITLE;

  return (
    <div className="space-y-4">
      {/* Accent-divider title — only when there are visible fields and the
          response header isn't explicitly suppressed (style: "none"). */}
      {hasStructured &&
        resolved.length > 0 &&
        responseConfig.header?.style !== "none" && (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-success/20" />
          <h3 className="label-tech text-primary text-[11px] tracking-[0.22em]">
            {title}
          </h3>
          <span className="h-px flex-1 bg-success/20" />
        </div>
      )}

      {hasStructured && resolved.length > 0 ? (
        groups.map((group, gi) => (
          <div
            key={gi}
            className="animate-field-in overflow-hidden rounded-md border border-border/60 bg-card/40"
            style={{ animationDelay: `${gi * 60}ms` }}
          >
            {group.section && (
              <div className="border-b border-border/50 bg-muted/30 px-4 py-2">
                <span className="label-tech text-[10px] tracking-[0.18em] text-muted-foreground">
                  {group.section}
                </span>
              </div>
            )}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
              {group.fields.map((f) => (
                <ResponseCell key={f.key} field={f} />
              ))}
            </dl>
          </div>
        ))
      ) : hasStructured && resolved.length === 0 ? (
        // All fields were empty — show a minimal fallback
        <p className="rounded border border-border/30 px-3 py-2 text-sm text-muted-foreground/50 italic text-center">
          No structured data returned.
        </p>
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

/**
 * Renders a single resolved field as a grid cell. Full-width (col-span-2) for
 * heading / tags / list / prose values; a short scalar otherwise.
 */
function ResponseCell({ field }: { field: ResolvedField }) {
  const { key, label, format, prose, value, columns, expand, filters } = field;
  const isEmpty = value === null;
  const isHeading = !isEmpty && format === "heading";
  const isList = !isEmpty && format === "list";
  const isTranscript = !isEmpty && format === "transcript";
  const isCopy = !isEmpty && format === "copy";
  const isTable = !isEmpty && format === "table";
  const isTags =
    !isEmpty &&
    !isHeading &&
    !isList &&
    !isTranscript &&
    !isCopy &&
    !isTable &&
    (Array.isArray(value) || format === "tags");
  const isProse =
    !isEmpty &&
    !isHeading &&
    !isTags &&
    !isList &&
    !isTranscript &&
    !isCopy &&
    prose === true;

  const fullWidth =
    isHeading ||
    isTags ||
    isList ||
    isTranscript ||
    isCopy ||
    isTable ||
    prose === true;

  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      {/* The table carries its own header/filters chrome — the field-key label
          ("opps") would just be noise above it. */}
      {!isTable && (
        <dt className="label-tech mb-1 text-[9px] text-muted-foreground/60">
          {label ?? key}
        </dt>
      )}
      {isHeading ? (
        <dd className="text-xl font-semibold text-primary leading-snug break-words">
          {String(value)}
        </dd>
      ) : isProse ? (
        <dd className="text-sm leading-relaxed text-foreground/90 break-words">
          {String(value)}
        </dd>
      ) : isTags ? (
        <dd className="flex flex-wrap gap-1.5">
          {(Array.isArray(value) ? value : [value]).map((tag) => (
            <Badge
              key={String(tag)}
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary/90 font-mono text-[11px] font-medium"
            >
              {String(tag)}
            </Badge>
          ))}
        </dd>
      ) : isList ? (
        <dd>
          <ul className="space-y-1.5">
            {(Array.isArray(value) ? value : [value]).map((item) => (
              <li
                key={String(item)}
                className="flex items-start gap-2 text-sm text-foreground/90"
              >
                <Badge
                  variant="outline"
                  className="h-5 w-5 shrink-0 justify-center p-0 border-success/40 text-success"
                >
                  <Check className="h-3 w-3" />
                </Badge>
                <span className="break-words leading-snug">{String(item)}</span>
              </li>
            ))}
          </ul>
        </dd>
      ) : isTranscript ? (
        <dd>
          <Transcript messages={value as Array<Record<string, string>>} />
        </dd>
      ) : isCopy ? (
        <dd>
          <CopyBox text={String(value)} />
        </dd>
      ) : isTable ? (
        <dd className="col-span-full">
          {/* Rows arrive as opaque n8n payload (Array<Record<string,unknown>>);
              the registered cell/section renderers (selected by col.kind) own
              the row shape. Unconfigured kinds fall back to plain values. */}
          <TableRenderer
            rows={(value as unknown as Row[]) ?? []}
            columns={columns ?? []}
            expand={expand ?? []}
            filters={filters ?? []}
          />
        </dd>
      ) : (
        <dd
          className={
            isEmpty
              ? "font-mono text-sm italic text-muted-foreground/40"
              : "font-mono text-sm text-foreground break-words"
          }
        >
          {isEmpty ? "—" : String(value)}
        </dd>
      )}
    </div>
  );
}

export { ResponsePanel as ResponsePanelForTest };
