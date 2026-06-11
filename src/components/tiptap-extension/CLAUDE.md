# tiptap-* — vendored, do not hand-edit

All `tiptap-extension/`, `tiptap-icons/`, `tiptap-node/`, `tiptap-templates/`, and
`tiptap-ui/` directories are **generated** by the TipTap CLI:

```
npx @tiptap/cli add simple-editor
```

Treat them as vendored third-party code. To update or change the editor, regenerate with
the CLI rather than editing files directly. Hand edits will be lost on the next regeneration.

The one intentional modification is in `src/components/fields/rich-text-field.tsx` and
`rich-text-field.scss`, which wrap the generated editor and scope its styles under
`.tiptap-editor-scope` to prevent global CSS leaks.

**To recolor the editor:** edit `src/styles/_tiptap-theme-overrides.scss` — it remaps
`--tt-*` tokens to the app's theme variables. Do not hand-edit vendored component SCSS.
