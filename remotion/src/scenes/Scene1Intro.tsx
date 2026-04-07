import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: orbitron } = loadFont("normal", { weights: ["700", "900"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["300", "400"], subsets: ["latin"] });

export const Scene1Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({ frame, fps, config: { damping: 15, stiffness: 80, mass: 1.5 } });
  const titleY = interpolate(titleScale, [0, 1], [80, 0]);

  const subtitleOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitleY = interpolate(frame, [30, 50], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const lineWidth = interpolate(frame, [15, 55], [0, 400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const tagOpacity = interpolate(frame, [55, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Pulsing glow behind title
  const glowPulse = Math.sin(frame * 0.1) * 0.3 + 0.7;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Big glow behind text */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(180,20,20,0.25) 0%, transparent 60%)",
          filter: "blur(40px)",
          opacity: glowPulse,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {/* Icon / emblem */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: "3px solid #e02020",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: titleScale,
            transform: `scale(${titleScale})`,
          }}
        >
          <span style={{ fontSize: 36, fontFamily: orbitron, color: "#e02020", fontWeight: 900 }}>2W</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: orbitron,
            fontSize: 72,
            fontWeight: 900,
            color: "white",
            letterSpacing: "4px",
            textTransform: "uppercase",
            transform: `translateY(${titleY}px) scale(${titleScale})`,
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          TWO WHEELS
        </h1>

        {/* Red line */}
        <div
          style={{
            height: 3,
            width: lineWidth,
            background: "linear-gradient(90deg, transparent, #e02020, transparent)",
            borderRadius: 2,
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            fontFamily: inter,
            fontSize: 28,
            fontWeight: 300,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "8px",
            textTransform: "uppercase",
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          MOTORCYCLES
        </p>

        {/* Tagline */}
        <p
          style={{
            fontFamily: inter,
            fontSize: 20,
            fontWeight: 300,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "2px",
            opacity: tagOpacity,
            marginTop: 20,
          }}
        >
          Workshop Management System
        </p>
      </div>
    </AbsoluteFill>
  );
};
