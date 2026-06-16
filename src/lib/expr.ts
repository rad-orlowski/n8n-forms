import { Parser, type Values } from "expr-eval";

const parser = new Parser();

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
    parser.parse(expr);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
