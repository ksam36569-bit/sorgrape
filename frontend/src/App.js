import React, { Suspense, lazy } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/context/ThemeProvider";
import { ScorecardProvider } from "@/context/ScorecardContext";
import EntryScreen from "@/pages/EntryScreen";
import { isConfigured } from "@/lib/supabase";

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

/**
 * Shown when the build has no Supabase credentials. Without this the app would
 * white-screen on a missing environment variable, which tells the reader nothing.
 */
function NeedsConfiguration() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF6F3] px-6 text-[#4A2027]">
      <div className="max-w-lg">
        <h1 className="font-serif text-3xl text-[#5C1622]">Almost there</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#6B5A55]">
          This deployment has no database credentials, so there is nothing to load yet.
          Add these two variables in your hosting settings and redeploy:
        </p>
        <ul className="mt-4 space-y-1.5 font-mono text-xs text-[#5C1622]">
          <li>REACT_APP_SUPABASE_URL</li>
          <li>REACT_APP_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-[#8A7671]">
          Both are in the Supabase dashboard under Project Settings → API. They are
          read at build time, so a redeploy is required after adding them.
        </p>
      </div>
    </div>
  );
}

function App() {
  if (!isConfigured) return <NeedsConfiguration />;

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
