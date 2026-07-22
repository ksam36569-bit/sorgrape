import React from "react";

/**
 * Sogrape wine-glass illustration — used on entry screen.
 * Uses bordeaux stroke + muted-gold fill accents; on-brand, elegant.
 */
const WineGlass = ({ filled = true, size = 220, id = "left", accentTop = 62 }) => {
  const gradId = `wine-grad-${id}`;
  const shineId = `shine-${id}`;
  return (
    <svg
      viewBox="0 0 220 380"
      width={size}
      height={(size * 380) / 220}
      className="wine-glass-svg"
      role="img"
      aria-label="Sogrape wine glass"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4E0F1A" />
          <stop offset="60%" stopColor="#721B29" />
          <stop offset="100%" stopColor="#3B0A12" />
        </linearGradient>
        <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="30%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <path d="M40,20 C40,140 65,205 110,205 C155,205 180,140 180,20 Z" />
        </clipPath>
      </defs>

      {/* Bowl outline */}
      <path
        d="M40,20 C40,140 65,205 110,205 C155,205 180,140 180,20 Z"
        fill="none"
        stroke="#C6A87C"
        strokeWidth="1.5"
      />

      {/* Wine fill (clipped inside bowl) */}
      {filled && (
        <g clipPath={`url(#clip-${id})`}>
          <rect x="30" y={220 - accentTop * 2.4} width="200" height="260" fill={`url(#${gradId})`} className="wine-fill" />
          {/* Meniscus */}
          <ellipse cx="110" cy={220 - accentTop * 2.4} rx="70" ry="6" fill="#8A2334" opacity="0.9" />
          {/* Shine */}
          <path
            d="M60,60 C70,90 80,110 88,140"
            stroke={`url(#${shineId})`}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>
      )}

      {/* Rim highlight */}
      <path d="M42,22 C60,26 160,26 178,22" stroke="#E9D9B6" strokeWidth="0.8" fill="none" opacity="0.7" />

      {/* Stem */}
      <line x1="110" y1="205" x2="110" y2="320" stroke="#C6A87C" strokeWidth="2.2" />
      {/* Node */}
      <circle cx="110" cy="245" r="2.4" fill="#C6A87C" />

      {/* Base */}
      <ellipse cx="110" cy="330" rx="55" ry="8" fill="none" stroke="#C6A87C" strokeWidth="2" />
      <ellipse cx="110" cy="330" rx="55" ry="8" fill="#721B29" opacity="0.15" />
    </svg>
  );
};

export default WineGlass;
