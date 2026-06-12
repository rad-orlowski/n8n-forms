/**
 * auth.ts — per-form token validation.
 *
 * Reads FORM_TOKEN_<SLUG> from env (via config.ts) and compares using
 * crypto.timingSafeEqual to prevent timing-based token leakage.
 */

import { resolveFormConfig } from "./config.ts";

/**
 * Validate that `token` matches the configured FORM_TOKEN_<SLUG>.
 *
 * Returns true only when:
 *   1. The form has a configured token in env.
 *   2. The supplied token is a non-empty string.
 *   3. The constant-time comparison succeeds.
 *
 * Always returns false (not an error) on mismatch so callers can return 401
 * uniformly without leaking which condition failed.
 */
export function validateToken(slug: string, token: string | null | undefined): boolean {
  if (!token) return false;

  const cfg = resolveFormConfig(slug);
  if (!cfg) return false;

  const expected = Buffer.from(cfg.token, "utf8");
  const supplied = Buffer.from(token, "utf8");

  // timingSafeEqual requires equal-length Buffers; pad/truncate to expected
  // length so we don't leak length information.
  const paddedSupplied =
    supplied.length === expected.length
      ? supplied
      : Buffer.concat(
          [supplied, Buffer.alloc(Math.max(0, expected.length - supplied.length))],
          expected.length
        );

  // If lengths differ the comparison will always fail (mismatched content),
  // but we must still run it in constant time to avoid short-circuit leaks.
  const match = crypto.timingSafeEqual(expected, paddedSupplied);

  // Explicitly invalidate when lengths differ — constant-time check above is
  // still executed to prevent timing differences from revealing length.
  return match && supplied.length === expected.length;
}
