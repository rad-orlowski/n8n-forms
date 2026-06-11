# Field registry

`index.ts` exports `FIELD_REGISTRY: Record<string, FieldComponent>` — maps a `type` string
to the React component that renders it. `FormShell` dispatches to this registry; unknown
types fall back to `TextField`.

## Built-in types
`text`, `email`, `textarea`, `number`, `select`, `checkbox`, `date`, `rating`, `richtext`

## Adding a custom field — 3 steps

1. **Build the component** — accept `{ field, def }: FieldComponentProps` and render only
   the control itself (no label, no error message — `FormShell`/`FieldRow` handles those):

   ```tsx
   import type { FieldComponentProps } from "@/lib/schema";

   export function MyField({ field, def }: FieldComponentProps) {
     return <input {...field} type="text" placeholder={def.placeholder} />;
   }
   ```

2. **Register it** — add one line to `index.ts`:
   ```ts
   import { MyField } from "./my-field";
   export const FIELD_REGISTRY = { ...existingEntries, mytype: MyField };
   ```

3. **Use it** — in any `*.form.ts` set `type: "mytype"`.

## FieldComponentProps contract

```ts
interface FieldComponentProps {
  field: ControllerRenderProps<FieldValues, string>  // from react-hook-form
  def:   FieldDef                                    // the field config object
}
```

`field` is the full RHF controller render prop: `value`, `onChange`, `onBlur`, `ref`, `name`.
Your component must spread or forward at least `onChange`, `onBlur`, and `value`/`ref` so
RHF validation works correctly.

## Worked example
`rating-field.tsx` — star rating using `def.max` (default 5). Toggle: clicking the active
star deselects it (sets value to 0). Shows the full `field.onChange` / `field.onBlur` pattern.

## Checkbox layout special-case
In `FormShell.tsx` (`FieldRow`), `checkbox` fields render with the control **beside** the
label (flex-row, items-start, border box). All other types render with label above control.
No changes needed in the field component itself; `FormShell` handles the layout divergence.

## TipTap richtext field
`rich-text-field.tsx` wraps the TipTap simple editor. Its styles are scoped under
`.tiptap-editor-scope` (set in `rich-text-field.scss`) to avoid leaking TipTap's global
CSS resets into the rest of the app. The underlying `tiptap-*` components are **vendored**
(generated via `npx @tiptap/cli add simple-editor`) — prefer regenerating over hand-editing.

- **Debounce:** `onUpdate` is debounced at ~250 ms trailing using `debounce` from `es-toolkit`
  (stable ref via `useMemo([])`). `onBlur` calls `debouncedOnChange.flush()` before `field.onBlur()`
  so RHF validation sees the latest value immediately. `useEffect` cleanup calls `.cancel()`.
- **Editor colors:** TipTap's `--tt-*` CSS tokens are remapped to the app's theme palette in
  `src/styles/_tiptap-theme-overrides.scss`. Edit that file to change editor colors — do not
  hand-edit vendored component SCSS.
