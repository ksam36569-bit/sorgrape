// Export service for the Performance Snapshot tab.
//
// PDF reuses the app's existing exportPDF (jsPDF + html2canvas), so there is one
// code path for "capture a DOM node as PDF". PNG and JSON are added here. The
// heavy libraries (html2canvas, file-saver) are imported dynamically so they
// never load for someone who does not click Export.

import { exportPDF } from "./reports";
import { buildExportPayload } from "./performanceSnapshot";

const stamp = () => new Date().toISOString().slice(0, 10);

/** PDF of the snapshot node — delegates to the shared exporter. */
export async function exportSnapshotPDF(elementId = "performance-snapshot-capture") {
  return exportPDF(elementId, `sogrape-performance-snapshot-${stamp()}.pdf`);
}

/** PNG of the snapshot node, at 2x for a crisp raster. */
export async function exportSnapshotPNG(elementId = "performance-snapshot-capture") {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Element #${elementId} not found`);
  const [{ default: html2canvas }, { saveAs }] = await Promise.all([
    import("html2canvas"),
    import("file-saver"),
  ]);
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
  });
  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) saveAs(blob, `sogrape-performance-snapshot-${stamp()}.png`);
      resolve();
    }, "image/png");
  });
}

/** Structured JSON: { metrics, sources, verificationLog }. */
export async function exportSnapshotJSON() {
  const { saveAs } = await import("file-saver");
  const payload = buildExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  saveAs(blob, `sogrape-performance-snapshot-${stamp()}.json`);
  return payload;
}
