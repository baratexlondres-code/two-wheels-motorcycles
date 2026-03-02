/// <reference types="vite/client" />

declare const __APP_VERSION: string;

declare module "virtual:pwa-register/react" {
  export function useRegisterSW(options?: {
    immediate?: boolean;
    onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  }): {
    needRefresh: [boolean, (value: boolean) => void];
    offlineReady: [boolean, (value: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
