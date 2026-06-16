import { Parser, type Values } from "expr-eval";

const parser = new Parser();

// Built-in functions (random, etc.) are intentionally disabled.
// Form visibility/required conditions must be pure, deterministic comparisons
// against field values — no side-effectful or non-deterministic built-ins.
// All entries are removed from parser.functions so any call like random()
// fails at evaluation time (evaluateCondition catches → returns safe false).
Object.keys(parser.functions).forEach((k) => {
  delete (parser.functions as Record<string, unknown>)[k];
});

// A permissive scope proxy used only during syntax validation: every variable
// resolves to 0, so the parse + evaluate dry-run succeeds for valid field
// expressions but throws for function-call attempts (e.g. "0 is not a function").
const VALIDATION_SCOPE = new Proxy({} as Record<string, unknown>, {
  get: () => 0,
});

/**
 * Evaluate a declarative condition string against a scope of field values.
 * Safe: no eval, no arbitrary code. Returns `false` if the expression cannot be
 * evaluated (e.g. references a field with no value yet) — the safe default.
 */
export function evaluateCondition(
  expr: string,
  scope: Record<string, unknown>,
): boolean {
  try {
    return Boolean(parser.parse(expr).evaluate(scope as Values));
  } catch {
    return false;
  }
}

export type SyntaxResult = { ok: true } | { ok: false; error: string };

/** Validate expression *syntax* (used at form load time). */
export function validateExpressionSyntax(expr: string): SyntaxResult {
  try {
    // Parse first to catch structural errors (unterminated expressions, etc.).
    const parsed = parser.parse(expr);
    // Do a dry-run evaluation with a permissive proxy scope (all vars = 0).
    // Valid field-reference expressions evaluate successfully; function-call
    // attempts throw because the proxy returns 0 for every name and 0() is
    // not callable — this surfaces disallowed function calls as a validation
    // error, consistent with evaluateCondition returning false at runtime.
    parsed.evaluate(VALIDATION_SCOPE as Values);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
