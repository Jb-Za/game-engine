/// <reference types="vite/client" />
/// <reference types="@webgpu/types" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
