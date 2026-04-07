import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const PersistentBackground = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame * 0.008) * 20;
  const drift2 = Math.cos(frame * 0.006) * 15;

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      {/* Subtle red glow orbs */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(180,20,20,0.15) 0%, transparent 70%)",
          top: -200 + drift,
          right: -200 + drift2,
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(180,20,20,0.08) 0%, transparent 70%)",
          bottom: -100 - drift,
          left: -100 - drift2,
          filter: "blur(80px)",
        }}
      />
      {/* Grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          transform: `translateY(${drift * 0.3}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
