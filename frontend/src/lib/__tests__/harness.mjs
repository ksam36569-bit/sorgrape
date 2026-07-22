// Loads the real data layer with the fake Supabase client swapped in, so
// lib/api.js itself is tested unmodified.
import { readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const src = readFileSync(new URL("../api.js", import.meta.url), "utf8").replace(
  'import { supabase } from "./supabase";',
  'import { makeFakeSupabase } from "FAKE";\nexport const supabase = makeFakeSupabase();'
).replace("FAKE", new URL("./fakeSupabase.mjs", import.meta.url).href);

const dir = mkdtempSync(join(tmpdir(), "sogrape-"));
const file = join(dir, "api.mjs");
writeFileSync(file, src);
export const { api, supabase } = await import(file);
