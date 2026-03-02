import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_, registration) {
      if (!registration) return;
      setInterval(() => registration.update(), 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md">
      <div className="rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Nova versão disponível</p>
            <p className="text-xs text-muted-foreground">Toque em atualizar para carregar as últimas alterações.</p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => updateServiceWorker(true)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
          >
            Atualizar agora
          </button>
        </div>
      </div>
    </div>
  );
}
