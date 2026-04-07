import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: orbitron } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] });

const statuses = [
  { label: "Received", color: "#3b82f6" },
  { label: "Diagnosing", color: "#f59e0b" },
  { label: "Waiting Parts", color: "#ef4444" },
  { label: "In Repair", color: "#8b5cf6" },
  { label: "Ready", color: "#10b981" },
  { label: "Delivered", color: "#06b6d4" },
];

export const Scene3Repairs = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerS = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });

  // Animate pipeline flow
  const activeIdx = Math.min(Math.floor(interpolate(frame, [20, 100], [0, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })), 5);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: headerS,
        }}
      >
        <span style={{ fontFamily: inter, fontSize: 14, fontWeight: 600, color: "#e02020", letterSpacing: 4, textTransform: "uppercase" }}>
          PIPELINE COMPLETO
        </span>
        <h2 style={{ fontFamily: orbitron, fontSize: 48, fontWeight: 700, color: "white" }}>
          Reparações
        </h2>
      </div>

      {/* Pipeline visualization */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 40 }}>
        {statuses.map((s, i) => {
          const isActive = i <= activeIdx;
          const scale = isActive ? 1 : 0.9;
          const opacity = isActive ? 1 : 0.3;

          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  padding: "16px 24px",
                  borderRadius: 12,
                  background: isActive ? `${s.color}22` : "rgba(255,255,255,0.03)",
                  border: `2px solid ${isActive ? s.color : "rgba(255,255,255,0.1)"}`,
                  opacity,
                  transform: `scale(${scale})`,
                  transition: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, opacity: isActive ? 1 : 0.3 }} />
                <span style={{ fontFamily: inter, fontSize: 13, fontWeight: 600, color: "white", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
              {i < statuses.length - 1 && (
                <div style={{ width: 30, height: 2, background: i < activeIdx ? "#e02020" : "rgba(255,255,255,0.1)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{ position: "absolute", bottom: 140, display: "flex", gap: 80 }}>
        {[
          { label: "Controlo total", value: "de cada etapa" },
          { label: "Peças e serviços", value: "gestão integrada" },
          { label: "Faturas", value: "geração automática" },
        ].map((stat, i) => {
          const d = i * 10 + 50;
          const o = interpolate(frame, [d, d + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={stat.label} style={{ textAlign: "center", opacity: o }}>
              <p style={{ fontFamily: orbitron, fontSize: 20, fontWeight: 700, color: "#e02020" }}>{stat.label}</p>
              <p style={{ fontFamily: inter, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{stat.value}</p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
