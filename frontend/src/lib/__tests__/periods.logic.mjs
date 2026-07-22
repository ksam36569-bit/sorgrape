// Period ordering and the reported/unreported distinction the quarterly
// achievement trend is built on. Run: node frontend/src/lib/__tests__/periods.logic.mjs
import { comparePeriods, isQuarterPeriod, isReported, periodsFor } from "../constants.js";
import { latestActual, measureAchievement, achievementPct } from "../calculations.js";
let pass=0,fail=0;
const eq=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);console.log((ok?"PASS  ":"FAIL  ")+n);ok?pass++:(fail++,console.log("   want",JSON.stringify(w),"got",JSON.stringify(g)))};
const near=(n,g,w,t=0.01)=>{const ok=g!==null&&Math.abs(g-w)<t;console.log((ok?"PASS  ":"FAIL  ")+n);ok?pass++:(fail++,console.log("   want",w,"got",g))};

const sorted=(ps)=>[...ps].sort(comparePeriods);

// Ordering. The lexical sort this replaced got the year boundary wrong.
eq("quarters order within a year", sorted(["Q3 FY25","Q1 FY25","Q4 FY25","Q2 FY25"]),["Q1 FY25","Q2 FY25","Q3 FY25","Q4 FY25"]);
eq("Q4 FY25 comes before Q1 FY26", sorted(["Q1 FY26","Q4 FY25"]),["Q4 FY25","Q1 FY26"]);
eq("lexical sort would have got that backwards", ["Q1 FY26","Q4 FY25"].sort((a,b)=>a.localeCompare(b)),["Q1 FY26","Q4 FY25"]);
eq("the annual row sits after its own quarters", sorted(["FY25","Q1 FY25","Q4 FY25"]),["Q1 FY25","Q4 FY25","FY25"]);
eq("four-digit years work too", sorted(["Q2 2026","Q3 2025"]),["Q3 2025","Q2 2026"]);
eq("an unparseable label sorts last", sorted(["ad hoc","Q1 FY25"]),["Q1 FY25","ad hoc"]);

// Which labels are quarters at all.
eq("Q3 FY25 is a quarter", isQuarterPeriod("Q3 FY25"),true);
eq("lowercase q2 is a quarter", isQuarterPeriod("q2 FY25"),true);
eq("FY25 is not a quarter", isQuarterPeriod("FY25"),false);
eq("Q5 is not a quarter", isQuarterPeriod("Q5 FY25"),false);
eq("empty is not a quarter", isQuarterPeriod(""),false);

// The period list a measure offers, driven by its time_period.
eq("quarterly offers four quarters", periodsFor("Quarterly","FY25"),["Q1 FY25","Q2 FY25","Q3 FY25","Q4 FY25"]);
eq("annual offers the fiscal year alone", periodsFor("Annual","FY25"),["FY25"]);

// Reported vs not. This is the whole point of the nullable actual.
eq("null actual is not reported", isReported({actual_value:null}),false);
eq("undefined actual is not reported", isReported({actual_value:undefined}),false);
eq("blank actual is not reported", isReported({actual_value:""}),false);
eq("zero IS reported", isReported({actual_value:0}),true);
eq("a number is reported", isReported({actual_value:12.5}),true);

const m={id:"m1",direction:"higher"};
const T=(period,target,actual)=>({measure_id:"m1",period,target_value:target,actual_value:actual});

// A quarter created in advance must not drag the measure down.
near("unreported quarters stay out of the average", measureAchievement(m,[T("Q1 FY25",100,90),T("Q2 FY25",100,null),T("Q3 FY25",100,null)]),90);
near("a reported zero DOES count", measureAchievement(m,[T("Q1 FY25",100,90),T("Q2 FY25",100,0)]),45);
eq("nothing reported scores 0, not NaN", measureAchievement(m,[T("Q1 FY25",100,null)]),0);

// Latest actual drives threshold-based RAG, so it must skip empty future rows.
eq("latest actual skips unreported quarters", latestActual(m,[T("Q1 FY25",100,88),T("Q4 FY25",100,null)]),88);
eq("latest actual respects year order", latestActual(m,[T("Q1 FY26",100,70),T("Q4 FY25",100,90)]),70);
eq("no reported rows at all is null", latestActual(m,[T("Q1 FY25",100,null)]),null);

// Direction still inverts, which the old raw actual/target trend ignored.
near("lower-is-better 4.2 vs 3.5 is 83%", achievementPct(4.2,3.5,"lower"),83.33);
near("the old raw division called it 120%", (4.2/3.5)*100,120);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
