import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import WineGlass from "../components/WineGlass";
import { Button } from "@/components/ui/button";
import { ENTRY } from "../constants/testIds";
import { ArrowRight } from "lucide-react";

const EntryScreen = () => {
  const navigate = useNavigate();
  const go = () => navigate("/portal");

  return (
    <div
      data-testid={ENTRY.root}
      className="relative min-h-screen overflow-hidden bg-[#1A1213] text-[#F4EFEA]"
    >
      {/* Background photography */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1567072629554-20e689de2400?crop=entropy&cs=srgb&fm=jpg&q=80&w=2000')",
        }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#1A1213]/60 via-[#1A1213]/70 to-[#1A1213]" />
      <div aria-hidden className="absolute inset-0 grain" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-10 py-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full border border-sogrape-gold/60 flex items-center justify-center">
              <span className="font-serif text-sogrape-gold text-lg">S</span>
            </div>
            <div className="leading-tight">
              <div className="font-serif text-lg tracking-wide">Sogrape</div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-sogrape-gold/80">Estates & Wines</div>
            </div>
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/60 hidden sm:block">
            Balanced Scorecard · v1
          </div>
        </header>

        {/* Hero */}
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="max-w-5xl w-full text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-xs uppercase tracking-[0.5em] text-sogrape-gold/90 mb-6"
            >
              Est. 1942 · Porto, Portugal
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
              className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight"
            >
              A toast to strategy,
              <br />
              <span className="italic text-sogrape-gold">measured with care.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-8 text-base sm:text-lg text-white/70 max-w-2xl mx-auto"
            >
              The Sogrape Balanced Scorecard — one living picture of how our objectives, measures and
              initiatives are performing across every perspective, department and quarter.
            </motion.p>

            {/* Wine glasses */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.5, ease: "easeOut" }}
              className="mt-14 flex items-end justify-center gap-16 sm:gap-24"
            >
              <button
                data-testid={ENTRY.leftGlass}
                onClick={go}
                aria-label="Enter the portal"
                className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-sogrape-gold rounded-lg"
              >
                <WineGlass id="left" size={190} accentTop={62} />
                <div className="mt-4 text-xs uppercase tracking-[0.4em] text-sogrape-gold/70 group-hover:text-sogrape-gold transition-colors">
                  Enter
                </div>
              </button>
              <button
                data-testid={ENTRY.rightGlass}
                onClick={go}
                aria-label="Enter the portal"
                className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-sogrape-gold rounded-lg"
              >
                <WineGlass id="right" size={190} accentTop={58} />
                <div className="mt-4 text-xs uppercase tracking-[0.4em] text-sogrape-gold/70 group-hover:text-sogrape-gold transition-colors">
                  Enter
                </div>
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="mt-12"
            >
              <Button
                data-testid={ENTRY.enterButton}
                onClick={go}
                className="bg-sogrape-gold hover:bg-sogrape-gold/90 text-[#1A1213] font-semibold px-8 py-6 rounded-full text-sm uppercase tracking-[0.25em]"
              >
                Continue to the portal
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </motion.div>
          </div>
        </div>

        <footer className="px-10 py-6 text-[11px] uppercase tracking-[0.3em] text-white/40 flex justify-between">
          <span>Family owned · Since 1942</span>
          <span>Bordeaux · Porto · Douro</span>
        </footer>
      </div>
    </div>
  );
};

export default EntryScreen;
