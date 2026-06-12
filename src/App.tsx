import { useEffect, useState } from "react";
import { FormShell } from "@/components/FormShell";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FormSchema } from "@/lib/schema";
import { forms, getForm } from "@/forms/index";

// ── hash router ────────────────────────────────────────────────────────────────

/**
 * Returns the slug portion of the URL hash (the part after `#/`), and the
 * `?t=` token if present in either the hash query-string or the main query.
 *
 * Examples:
 *   #/contact?t=abc  → { slug: "contact", token: "abc" }
 *   #/ping           → { slug: "ping",    token: null  }
 *   #/               → { slug: "",        token: null  }
 */
function parseHash(): { slug: string; token: string | null } {
  const hash = window.location.hash.replace(/^#\/?/, ""); // strip leading "#/"
  const qIdx = hash.indexOf("?");
  const slug = qIdx === -1 ? hash : hash.slice(0, qIdx);
  const query = qIdx === -1 ? "" : hash.slice(qIdx + 1);
  const params = new URLSearchParams(query);
  // Also check the main (pre-hash) query string as a fallback
  const mainParams = new URLSearchParams(window.location.search);
  const token = params.get("t") ?? mainParams.get("t");
  return { slug, token };
}

function useHashRoute(): { slug: string; token: string | null } {
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}

// ── helpers ────────────────────────────────────────────────────────────────────

/** Total field count across all pages (for the console card). */
function totalFieldCount(form: FormSchema): number {
  return form.pages.reduce((sum, p) => sum + p.fields.length, 0);
}

// ── console index ──────────────────────────────────────────────────────────────

function FormCard({ form, index }: { form: FormSchema; index: number }) {
  const fieldCount = totalFieldCount(form);
  const pageCount = form.pages.length;

  return (
    <a
      href={"#/" + form.slug}
      className="group block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[calc(var(--radius)+2px)] animate-rise"
      style={{ animationDelay: `${80 + index * 60}ms` }}
    >
      <Card
        className={cn(
          "relative overflow-hidden border border-border bg-card px-6 py-5",
          "transition-all duration-200",
          "group-hover:border-primary/60 group-hover:bg-card/80 group-hover:shadow-[0_0_18px_hsl(36_96%_56%/0.12)]",
          "group-focus-visible:border-primary/60",
        )}
      >
        {/* amber left edge accent on hover */}
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l bg-primary",
            "scale-y-0 origin-bottom transition-transform duration-200",
            "group-hover:scale-y-100",
          )}
        />

        <div className="flex items-center gap-2.5 mb-1">
          {form.icon && (
            <form.icon className="h-4 w-4 shrink-0 text-primary opacity-80" />
          )}
          <h2 className="font-display text-lg font-semibold text-card-foreground leading-tight">
            {form.title}
          </h2>
        </div>

        {form.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {form.description}
          </p>
        )}

        <div className="label-tech flex items-center gap-3 flex-wrap">
          <span>
            {fieldCount} field{fieldCount !== 1 ? "s" : ""}
          </span>
          {pageCount > 1 && (
            <>
              <span className="text-border select-none">·</span>
              <span>
                {pageCount} steps
              </span>
            </>
          )}
        </div>
      </Card>
    </a>
  );
}

function ConsoleIndex() {
  return (
    <div className="animate-rise">
      {/* page header */}
      <div className="mb-8">
        <p className="label-tech mb-3">n8n · webhook console</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Form console
        </h1>
        <p className="text-muted-foreground text-sm">
          Select a form to trigger its n8n automation workflow.
        </p>
        <div className="rule-tech mt-5" />
      </div>

      {/* form launch cards */}
      <div className="flex flex-col gap-3">
        {forms.map((form, i) => (
          <FormCard key={form.slug} form={form} index={i} />
        ))}
      </div>
    </div>
  );
}

// ── unknown route ──────────────────────────────────────────────────────────────

function UnknownForm({ slug }: { slug: string }) {
  return (
    <div className="animate-rise text-center py-16">
      <p className="label-tech mb-4">404 · not found</p>
      <h2 className="font-display text-xl font-semibold mb-2">Unknown form</h2>
      <p className="text-muted-foreground text-sm mb-6">
        No form registered for{" "}
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
          {slug}
        </code>
        .
      </p>
      <a
        href="#/"
        className="label-tech text-primary hover:underline underline-offset-4"
      >
        ← back to console
      </a>
    </div>
  );
}

// ── app root ───────────────────────────────────────────────────────────────────

export default function App() {
  const { slug, token } = useHashRoute();
  const form = slug ? getForm(slug) : undefined;

  return (
    <>
      <ThemeSwitcher />
      <div className="mx-auto w-full max-w-2xl px-5 py-12 md:py-16">
        {slug === "" ? (
          <ConsoleIndex />
        ) : form ? (
          // key by slug so navigating between forms remounts FormShell with
          // fresh wizard state (phase/session/answers) instead of leaking the
          // previous form's "done" state.
          <FormShell key={form.slug} schema={form} token={token} />
        ) : (
          <UnknownForm slug={slug} />
        )}
      </div>
    </>
  );
}
