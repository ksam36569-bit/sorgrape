import React from "react";
import { cn } from "@/lib/utils";

/**
 * The Sogrape brand logo (hand-and-vine mark + "SOGRAPE · Original Legacy Wines"
 * wordmark), served as a static image from the public folder.
 *
 * The file is expected at frontend/public/LOGO SOGRAPE.png. Referencing it
 * through PUBLIC_URL and encoding the space means it resolves the same whether
 * the app is served from the domain root or a sub-path, and the browser never
 * has to guess about the literal space in the filename. If the file is missing
 * the alt text stands in, so a build never breaks on it.
 *
 * `chip` sets the logo on a small white plate. The artwork's wordmark is dark,
 * so on the dark sidebar and on the dark theme it would otherwise disappear;
 * the plate guarantees contrast on any background. Leave it off where the
 * surface is already light (the entry splash, the printed report).
 */
export const SOGRAPE_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/${encodeURIComponent("LOGO SOGRAPE.png")}`;

export function BrandLogo({
  height = 40,
  chip = false,
  className = "",
  alt = "Sogrape — Original Legacy Wines",
}) {
  const img = (
    <img
      src={SOGRAPE_LOGO_SRC}
      alt={alt}
      style={{ height }}
      className="block w-auto object-contain select-none"
      draggable={false}
    />
  );

  if (chip) {
    return (
      <span
        className={cn("inline-flex items-center justify-center rounded-md bg-white shadow-sm", className)}
        style={{ padding: Math.max(3, Math.round(height * 0.1)) }}
      >
        {img}
      </span>
    );
  }

  return <span className={cn("inline-flex", className)}>{img}</span>;
}

export default BrandLogo;
