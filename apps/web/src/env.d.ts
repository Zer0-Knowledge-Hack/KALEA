interface ImportMetaEnv {
  /** Kalea API base URL, inlined at build time. */
  readonly PUBLIC_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
