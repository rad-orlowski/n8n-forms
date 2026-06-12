/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Each form's webhook key follows VITE_WEBHOOK_<SLUG_SCREAMING_SNAKE>. Typed by
  // index signature so private/personal forms need NO committed entry here — keeps
  // personal workflow names out of this tracked file when the repo is public.
  readonly [key: `VITE_WEBHOOK_${string}`]: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
