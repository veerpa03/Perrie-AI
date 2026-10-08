"use client";

import { useEffect, useRef } from "react";
import { STAGES } from "@/lib/constants";
import HeroPanel from "./panels/HeroPanel";
import ProblemPanel from "./panels/ProblemPanel";
import CapabilitiesPanel from "./panels/CapabilitiesPanel";
import HowItWorksPanel from "./panels/HowItWorksPanel";
import PerchedPanel from "./panels/PerchedPanel";

const PANEL_COMPONENTS: Record<string, React.ComponentType> = {
  sky: HeroPanel,
  clouds: ProblemPanel,
  "city-reveal": CapabilitiesPanel,
  "tree-approach": HowItWorksPanel,
  perched: PerchedPanel,
};

const FADE_MARGIN = 0.02;

interface Props {
  progressRef: React.MutableRefObject<number>;
}

export default function StoryPanels({ progressRef }: Props) {
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const p = progressRef.current;
      for (const stage of STAGES) {
        const el = panelRefs.current[stage.id];
        if (!el) continue;
        let opacity = 0;
        if (p >= stage.from && p <= stage.to) {
          opacity = 1;
        } else if (p < stage.from && p > stage.from - FADE_MARGIN) {
          opacity = 1 - (stage.from - p) / FADE_MARGIN;
        } else if (p > stage.to && p < stage.to + FADE_MARGIN) {
          opacity = 1 - (p - stage.to) / FADE_MARGIN;
        }
        opacity = Math.max(0, Math.min(1, opacity));
        el.style.opacity = String(opacity);
        const translate = (1 - opacity) * 12;
        el.style.transform = `translateY(${translate}px)`;
        el.style.pointerEvents = opacity > 0.5 ? "auto" : "none";
        const isActive = opacity > 0.5;
        el.setAttribute("aria-hidden", isActive ? "false" : "true");
        el.inert = !isActive;
      }
    };
    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [progressRef]);

  return (
    <div className="relative h-full w-full">
      {STAGES.map((stage) => {
        const Panel = PANEL_COMPONENTS[stage.id];
        return (
          <div
            key={stage.id}
            ref={(el) => {
              panelRefs.current[stage.id] = el;
            }}
            className="absolute inset-0 flex items-center overflow-y-auto transition-opacity"
            style={{ opacity: 0 }}
          >
            <Panel />
          </div>
        );
      })}
    </div>
  );
}
