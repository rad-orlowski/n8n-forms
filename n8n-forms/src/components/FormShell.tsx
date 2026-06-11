import { useMemo, useRef, useState } from "react";
import { get } from "es-toolkit/compat";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
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
import { FIELD_REGISTRY } from "@/components/fields";
import {
  buildZodSchema,
  defaultValues,
  type FieldDef,
  type FormSchema,
  type ResponseConfig,
} from "@/lib/schema";
import { postToWebhook, type SubmitResult } from "@/lib/submit";

function webhookHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function FormShell({ schema }: { schema: FormSchema }) {
  const zodSchema = useMemo(
    () => buildZodSchema(schema.fields),
    [schema.fields],
  );

  const form = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: defaultValues(schema.fields),
    mode: "onTouched",
  });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(values: Record<string, unknown>) {
    setSubmitting(true);
    setResult(null);
    const r = await postToWebhook(schema.webhook, values);
    setResult(r);
    setSubmitting(false);
  }

  function onInvalidSubmit() {
    // Add the shake class, then remove it after the animation so it can retrigger
    const el = formRef.current;
    if (!el) return;
    el.classList.remove("animate-shake");
    // Force reflow so removing + re-adding actually restarts the animation
    void el.offsetWidth;
    el.classList.add("animate-shake");
    el.addEventListener(
      "animationend",
      () => el.classList.remove("animate-shake"),
      { once: true },
    );
  }

  if (result?.ok) {
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

          {schema.response && (
            <ResponsePanel
              responseConfig={schema.response}
              body={result.body}
            />
          )}

          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                form.reset();
              }}
            >
              Submit another
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-rise">
      <BackLink />

      <header className="mt-6">
        <p className="label-tech">form · {schema.slug}</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">{schema.title}</h1>
        {schema.description && (
          <p className="mt-2 max-w-prose text-muted-foreground">
            {schema.description}
          </p>
        )}
        <div className="rule-tech mt-5" />
      </header>

      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)}
          className="mt-6 space-y-6"
        >
          {schema.fields.map((def) => (
            <FormField
              key={def.name}
              control={form.control}
              name={def.name}
              render={({ field }) => <FieldRow def={def} field={field} />}
            />
          ))}

          {result && !result.ok && (
            <div className="animate-panel-in flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  Submission failed
                  {result.status ? ` (HTTP ${result.status})` : ""}
                </p>
                {result.body && (
                  <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                    {result.body.slice(0, 300)}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <span
              className="truncate font-mono text-xs text-muted-foreground"
              title={schema.webhook}
            >
              → {webhookHost(schema.webhook)}
            </span>
            <Button type="submit" disabled={submitting} className="min-w-36">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {schema.submitLabel ?? "Submit"}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}

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

/**
 * Parses the webhook response body as JSON and renders the declared fields.
 * Falls back to displaying the raw body text if parsing fails.
 */
function ResponsePanel({
  responseConfig,
  body,
}: {
  responseConfig: ResponseConfig;
  body: string;
}) {
  // Attempt to parse — non-JSON responses (plain text, HTML) fall back gracefully.
  // Accept any non-null JSON value that is an object or array — arrays are valid
  // because n8n's default echo wraps the payload in a top-level array, and
  // es-toolkit get() resolves numeric dot-paths (e.g. "0.body.message") against them.
  let parsed: Record<string, unknown> | unknown[] | null = null;
  try {
    const v = JSON.parse(body);
    if (v !== null && typeof v === "object") {
      parsed = v as Record<string, unknown> | unknown[];
    }
  } catch {
    // non-JSON — render as plain text below
  }

  function formatValue(raw: unknown): string {
    if (raw === undefined || raw === null) return "—";
    if (typeof raw === "boolean") return raw ? "Yes" : "No";
    if (typeof raw === "object") return JSON.stringify(raw);
    return String(raw);
  }

  return (
    <div className="mt-6 border-t border-success/20 pt-5">
      <p className="label-tech mb-3">
        {responseConfig.title ?? "Response"}
      </p>

      {parsed !== null ? (
        <dl className="space-y-2">
          {responseConfig.fields.map(({ key, label }, i) => {
            const raw = get(parsed, key);
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
        // Non-JSON fallback — show raw body truncated to 500 chars
        body.trim() && (
          <pre className="rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
            {body.slice(0, 500)}
          </pre>
        )
      )}
    </div>
  );
}
