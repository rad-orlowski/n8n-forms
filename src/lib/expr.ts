import { Parser, type Values } from "expr-eval-fork";

// Disable assignment + function-definition operators outright: condition
// expressions are read-only boolean tests, never mutations, so `assignment`
// (the prototype-pollution vector) and `fndef` have no legitimate use here.
const parser = new Parser({ operators: { assignment: false, fndef: false } });

// expr-eval's built-in *functions* (random, etc.) are intentionally disabled:
// every entry is removed from parser.functions, so a call like random() fails
// at evaluation time (evaluateCondition catches → returns safe false; and the
// validation dry-run below surfaces it at load time). The key motivation is
// random() — a non-deterministic call would make a field flicker in/out across
// renders. expr-eval's deterministic unary math ops (abs, floor, sin, …) live
// in parser.unaryOps, not parser.functions, so they remain available; they are
// pure and side-effect-free, so an expression like "abs(delta) > 5" is fine.
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
