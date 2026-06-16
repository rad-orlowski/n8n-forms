// NOTE: z.toJSONSchema cannot represent the superRefine page-0 dynamic-field
// rule (optionsFrom/valueFrom on page 0). The emitted JSON Schema intentionally
// UNDER-validates that constraint; defineForm enforces it at load time instead.
// Editors relying on this schema will not catch page-0 optionsFrom/valueFrom
// violations — that is by design.
import { z } from "zod";
import { writeFileSync } from "node:fs";
import { FormSchema } from "../src/lib/schema.ts";

try {
  const jsonSchema = z.toJSONSchema(FormSchema, { target: "draft-7" });
  writeFileSync(
    new URL("../forms/form.schema.json", import.meta.url),
    JSON.stringify(jsonSchema, null, 2) + "\n",
  );
  console.log("[schema] wrote forms/form.schema.json");
} catch (err) {
  console.error("[schema] failed to generate forms/form.schema.json:", err);
  process.exit(1);
}
