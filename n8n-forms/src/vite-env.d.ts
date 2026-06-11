/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBHOOK_CONTACT: string;
  readonly VITE_WEBHOOK_BUG_REPORT: string;
  readonly VITE_WEBHOOK_PING: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
