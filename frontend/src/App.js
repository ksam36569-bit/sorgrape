import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/context/ThemeProvider";
import { ScorecardProvider } from "@/context/ScorecardContext";
import EntryScreen from "@/pages/EntryScreen";
import PortalPage from "@/pages/PortalPage";
import SetupWizard from "@/pages/SetupWizard";
import ScorecardPage from "@/pages/ScorecardPage";

function App() {
  return (
    <ThemeProvider>
      <ScorecardProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<EntryScreen />} />
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="/scorecard" element={<ScorecardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="bottom-right" theme="light" offset="20px" />
      </ScorecardProvider>
    </ThemeProvider>
  );
}

export default App;
