// The Sogrape strategic plan — the company's own framework, shown at the head of
// the Scorecard tab and in the printable Report. It is fixed company content
// rather than per-project data, so it lives here as the single source of truth
// both views (and the Excel export) read from, instead of being duplicated.
//
// Purpose / Dream / Spirit / Character is the identity; the three Strategic
// Themes and three Strategic Results are index-aligned — theme i is accountable
// for result i — which is why the UI can render them as two rows of one grid.

export const PLAN_STATEMENTS = [
  ["Purpose", "To bring friendship and happiness to everyone we touch, through our wines."],
  ["Dream", "To be admired as the world’s most successful family-owned wine company."],
  ["Spirit", "“Sograpiness” — friendship and happiness lived as an internal culture, not just a marketing line."],
];

export const CHARACTER_TRAITS = ["Innovative", "Courageous", "Agile", "Challenging", "Passionate", "Trusted", "Sensible", "Family"];

export const STRATEGIC_THEMES = [
  { name: "Growth & Portfolio Leadership", tag: "Growth Branches" },
  { name: "Organisational Agility & Efficiency", tag: "Organisational Trunk" },
  { name: "Sustainable & Responsible Growth", tag: "Sustainability Roots" },
];

export const STRATEGIC_RESULTS = [
  "Record consolidated sales & profitable growth — EBITDA, ROCE, net profit, turnover and brand-level share.",
  "Innovation throughput & digital / process transformation delivered — transformational initiatives, innovation pipeline, digitalised processes.",
  "Sustainability commitments & talent investment delivered — UNGC / IWCA membership, new hires, training and decarbonisation progress.",
];
