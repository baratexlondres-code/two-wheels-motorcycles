import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: orbitron } = loadFont("normal", { weights: ["700", "900"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] });

const stats = [
  { value: "100%", label: "Stock Controlado", delay: 0 },
  { value: "Real-time", label: "Alertas Automáticos", delay: 10 },
  { value: "PDF", label: "Faturas & Relatórios", delay: 20 },
  { value: "WhatsApp", label: "Mensagens aos Clientes", delay: 30 },
];

export const Scene4Stock = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerS = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
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
          GESTÃO INTELIGENTE
        </span>
        <h2 style={{ fontFamily: orbitron, fontSize: 48, fontWeight: 700, color: "white" }}>
          Stock & Mais
        </h2>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 60 }}>
        {stats.map((stat, i) => {
          const s = spring({ frame: frame - stat.delay - 15, fps, config: { damping: 12, stiffness: 100 } });
          const y = interpolate(s, [0, 1], [50, 0]);
          return (
            <div
              key={stat.label}
              style={{
                padding: "36px 48px",
                borderRadius: 20,
                background: "linear-gradient(135deg, rgba(224,32,32,0.08), rgba(255,255,255,0.03))",
                border: "1px solid rgba(224,32,32,0.15)",
                textAlign: "center",
                opacity: s,
                transform: `translateY(${y}px)`,
              }}
            >
              <p style={{ fontFamily: orbitron, fontSize: 36, fontWeight: 900, color: "#e02020", marginBottom: 8 }}>
                {stat.value}
              </p>
              <p style={{ fontFamily: inter, fontSize: 16, color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
