import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { isCapacitor } from "@/App";

export function UpdateNotification() {
  const { updateAvailable, dismiss } = useAutoUpdate();

  if (!isCapacitor || !updateAvailable) return null;

  const handleDownload = () => {
    // Open the APK download URL in the system browser
    if ((window as any).Capacitor?.Plugins?.Browser) {
      (window as any).Capacitor.Plugins.Browser.open({ url: updateAvailable.downloadUrl });
    } else {
      window.open(updateAvailable.downloadUrl, "_blank");
    }
    dismiss();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: "16px",
          padding: "28px 24px",
          maxWidth: "360px",
          width: "100%",
          border: "1px solid #333",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "#dc2626",
              fontSize: "24px",
            }}
          >
            ↑
          </div>
        </div>

        {/* Title */}
        <h2
          style={{
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: "700",
            textAlign: "center",
            marginBottom: "8px",
          }}
        >
          Atualização Disponível
        </h2>

        {/* Version */}
        <p
          style={{
            color: "#9ca3af",
            fontSize: "14px",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          A versão {updateAvailable.version} está pronta para ser instalada.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={handleDownload}
            style={{
              backgroundColor: "#dc2626",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "14px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Baixar e Instalar
          </button>
          <button
            onClick={dismiss}
            style={{
              backgroundColor: "transparent",
              color: "#9ca3af",
              border: "1px solid #333",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "14px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  );
}
