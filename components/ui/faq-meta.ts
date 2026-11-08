// FAQ metadata for the FAQ scene (server-safe, pure; no React, no three.js). Everything is
// derived from the FAQ's own question and answer strings, never typed: the topic (which
// visual answers it), the figures that appear verbatim in the answer with the words that
// say what they count (the only numbers the scene may show), its opening verdict ("Yes",
// "Both"), the items or steps it lists (verbatim slices) and the slug of its focus id
// (data-focus-id="faq:<topic>:<slug>").
import type { FAQ } from "@/lib/seo";
import { slugify } from "@/lib/utils";

export type FaqTopic = "experience" | "stack" | "availability" | "timezone" | "response" | "pricing" | "process" | "other";

/**
 * A figure quoted from an answer.
 * - t: the figure as the answer words it, with the words that give it meaning ("ECS Fargate
 *   covers 90% of production workloads", "Weekly retainers from $2,500/week"): a verbatim slice.
 * - v: the figure alone, verbatim ("90%", "$2,500/week", "< 5 minutes").
 * - k: money (currency units) · time (a duration, in minutes) · percent · count.
 * - lo..hi: its value(s) in those units (a range: "6-10 weeks"); n0..n1: the same numbers as
 *   written, in their own unit `u` ("week", "month", "minute", "core flows", "$").
 * - per: a rate ("$2,500/week", "10-40 hours/month"): never plotted with plain amounts.
 * - plus: "4+ hours" · lt: an upper bound ("< 5 minutes", "within", "up to") · gt: a floor
 *   ("> $500/month", "from $8,000").
 */
export type FaqFigure = {
  t: string;
  v: string;
  k: "money" | "time" | "percent" | "count";
  lo: number;
  hi: number;
  n0: number;
  n1: number;
  u: string;
  per?: string;
  plus?: 1;
  lt?: 1;
  gt?: 1;
};

/** An item or step the answer lists (verbatim, at most ~9 words); x: it is a "no"/"never". */
export type FaqStep = { t: string; x?: 1 };

/**
 * One alternative a "X vs Y" / "X or Y" question weighs: t its name as the question words it,
 * s the answer's clause that says when it fits, i the items listed for it, lead: the default.
 */
export type FaqOption = { t: string; s: string; i?: string[]; lead?: 1 };

export type FaqMeta = {
  topic: FaqTopic;
  slug: string;
  id: string;
  figures: FaqFigure[];
  verdict: string | null;
  /** The answer's list (an explicit enumeration), else its sentences (after any verdict). */
  steps: FaqStep[];
  /** "enum": `steps` is a list the answer enumerates; "say": its sentences. */
  list: "enum" | "say";
  /** The words that introduce an enumeration ("Three things", "Tiered"), when there are any. */
  title: string | null;
  /** The alternatives the question weighs ("MongoDB vs Postgres"), when the answer speaks to 2+. */
  options: FaqOption[];
};

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
/** Time units → [own unit name, minutes]. */
const UNITS: [RegExp, string, number][] = [
  [/^min/i, "minute", 1],
  [/^h(ou)?r/i, "hour", 60],
  [/^business day/i, "business day", 60 * 24],
  [/^day/i, "day", 60 * 24],
  [/^w(ee)?k/i, "week", 60 * 24 * 7],
  [/^month/i, "month", 60 * 24 * 30],
  [/^y(ea)?r/i, "year", 60 * 24 * 365],
];
const NUM = String.raw`(?:\d[\d,]*(?:\.\d+)?k?|one|two|three|four|five|six|seven|eight|nine|ten|twelve)`;
const PER = String.raw`(?:\/(?:week|month|hour|day|year))`;
const TIME_UNIT = String.raw`(?:min(?:ute)?s?|h(?:ou)?rs?|business days?|days?|w(?:ee)?ks?|months?|y(?:ea)?rs?)\b${PER}?`;
const COUNT_UNIT = String.raw`(?:active clients|clients|retainers|core flows|flows)\b`;
// Each pattern quotes a figure with its unit; a bare number ("Node.js 20", "/v1", "SOC 2", "429") never counts.
const FIGURE = new RegExp(
  [
    String.raw`(?<money>(?:[<>]\s?)?[$€]\s?\d[\d,]*(?:\.\d+)?k?(?:\s?[–-]\s?[$€]?\d[\d,]*k?)?${PER}?)`,
    String.raw`(?<pct>(?:[<>]\s?)?[~≈]?\d+(?:\.\d+)?(?:\s?[–-]\s?\d+(?:\.\d+)?)?\s?%)`,
    String.raw`(?<time>(?:[<>]\s?|~)?${NUM}(?:\s?[–-]\s?${NUM})?\+?[\s-]${TIME_UNIT})`,
    String.raw`(?<count>${NUM}(?:\s?[–-]\s?${NUM})?\+?\s${COUNT_UNIT})`,
  ].join("|"),
  "gi",
);

const STOP = new Set(["with", "for", "of", "to", "and", "or", "the", "a", "an", "at", "in", "on", "from", "per", "is", "are", "than", "when", "if", "but", "so", "by", "depending", "during", "into", "before", "after", "about", "each", "every", "first", "shipping", "unless", "while", "that", "which"]);
/** Prepositions that carry a figure's meaning ("90% of production workloads", "$3,000/week for DevOps"). */
const LINK = new Set(["of", "for", "on", "per", "with"]);
const NEGATION = /\b(?:don't|do not|never|not|no)\b/i;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** A clause boundary at a[i] (sentence ends, ; : — ( ) and commas outside numbers). */
function isBound(a: string, i: number): boolean {
  const ch = a[i];
  if (ch === undefined) return true;
  if (";:—()?!".includes(ch)) return true;
  if (ch === ",") return !/\d/.test(a[i + 1] ?? "");
  if (ch === ".") return i + 1 >= a.length || a[i + 1] === " ";
  return false;
}

/**
 * The figure as the answer words it: its whole clause when that is short (≤ 9 words), else
 * the few words that lead to it (≤ 4, "Fixed-price MVPs from") and the words that follow and
 * say what it counts ("of production workloads", "faster for most workloads"). A short label
 * before a colon joins it ("Backend: < 5 minutes"). Always one verbatim slice.
 */
function label(a: string, at: number, end: number): string {
  let cs = at;
  while (cs > 0 && !isBound(a, cs - 1)) cs--;
  let ce = end;
  while (ce < a.length && !isBound(a, ce)) ce++;
  if (cs > 0 && a[cs - 1] === ":") {
    let ps = cs - 1;
    while (ps > 0 && !isBound(a, ps - 1)) ps--;
    if (words(a.slice(ps, cs - 1)) <= 2) cs = ps;
  }
  const clause = a.slice(cs, ce).trim();
  if (words(clause) <= 9) return clause;
  // The words leading to it: up to 4, from the last joint ("… and overlap 4+ hours").
  let start = cs;
  const lead = [...a.slice(cs, at).matchAll(/\S+/g)];
  if (lead.length > 4) {
    let k = lead.length - 4;
    for (let j = lead.length - 1; j >= k; j--)
      if (/^(?:and|or|but|if|when|so|that)$/i.test(lead[j][0]) || lead[j][0] === "I") {
        k = lead[j][0] === "I" ? j : j + 1;
        break;
      }
    start = k < lead.length ? cs + (lead[k].index ?? 0) : at;
  }
  let stop = end;
  let budget = 2;
  let linked = false;
  for (;;) {
    const w = a.slice(stop, ce).match(/^ ([a-z][a-z/-]+)/i);
    if (!w) break;
    const word = w[1].toLowerCase();
    if (LINK.has(word) && !linked) {
      linked = true;
      budget = 3;
      stop += w[0].length;
      continue;
    }
    if (STOP.has(word) || budget === 0) break;
    stop += w[0].length;
    budget--;
  }
  // A dangling preposition ("… of") is dropped again.
  return a
    .slice(start, stop)
    .trim()
    .replace(/\s+(?:of|for|on|per|with)$/i, "");
}

const num = (s: string): number => {
  const w = WORDS[s.toLowerCase()];
  if (w) return w;
  const k = /k$/i.test(s);
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n * (k ? 1000 : 1) : NaN;
};

type Found = { f: FaqFigure; at: number; end: number };

/** The figures an answer states, in reading order (at most 4, no repeats). */
function findFigures(a: string): Found[] {
  const out: Found[] = [];
  for (const m of a.matchAll(FIGURE)) {
    const g = m.groups ?? {};
    const at = m.index ?? 0;
    const raw = m[0].trimEnd();
    const end = at + raw.length;
    // A figure the answer rules out ("I don't chase 100% coverage") is not a fact to show.
    const clause = a.slice(Math.max(0, at - 40), at).split(/[.;:—(]/).pop() ?? "";
    if (NEGATION.test(clause)) continue;
    const nums = (raw.match(new RegExp(NUM, "gi")) ?? []).map(num).filter((n) => Number.isFinite(n));
    if (!nums.length) continue;
    const n0 = nums[0];
    const n1 = nums.length > 1 ? nums[1] : n0;
    const before = a.slice(Math.max(0, at - 14), at).toLowerCase();
    const per = raw.match(/\/(week|month|hour|day|year)/i)?.[1].toLowerCase();
    const t = label(a, at, end);
    let f: FaqFigure | null = null;
    if (g.money) f = { t, v: raw, k: "money", lo: n0, hi: n1, n0, n1, u: raw.includes("€") ? "€" : "$" };
    else if (g.pct) f = { t, v: raw, k: "percent", lo: n0, hi: n1, n0, n1, u: "%" };
    else if (g.time) {
      const unit = raw.replace(/^.*?[\d+a-z]+[\s-]+(?=[a-z])/i, "").match(new RegExp(TIME_UNIT, "i"))?.[0] ?? "";
      const def = UNITS.find(([re]) => re.test(unit));
      if (def) f = { t, v: raw, k: "time", lo: n0 * def[2], hi: n1 * def[2], n0, n1, u: def[1] };
    } else if (g.count) {
      const u = raw.match(new RegExp(COUNT_UNIT, "i"))?.[0].toLowerCase() ?? "";
      f = { t, v: raw, k: "count", lo: n0, hi: n1, n0, n1, u };
    }
    if (!f || !(f.lo > 0)) continue;
    if (per) f.per = per;
    if (/\+/.test(raw)) f.plus = 1;
    if (/^</.test(raw) || /\b(?:within|up to|under)\s*$/.test(before)) f.lt = 1;
    if (/^>/.test(raw) || /\b(?:from|over|at least)\s*$/.test(before)) f.gt = 1;
    const v = f.v.toLowerCase();
    if (out.some((o) => o.f.v.toLowerCase() === v)) continue;
    out.push({ f, at, end });
    if (out.length === 4) break;
  }
  return out;
}

/** The figures an answer states, in reading order (at most 4, no repeats). */
export function faqFigures(a: string): FaqFigure[] {
  return findFigures(a).map((x) => x.f);
}

const VERDICT = /^(yes|no|both|often|sometimes|usually|probably not|almost always yes|not usually|depends)\b/i;

/** The answer's opening verdict word ("Yes", "Both"), when it starts with one. */
export function faqVerdict(a: string): string | null {
  const m = a.trim().match(VERDICT);
  if (!m) return null;
  return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
}

// ------------------------------------------------------------------ lists and steps

/** Drops "(…)" asides and tidies spaces and edge punctuation. */
const unparen = (s: string) =>
  s
    .replace(/\s*\([^()]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:—–-]+|[\s,;:—–.]+$/g, "")
    .trim();

/** At most `max` words, cut at a natural joint first (" and ", " when ", ...). */
function short(s: string, max = 9): string {
  let t = unparen(s);
  if (words(t) <= max) return t;
  // The latest joint that keeps it within `max` words, else the first one.
  let cut = -1;
  for (const m of t.matchAll(/\s(?:and|so|when|unless|because|where|while|which|that|but)\s/g)) {
    const at = m.index ?? 0;
    if (words(t.slice(0, at)) < 2) continue;
    if (words(t.slice(0, at)) <= max || cut < 0) cut = at;
    if (words(t.slice(0, at)) > max) break;
  }
  if (cut > 0) t = t.slice(0, cut);
  if (words(t) <= max) return t;
  return `${t.split(/\s+/).slice(0, max).join(" ")}…`;
}

/** Splits at top-level commas (not inside parentheses or numbers), dropping a leading "and"/"or". */
function splitItems(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0 && !/\d/.test(s[i + 1] ?? "")) {
      out.push(s.slice(from, i));
      from = i + 1;
    }
  }
  out.push(s.slice(from));
  return out.map((x) => x.trim().replace(/^(?:and|or)\s+/i, "").trim()).filter(Boolean);
}

/** Sentences (". " / "? " / "! "), not split after "vs." or "e.g.". */
function sentences(a: string): { s: string; at: number }[] {
  const out: { s: string; at: number }[] = [];
  let from = 0;
  for (let i = 0; i < a.length; i++) {
    const ch = a[i];
    if ((ch === "." || ch === "?" || ch === "!") && (i + 1 >= a.length || a[i + 1] === " ")) {
      if (ch === "." && /\b(?:vs|e\.g|i\.e|etc)$/i.test(a.slice(Math.max(0, i - 4), i))) continue;
      const s = a.slice(from, i).trim();
      if (s) out.push({ s, at: from + (a.slice(from).length - a.slice(from).trimStart().length) });
      from = i + 1;
    }
  }
  const tail = a.slice(from).trim();
  if (tail) out.push({ s: tail, at: from + (a.slice(from).length - a.slice(from).trimStart().length) });
  return out;
}

type Enum = { items: string[]; title: string | null; at: number; end: number };

/**
 * The first enumeration of three or more items: "Three things: a, b, c", "(content,
 * navigation, forms)", "a, b, and c": verbatim items, with the words that introduce it.
 */
function findEnum(a: string): Enum | null {
  for (const { s, at } of sentences(a)) {
    // "(a, b, c)" inside the sentence.
    const p = s.match(/\(([^()]*,[^()]*,[^()]*)\)/);
    if (p && p.index !== undefined) {
      const items = splitItems(p[1]);
      if (items.length >= 3) {
        const title = short(`${s.slice(0, p.index)} ${s.slice(p.index + p[0].length)}`, 12);
        return { items, title: title || null, at: at + p.index, end: at + p.index + p[0].length };
      }
    }
    // "Intro: a, b, c" / "Intro — a, b, c".
    const c = s.match(/^([^:—]{2,80})(?::|\s—\s)\s*(.+)$/);
    if (c) {
      const items = splitItems(c[2]);
      if (items.length >= 3) return { items, title: short(c[1], 12) || null, at: at + c[1].length, end: at + s.length };
    }
    const items = splitItems(s);
    if (items.length >= 3) {
      // "… full working days with EU, MENA, and APAC": the first item is the lead-in plus
      // the first item; split it at its last "with/for/to/in" (the lead-in titles the list).
      const longest = Math.max(...items.slice(1).map(words));
      const lead = items[0].match(/^(.*\s(?:with|for|to|in))\s+(\S.*)$/i);
      if (lead && words(items[0]) > 6 && longest <= 3 && words(lead[2]) <= 3) {
        const pre = lead[1].replace(/^.*\s(?:and|but)\s/i, "").replace(/\s+(?:with|for|to|in)$/i, "");
        const from = s.indexOf(lead[2]);
        return { items: [lead[2], ...items.slice(1)], title: short(pre, 8) || null, at: at + from, end: at + s.length };
      }
      return { items, title: null, at, end: at + s.length };
    }
  }
  return null;
}

const OPENERS = /^(?:if|when|for|unless|so|but|because|while)\b/i;

/** One step per sentence (or ";" clause), each a short verbatim slice. */
function sayings(text: string): string[] {
  const out: string[] = [];
  for (const { s } of sentences(text)) {
    for (const part of s.split(/;\s*/)) {
      const whole = unparen(part);
      if (!whole) continue;
      if (words(whole) <= 9) {
        out.push(whole);
        continue;
      }
      const clauses = splitItems(whole.replace(/\s—\s/g, ", ")).filter((c) => words(c) >= 2);
      const pick = clauses.find((c) => !OPENERS.test(c)) ?? clauses[0] ?? whole;
      out.push(short(pick));
    }
  }
  return out.slice(0, 4);
}

const step = (t: string): FaqStep => (NEGATION.test(t) ? { t, x: 1 } : { t });

// ------------------------------------------------------------------ alternatives ("X vs Y")

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** A loose matcher for an option name ("agencies" finds "Agency"); what it finds is verbatim. */
function optionRe(name: string): RegExp {
  const ws = name.split(/\s+/).map((w) => reEsc(w.replace(/(?:ies|es|s)$/i, "")) + String.raw`[\w.]*`);
  return new RegExp(String.raw`(?<![\w.])${ws.join(String.raw`\s+`)}`, /[A-Z]/.test(name) ? "g" : "gi");
}

/**
 * The alternatives a "X vs Y" / "X or Y" question weighs, each as the answer names it, with
 * the clause that says when it fits (preferring one that starts with it) and the items listed
 * right after it ("MongoDB wins for: a, b, c", "Terraform for most teams (a, b, c)").
 */
function findOptions(q: string, a: string): FaqOption[] {
  const body = q.replace(/\?\s*$/, "").replace(/^.*\s[—:]\s/, "");
  let parts = body.split(/\s+vs\.?\s+/i);
  if (parts.length < 2) parts = body.split(/\s+or\s+/i);
  if (parts.length < 2 || parts.length > 3) return [];
  const out: FaqOption[] = [];
  const atStart = (i: number) => i === 0 || /[.;:—(,]\s*$/.test(a.slice(Math.max(0, i - 3), i));
  parts.forEach((p, k) => {
    const w = p.replace(/^(?:the|only|a|an)\s+/i, "").split(/\s+/);
    for (let n = Math.min(4, w.length); n >= 1; n--) {
      const name = (k === 0 ? w.slice(-n) : w.slice(0, n)).join(" ").replace(/^(?:the|only|a|an)\s+/i, "");
      if (!name || STOP.has(name.toLowerCase())) continue;
      const ms = [...a.matchAll(optionRe(name))];
      if (!ms.length) continue;
      const m = ms.find((x) => atStart(x.index ?? 0)) ?? ms[0];
      const at = m.index ?? 0;
      let cs = at;
      if (!atStart(at)) while (cs > 0 && !isBound(a, cs - 1)) cs--;
      let ce = at + m[0].length;
      while (ce < a.length && !isBound(a, ce)) ce++;
      const s = short(a.slice(cs, ce), 12);
      let items: string[] = [];
      if (a[ce] === ":" || a[ce] === "(") {
        const close = a[ce] === "(" ? a.indexOf(")", ce) : -1;
        const rest = a.slice(ce + 1, close > 0 ? close : undefined);
        items = splitItems(close > 0 ? rest : (sentences(rest)[0]?.s ?? rest)).map((x) => short(x, 6)).slice(0, 4);
      }
      if (out.some((o) => o.s === s)) return;
      // Named as the question names it ("direct clients", "Postgres").
      let t = name;
      if (k > 0) {
        const cut = w.findIndex((x, j) => j > 0 && STOP.has(x.toLowerCase()));
        t = w.slice(0, cut > 0 ? cut : w.length).join(" ");
      }
      const o: FaqOption = { t, s };
      if (items.length >= 2) o.i = items;
      if (/\b(?:most|unless|default)\b/i.test(s) || new RegExp(`default to ${reEsc(m[0])}`, "i").test(a)) o.lead = 1;
      out.push(o);
      return;
    }
  });
  if (out.length < 2) return [];
  if (out.filter((o) => o.lead).length !== 1 || /^both\b/i.test(a.trim())) for (const o of out) delete o.lead;
  return out;
}

export function faqMeta(f: FAQ): FaqMeta {
  const topic = faqTopic(f.q);
  const slug = slugify(f.q).slice(0, 48).replace(/-+$/, "");
  const a = f.a;
  const verdict = faqVerdict(a);
  const en = findEnum(a);
  let found = findFigures(a);
  // A list is the answer when the figures only qualify its items ("paid 1-week audits").
  if (en && found.length && found.every((x) => x.at >= en.at && x.end <= en.end)) found = [];
  let steps: FaqStep[];
  let list: FaqMeta["list"] = "say";
  let title: string | null = null;
  if (verdict) {
    // After a verdict, its qualifiers: what the rest of the answer says.
    const rest = a.trim().slice(verdict.length).replace(/^[\s.,:;—–-]+/, "");
    steps = sayings(rest).map(step);
  } else if (en) {
    steps = en.items.slice(0, 5).map((x) => step(short(x)));
    list = "enum";
    title = en.title;
  } else steps = sayings(a).map(step);
  const options = topic === "availability" ? [] : findOptions(f.q, a);
  return { topic, slug, id: `faq:${topic}:${slug}`, figures: found.map((x) => x.f), verdict, steps, list, title, options };
}
