import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2Features } from "./scenes/Scene2Features";
import { Scene3Repairs } from "./scenes/Scene3Repairs";
import { Scene4Stock } from "./scenes/Scene4Stock";
import { Scene5CTA } from "./scenes/Scene5CTA";
import { PersistentBackground } from "./components/PersistentBackground";

export const MainVideo = () => {
  const transitionDuration = 20;
  const timing = springTiming({ config: { damping: 200 }, durationInFrames: transitionDuration });

  return (
    <AbsoluteFill>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={140}>
          <Scene1Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene2Features />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene3Repairs />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={120}>
          <Scene4Stock />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={160}>
          <Scene5CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
