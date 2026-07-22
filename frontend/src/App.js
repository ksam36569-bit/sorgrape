import React, { Suspense, lazy } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/context/ThemeProvider";
import { ScorecardProvider } from "@/context/ScorecardContext";
import EntryScreen from "@/pages/EntryScreen";

// The entry screen is what everyone lands on, so it stays in the main bundle.
// The rest are split out — a visitor who never opens the scorecard never pays
// for recharts, reactflow or the export libraries.
const PortalPage = lazy(() => import("@/pages/PortalPage"));
const SetupWizard = lazy(() => import("@/pages/SetupWizard"));
const ScorecardPage = lazy(() => import("@/pages/ScorecardPage"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm text-muted-foreground font-body">Loading…</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ScorecardProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<EntryScreen />} />
              <Route path="/portal" element={<PortalPage />} />
              <Route path="/setup" element={<SetupWizard />} />
              <Route path="/scorecard" element={<ScorecardPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="bottom-right" theme="light" offset="20px" />
      </ScorecardProvider>
    </ThemeProvider>
  );
}

export default App;
