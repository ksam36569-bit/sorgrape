import React from "react";
import { motion } from "framer-motion";

/**
 * Line-art wine glass for the entry animation.
 *
 * Drawn on a 140x210 grid so the caller can size it freely. The bowl path is
 * reused as a clip for the wine, which is why `level` can be animated smoothly:
 * the fill is one rectangle sliding up behind the clip, not a reshaped path.
 *
 * @param level    0 = empty, 1 = full to the rim
 * @param pouring  draw the stream falling into the bowl
 */
const BOWL = "M20,14 L20,54 C20,92 41,112 70,112 C99,112 120,92 120,54 L120,14 Z";

// Interior span the wine can occupy, in the same user units as BOWL.
const WINE_TOP = 16;
const WINE_BOTTOM = 112;

const WineGlass = ({
  id = "glass",
  level = 0,
  pouring = false,
  size = 190,
  stroke = "#7A1B2B",
  className = "",
  transition = { duration: 1.5, ease: "easeInOut" },
}) => {
  const clipId = `bowl-clip-${id}`;
  const wineId = `wine-grad-${id}`;
  const height = WINE_BOTTOM - WINE_TOP;
  const y = WINE_BOTTOM - height * Math.max(0, Math.min(1, level));

  return (
    <svg
      viewBox="0 0 140 210"
      width={size}
      height={(size * 210) / 140}
      className={className}
      role="img"
      aria-label="Wine glass"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BOWL} />
        </clipPath>
        <linearGradient id={wineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8C2740" />
          <stop offset="55%" stopColor="#6E1B2E" />
          <stop offset="100%" stopColor="#511320" />
        </linearGradient>
      </defs>

      {/* Stream, drawn behind the glass so it disappears under the rim */}
      {pouring && (
        <motion.line
          x1="70"
          x2="70"
          y1="-70"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ y2: -70, opacity: 0 }}
          animate={{ y2: 30, opacity: 0.85 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeIn" }}
        />
      )}

      <g clipPath={`url(#${clipId})`}>
        <motion.rect
          x="0"
          width="140"
          initial={false}
          animate={{ y, height: WINE_BOTTOM - y + 2 }}
          transition={transition}
          fill={`url(#${wineId})`}
        />
        {/* Bubbles drift up once there is wine to drift through */}
        {level > 0.15 &&
          [
            { cx: 52, r: 2.1, delay: 0 },
            { cx: 84, r: 1.5, delay: 0.7 },
            { cx: 66, r: 1.2, delay: 1.3 },
          ].map((b, i) => (
            <motion.circle
              key={i}
              cx={b.cx}
              r={b.r}
              fill="#C98A9B"
              opacity="0.5"
              initial={{ cy: WINE_BOTTOM - 6 }}
              animate={{ cy: [WINE_BOTTOM - 6, y + 6], opacity: [0, 0.5, 0] }}
              transition={{ duration: 2.6, delay: b.delay, repeat: Infinity, ease: "easeOut" }}
            />
          ))}
      </g>

      {/* Outline sits above the wine so the rim reads as glass, not liquid */}
      <path d={BOWL} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="20" y1="14" x2="120" y2="14" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="70" y1="112" x2="70" y2="172" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M42,176 C42,170 98,170 98,176" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};

export default WineGlass;
