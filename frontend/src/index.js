import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import { db } from "@/lib/store";
import seedProject from "@/data/sogrape-fy25.json";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const SEEDED_FLAG = "sogrape.seeded.fy25";

/**
 * Ship the FY25 scorecard with the app.
 *
 * Scorecards live in the browser, so a fresh visit to the deployed URL would
 * otherwise show an empty portal — there is no server holding the data. Seeding
 * it here means the link shows the scorecard to anyone who opens it.
 *
 * Runs once, tracked by a flag rather than by "is the database empty": an
 * emptiness check silently does nothing as soon as any other project exists,
 * which is exactly how a blank project ends up on screen instead. After the
 * first run the user's own project selection is left alone.
 */
async function seedOnce() {
  if (localStorage.getItem(SEEDED_FLAG)) return;
  try {
    if (!(await db.get(seedProject.id))) await db.put(seedProject);
    localStorage.setItem("sogrape.currentProjectId", seedProject.id);
    localStorage.setItem(SEEDED_FLAG, "1");
  } catch (e) {
    console.error("Could not load the bundled scorecard", e);
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
seedOnce().finally(() =>
  root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
));
