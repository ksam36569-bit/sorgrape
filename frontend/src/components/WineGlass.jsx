import React from "react";

/**
 * Line-art wine glass for the entry animation.
 *
 * Drawn on a 140x210 grid so the caller can size it freely. The bowl path doubles
 * as a clip for the wine, so `level` moves one rectangle rather than reshaping a
 * path each frame.
 *
 * The fill is a plain CSS transition on a transform, deliberately not a
 * framer-motion animation. Two things went wrong with the motion version:
 * animating the rect's y/height wrote CSS pixels, which stop matching user units
 * once the SVG is scaled; and re-renders during the sequence interrupted the
 * animation, leaving the glasses stuck part-filled. A transform keeps the units
 * in user space, and a CSS transition always lands on its final value.
 *
 * @param level    0 = empty, 1 = full to the rim
 * @param pouring  draw the stream falling into the bowl
 */
const BOWL = "M20,14 L20,54 C20,92 41,112 70,112 C99,112 120,92 120,54 L120,14 Z";

const WINE_TOP = 16;
const WINE_BOTTOM = 112;
const SPAN = WINE_BOTTOM - WINE_TOP;

const BUBBLES = [
  { cx: 52, r: 2.1, delay: "0s" },
  { cx: 84, r: 1.5, delay: "0.8s" },
  { cx: 66, r: 1.2, delay: "1.5s" },
];

const WineGlass = ({
  id = "glass",
  level = 0,
  pouring = false,
  size = 190,
  stroke = "#7A1B2B",
  fillMs = 1500,
  className = "",
}) => {
  const clipId = `bowl-clip-${id}`;
  const wineId = `wine-grad-${id}`;
  const filled = Math.max(0, Math.min(1, level));
  const drop = SPAN * (1 - filled);

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
        <style>{`
          @keyframes wg-rise-${id} {
            0%   { transform: translateY(0);      opacity: 0; }
            25%  { opacity: .55; }
            100% { transform: translateY(-${Math.max(8, SPAN * filled - 14)}px); opacity: 0; }
          }
          .wg-bubble-${id} { animation: wg-rise-${id} 2.8s ease-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .wg-fill-${id} { transition: none !important; }
            .wg-bubble-${id} { animation: none; opacity: 0; }
          }
        `}</style>
      </defs>

      {/* Stream sits behind the glass so it vanishes under the rim */}
      {pouring && (
        <line
          x1="70"
          x2="70"
          y1="-60"
          y2="30"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}

      <g clipPath={`url(#${clipId})`}>
        <rect
          className={`wg-fill-${id}`}
          x="0"
          y={WINE_TOP}
          width="140"
          height={SPAN + 2}
          fill={`url(#${wineId})`}
          style={{
            transform: `translateY(${drop}px)`,
            transition: `transform ${fillMs}ms cubic-bezier(.4,0,.2,1)`,
          }}
        />
        {filled > 0.15 &&
          BUBBLES.map((b, i) => (
            <circle
              key={i}
              className={`wg-bubble-${id}`}
              cx={b.cx}
              cy={WINE_BOTTOM - 8}
              r={b.r}
              fill="#C98A9B"
              opacity="0"
              style={{ animationDelay: b.delay }}
            />
          ))}
      </g>

      {/* Outline above the wine, so the rim reads as glass rather than liquid */}
      <path d={BOWL} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="20" y1="14" x2="120" y2="14" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="70" y1="112" x2="70" y2="172" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M42,176 C42,170 98,170 98,176" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};

export default WineGlass;
