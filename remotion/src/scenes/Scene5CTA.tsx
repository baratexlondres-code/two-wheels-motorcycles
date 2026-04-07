import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: orbitron } = loadFont("normal", { weights: ["700", "900"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["300", "400", "600"], subsets: ["latin"] });

export const Scene5CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = spring({ frame, fps, config: { damping: 12, stiffness: 60, mass: 2 } });
  const logoY = interpolate(logoS, [0, 1], [60, 0]);

  const textO = interpolate(frame, [30, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textY = interpolate(frame, [30, 55], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const contactO = interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const glowPulse = Math.sin(frame * 0.08) * 0.4 + 0.6;

  // Fade out at end
  const fadeOut = interpolate(frame, [130, 155], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
      {/* Pulsing ring */}
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          border: "1px solid rgba(224,32,32,0.2)",
          opacity: glowPulse * logoS,
          transform: `scale(${1 + glowPulse * 0.1})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 450,
          height: 450,
          borderRadius: "50%",
          border: "1px solid rgba(224,32,32,0.08)",
          opacity: glowPulse * logoS * 0.6,
          transform: `scale(${1 + glowPulse * 0.05})`,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        {/* Logo emblem */}
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            border: "3px solid #e02020",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: logoS,
            transform: `translateY(${logoY}px) scale(${logoS})`,
          }}
        >
          <span style={{ fontSize: 42, fontFamily: orbitron, color: "#e02020", fontWeight: 900 }}>2W</span>
        </div>

        {/* Main text */}
        <h2
          style={{
            fontFamily: orbitron,
            fontSize: 56,
            fontWeight: 900,
            color: "white",
            textAlign: "center",
            letterSpacing: 3,
            opacity: textO,
            transform: `translateY(${textY}px)`,
            lineHeight: 1.2,
          }}
        >
          TWO WHEELS
        </h2>

        <div style={{ height: 2, width: 200, background: "linear-gradient(90deg, transparent, #e02020, transparent)", opacity: textO }} />

        <p
          style={{
            fontFamily: inter,
            fontSize: 22,
            fontWeight: 300,
            color: "rgba(255,255,255,0.6)",
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: textO,
          }}
        >
          Workshop Management
        </p>

        {/* Contact / tagline */}
        <p
          style={{
            fontFamily: inter,
            fontSize: 18,
            fontWeight: 400,
            color: "rgba(255,255,255,0.4)",
            marginTop: 40,
            opacity: contactO,
            letterSpacing: 1,
          }}
        >
          Sistema profissional para a sua oficina
        </p>
      </div>
    </AbsoluteFill>
  );
};
