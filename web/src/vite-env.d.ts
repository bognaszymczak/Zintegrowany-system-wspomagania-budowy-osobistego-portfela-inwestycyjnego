/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "false" = prawdziwe API; brak zmiennej lub inna wartość = dane z mocków (domyślnie) */
  readonly VITE_USE_MOCKS?: string;
  /** Prefiks adresów API w przeglądarce, domyślnie "/api" */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
