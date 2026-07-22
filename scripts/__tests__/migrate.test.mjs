// Tests the real runner with a fake pg driver injected.
//
// Run from the repo root:  node scripts/__tests__/migrate.test.mjs
import { migrate } from "../migrate.mjs";
import fakepg, { log, reset, configure } from "./fakepg.mjs";
const DIR = new URL("./m", import.meta.url).pathname;
let pass=0, fail=0;
const check=(n,c,d="")=>{console.log((c?"PASS  ":"FAIL  ")+n); c?pass++:(fail++, d&&console.log("   "+d));};
const run = async (opts) => { reset(); const code = await migrate({ dir: DIR, driver: fakepg, ...opts }); return { log:[...log], code }; };
const insertedFiles = (l) => l.filter(x=>x[0]==="query"&&String(x[1]??"").startsWith("insert into public.schema_migrations")).map(x=>JSON.parse(x[2])[0]);

configure({});
let r = await run({ url: undefined });
check("no SUPABASE_DB_URL skips without failing the build", r.code===0 && !r.log.some(l=>l[0]==="connect"));

configure({ applied:new Set() });
r = await run({ url:"postgres://u:p@h/db" });
check("applies every migration in filename order",
  JSON.stringify(insertedFiles(r.log))===JSON.stringify(["0001_a.sql","0002_b.sql","0003_c.sql"]), JSON.stringify(insertedFiles(r.log)));
check("wraps each migration in its own transaction",
  r.log.filter(l=>String(l[1])==="begin").length===3 && r.log.filter(l=>String(l[1])==="commit").length===3);
check("takes an advisory lock before applying", r.log.some(l=>String(l[1]??"").includes("pg_advisory_lock")));
check("releases the lock afterwards", r.log.some(l=>String(l[1]??"").includes("pg_advisory_unlock")));
check("creates the tracking table", r.log.some(l=>String(l[1]??"").includes("create table if not exists")));
check("relaxes cert verification for Supabase", (r.log[0][2]||"").includes("rejectUnauthorized"));
check("exits 0 on success", r.code===0);

configure({ applied:new Set(["0001_a.sql","0002_b.sql","0003_c.sql"]) });
r = await run({ url:"postgres://u:p@h/db" });
check("re-running applies nothing", insertedFiles(r.log).length===0);
check("re-running still exits 0", r.code===0);

configure({ applied:new Set(["0001_a.sql"]) });
r = await run({ url:"postgres://u:p@h/db" });
check("only pending migrations run",
  JSON.stringify(insertedFiles(r.log))===JSON.stringify(["0002_b.sql","0003_c.sql"]), JSON.stringify(insertedFiles(r.log)));

configure({ applied:new Set(), failOn:"create table b()" });
r = await run({ url:"postgres://u:p@h/db" });
check("a failing migration rolls back", r.log.some(l=>String(l[1])==="rollback"));
check("a failing migration fails the build", r.code===1);
check("nothing after the failure is applied",
  JSON.stringify(insertedFiles(r.log))===JSON.stringify(["0001_a.sql"]), JSON.stringify(insertedFiles(r.log)));

configure({ connectFails:true });
r = await run({ url:"postgres://u:p@h/db" });
check("an unreachable database fails the build rather than deploying quietly", r.code===1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
