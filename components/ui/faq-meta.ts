// FAQ metadata for the FAQ scene (server-safe, pure; no React, no three.js). Everything is
// derived from the FAQ's own question and answer strings, never typed: the topic (which
// visual answers it), the figures that appear verbatim in the answer (the only numbers the
// scene may show), its one-word verdict ("Yes", "Both") and the slug of its focus id
// (data-focus-id="faq:<topic>:<slug>").
import type { FAQ } from "@/lib/seo";
import { slugify } from "@/lib/utils";

export type FaqTopic = "experience" | "stack" | "availability" | "timezone" | "response" | "pricing" | "process" | "other";

/**
 * A figure quoted from an answer: its exact text and the value(s) it states.
 * k: money (currency units) · time (minutes) · percent · count. lo..hi is a range ("6-10
 * weeks"); `plus` = "4+ hours"; `lt` = "< 5 minutes".
 */
export type FaqFigure = { t: string; k: "money" | "time" | "percent" | "count"; lo: number; hi: number; plus?: 1; lt?: 1 };

export type FaqMeta = { topic: FaqTopic; slug: string; id: string; figures: FaqFigure[]; verdict: string | null };

/** Topic from the question (first match wins; time zone before availability). */
const TOPICS: [FaqTopic, RegExp][] = [
  ["timezone", /time ?zone/i],
  ["experience", /\bexperience\b.*\byears?\b|\byears?\b.*\bexperience\b|how long have you/i],
  ["availability", /\bavailab|full-time|freelance|start this week|can you start/i],
  ["response", /\brespon|\breply\b|get back to/i],
  ["pricing", /\bcharge|\bcosts?\b|\bpric|\brates?\b(?!-)|budget|payment|\bpay\b|invoice|\bbill\b|smallest project/i],
  ["stack", /\bstack\b|speciali[sz]e|technolog|framework|\bvs\.?\b|\bor the\b|\bor something\b|\bwhich (tools|language)/i],
  ["process", /timeline|how long|process|contract|\bndas?\b|largest|audit|take over|maintenance|deploy|agenc|\btests?\b|migrate|version|onboard|codebase/i],
];

export function faqTopic(q: string): FaqTopic {
  return TOPICS.find(([, re]) => re.test(q))?.[0] ?? "other";
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const MINUTES: [RegExp, number][] = [
  [/^min/i, 1],
  [/^h(ou)?r/i, 60],
  [/^business day/i, 60 * 24],
  [/^day/i, 60 * 24],
  [/^w(ee)?k/i, 60 * 24 * 7],
  [/^month/i, 60 * 24 * 30],
  [/^y(ea)?r/i, 60 * 24 * 365],
];
const NUM = String.raw`(?:\d[\d,]*(?:\.\d+)?k?|one|two|three|four|five|six|seven|eight|nine|ten|twelve)`;
const TIME_UNIT = String.raw`(?:min(?:ute)?s?|h(?:ou)?rs?|business days?|days?|w(?:ee)?ks?|months?|y(?:ea)?rs?)\b(?:\/(?:week|month))?`;
const COUNT_UNIT = String.raw`(?:active clients|clients|retainers|core flows|flows)\b`;
// Each pattern quotes a figure with its unit; a bare number ("Node.js 20", "/v1", "SOC 2", "429") never counts.
const FIGURE = new RegExp(
  [
    String.raw`(?<money>[$€]\s?\d[\d,]*(?:\.\d+)?k?(?:\s?[–-]\s?[$€]?\d[\d,]*k?)?(?:\/(?:week|month|hour|day|year))?)`,
    String.raw`(?<pct>[~≈]?\d+(?:\.\d+)?(?:\s?[–-]\s?\d+(?:\.\d+)?)?\s?%)`,
    String.raw`(?<time>(?:<\s?|~)?${NUM}(?:\s?[–-]\s?${NUM})?\+?[\s-]${TIME_UNIT})`,
    String.raw`(?<count>${NUM}(?:\s?[–-]\s?${NUM})?\+?\s${COUNT_UNIT})`,
  ].join("|"),
  "gi",
);

const NEGATION = /\b(?:don't|do not|never|not|no)\b/i;

const num = (s: string): number => {
  const w = WORDS[s.toLowerCase()];
  if (w) return w;
  const k = /k$/i.test(s);
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n * (k ? 1000 : 1) : NaN;
};

/** The figures an answer states, in reading order (at most 4, no repeats). */
export function faqFigures(a: string): FaqFigure[] {
  const out: FaqFigure[] = [];
  for (const m of a.matchAll(FIGURE)) {
    const g = m.groups ?? {};
    const t = m[0].trim();
    // A figure the answer rules out ("I don't chase 100% coverage") is not a fact to show.
    const clause = a.slice(Math.max(0, (m.index ?? 0) - 40), m.index).split(/[.;:—(]/).pop() ?? "";
    if (NEGATION.test(clause)) continue;
    const nums = (m[0].match(new RegExp(NUM, "gi")) ?? []).map(num).filter((n) => Number.isFinite(n));
    if (!nums.length) continue;
    const lo = nums[0];
    const hi = nums.length > 1 ? nums[1] : lo;
    const plus = /\+/.test(m[0]) ? 1 : undefined;
    const lt = /^</.test(m[0].trim()) ? 1 : undefined;
    let f: FaqFigure | null = null;
    if (g.money) f = { t, k: "money", lo, hi };
    else if (g.pct) f = { t, k: "percent", lo, hi };
    else if (g.time) {
      const unit = m[0].replace(/^.*?[\d+a-z]+[\s-]+(?=[a-z])/i, "").match(new RegExp(TIME_UNIT, "i"))?.[0] ?? "";
      const per = MINUTES.find(([re]) => re.test(unit))?.[1];
      if (per) f = { t, k: "time", lo: lo * per, hi: hi * per };
    } else if (g.count) f = { t, k: "count", lo, hi };
    if (!f || !(f.lo > 0)) continue;
    if (plus) f.plus = 1;
    if (lt) f.lt = 1;
    if (out.some((o) => o.t.toLowerCase() === f.t.toLowerCase())) continue;
    out.push(f);
    if (out.length === 4) break;
  }
  return out;
}

const VERDICT = /^(yes|no|both|often|sometimes|usually|probably not|almost always yes|not usually|depends)\b/i;

/** The answer's opening verdict word ("Yes", "Both"), when it starts with one. */
export function faqVerdict(a: string): string | null {
  const m = a.trim().match(VERDICT);
  if (!m) return null;
  return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
}

export function faqMeta(f: FAQ): FaqMeta {
  const topic = faqTopic(f.q);
  const slug = slugify(f.q).slice(0, 48).replace(/-+$/, "");
  return { topic, slug, id: `faq:${topic}:${slug}`, figures: faqFigures(f.a), verdict: faqVerdict(f.a) };
}
