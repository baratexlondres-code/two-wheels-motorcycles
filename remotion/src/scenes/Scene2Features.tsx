import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: orbitron } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600"], subsets: ["latin"] });

const features = [
  { icon: "🔧", title: "Repairs", desc: "Full pipeline tracking" },
  { icon: "📦", title: "Stock", desc: "Real-time inventory" },
  { icon: "👥", title: "Customers", desc: "Complete CRM" },
  { icon: "🏍️", title: "Sales", desc: "Motorcycle sales" },
  { icon: "📊", title: "Reports", desc: "Financial insights" },
  { icon: "💬", title: "WhatsApp", desc: "Auto messaging" },
];

const FeatureCard = ({ icon, title, desc, index }: { icon: string; title: string; desc: string; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = index * 8;

  const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
  const y = interpolate(s, [0, 1], [60, 0]);

  return (
    <div
      style={{
        width: 260,
        padding: "28px 20px",
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        opacity: s,
        transform: `translateY(${y}px)`,
        backdropFilter: "none",
      }}
    >
      <span style={{ fontSize: 40 }}>{icon}</span>
      <span style={{ fontFamily: orbitron, fontSize: 18, fontWeight: 700, color: "white", letterSpacing: 1 }}>{title}</span>
      <span style={{ fontFamily: inter, fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 400 }}>{desc}</span>
    </div>
  );
};

export const Scene2Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerS = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const headerY = interpolate(headerS, [0, 1], [-40, 0]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
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
          transform: `translateY(${headerY}px)`,
        }}
      >
        <span style={{ fontFamily: inter, fontSize: 14, fontWeight: 600, color: "#e02020", letterSpacing: 4, textTransform: "uppercase" }}>
          TUDO O QUE PRECISA
        </span>
        <h2 style={{ fontFamily: orbitron, fontSize: 48, fontWeight: 700, color: "white" }}>
          Funcionalidades
        </h2>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 24,
          marginTop: 80,
          maxWidth: 900,
        }}
      >
        {features.map((f, i) => (
          <FeatureCard key={f.title} {...f} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
