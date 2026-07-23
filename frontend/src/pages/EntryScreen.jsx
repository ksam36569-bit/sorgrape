import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import WineGlass from "../components/WineGlass";
import { BrandLogo } from "../components/BrandLogo";
import { ENTRY } from "../constants/testIds";
import { ArrowRight } from "lucide-react";

/**
 * Entry screen.
 *
 * Two glasses swing together for a toast, then the wine pours in and the
 * scorecard opens. The sequence is a small timed state machine rather than a
 * chain of nested callbacks, so every step is visible in one place and the whole
 * thing can be skipped or disabled without unpicking anything.
 */
const STEPS = [
  { key: "enter", at: 0, caption: "To performance…" },
  { key: "clink", at: 700, caption: "To performance…" },
  { key: "pour", at: 1150, caption: "Pouring your scorecard…" },
  { key: "settle", at: 2900, caption: "Pouring your scorecard…" },
  { key: "welcome", at: 3300, caption: "Welcome" },
];

const FINAL = STEPS.length - 1;

const EntryScreen = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  // Anyone who prefers reduced motion gets the finished picture, no animation.
  const [step, setStep] = useState(reduceMotion ? FINAL : 0);

  useEffect(() => {
    if (reduceMotion || step >= FINAL) return undefined;
    const timers = STEPS.slice(1).map((s, i) =>
      setTimeout(() => setStep((cur) => Math.max(cur, i + 1)), s.at)
    );
    return () => timers.forEach(clearTimeout);
    // Runs once: the timers own the whole sequence from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const skip = () => setStep(FINAL);
  const go = () => navigate("/portal");

  const phase = STEPS[step].key;
  const clinking = phase === "clink" || phase === "pour";
  const pouring = phase === "pour";
  const level = useMemo(() => {
    if (phase === "enter" || phase === "clink") return 0.18;
    if (phase === "pour") return 0.7;
    return 0.72;
  }, [phase]);

  // Glasses tip toward each other for the toast, then stand upright.
  const tilt = clinking ? 13 : 0;
  const close = clinking ? 26 : 0;

  const glass = (side) => (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 26 }}
      animate={{
        opacity: 1,
        y: phase === "clink" ? -6 : 0,
        rotate: side === "left" ? tilt : -tilt,
        x: side === "left" ? close : -close,
      }}
      transition={{
        opacity: { duration: 0.5 },
        // A brief, stiff spring on contact reads as a clink rather than a glide.
        rotate: { type: "spring", stiffness: 210, damping: 13 },
        x: { type: "spring", stiffness: 210, damping: 13 },
        y: { type: "spring", stiffness: 300, damping: 12 },
      }}
      style={{ transformOrigin: "50% 85%" }}
      data-testid={side === "left" ? ENTRY.leftGlass : ENTRY.rightGlass}
    >
      <WineGlass
        id={side}
        level={level}
        pouring={pouring}
        size={172}
        fillMs={pouring ? 1600 : 500}
      />
    </motion.div>
  );

  return (
    <div
      data-testid={ENTRY.root}
      onClick={step < FINAL ? skip : go}
      className="relative min-h-screen overflow-hidden bg-[#FBF6F3] text-[#4A2027] cursor-pointer select-none"
    >
      {/* Warm vignette, so the cream background is not flat */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 38%, #FFFDFC 0%, #F6EDE8 55%, #EFE3DD 100%)" }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-14 text-center">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 text-[#7A1B2B]"
        >
          <BrandLogo height={40} />
        </motion.div>

        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-serif text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.05] mt-5 text-[#5C1622]"
        >
          Balanced Scorecard
        </motion.h1>

        <motion.p
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-5 max-w-xl text-sm md:text-base leading-relaxed text-[#6B5A55]"
        >
          One living picture of strategy — objectives, measures, targets and initiatives
          across every perspective of the company.
        </motion.p>

        <div className="mt-10 flex items-end justify-center gap-6 md:gap-10" data-testid="entry-glasses">
          {glass("left")}
          {glass("right")}
        </div>

        <div className="mt-12 h-12 flex flex-col items-center justify-start">
          <AnimatePresence mode="wait">
            <motion.p
              key={STEPS[step].caption}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="text-[10px] uppercase tracking-[0.42em] text-[#A08B85]"
              aria-live="polite"
            >
              {STEPS[step].caption}
            </motion.p>
          </AnimatePresence>

          <AnimatePresence>
            {step === FINAL && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.15 }}
                onClick={(e) => { e.stopPropagation(); go(); }}
                data-testid={ENTRY.enterButton}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#7A1B2B]/25 bg-[#7A1B2B] px-7 py-2.5 text-sm text-[#FBF6F3] transition-colors hover:bg-[#5C1622] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1B2B]/40"
              >
                Enter the scorecard
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default EntryScreen;
