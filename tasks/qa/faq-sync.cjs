#!/usr/bin/env node
/* faq-sync.cjs: FAQPage JSON-LD <-> visible FAQ markup, 1:1, in the RAW server HTML.
 * For every page in <baseUrl>/sitemap.xml (host rewritten to baseUrl; sitemap indexes are
 * followed), fetch the HTML with a plain request (no JS runs), then:
 *   - parse every <script type="application/ld+json"> block; collect each FAQPage node
 *     (anywhere in the graph) -> Question.name / acceptedAnswer.text, in order
 *   - extract the visible FAQ items from the same HTML: [data-faq-item] (the shared
 *     components/ui/faq-list.tsx markup: <details><summary><h3>Q</h3></summary><div.faq-a><p>A</p>);
 *     if a page has none, <details> inside a FAQ container ([data-section="faq"], [id*="faq"], .faq)
 *   - normalise whitespace (and decode entities / strip tags on both sides), then assert the
 *     same count, the same question text and the same answer text, in the same order.
 * Also reported (as failures): FAQ markup without FAQPage JSON-LD, FAQPage JSON-LD without markup.
 * Warnings (no failure): more than one FAQPage node on a page, FAQ items inside a [hidden]
 * subtree (e.g. a streamed Suspense chunk), unparsable JSON-LD blocks.
 * HTML is parsed with the browser's DOMParser in headless Chromium (scripts never run).
 *
 * Usage:  node faq-sync.cjs <baseUrl> [--ua=<user agent>] [--json=<file>] [--all]
 *         node faq-sync.cjs --html <file.html> [--html <file2.html> ...]   (offline: check saved HTML)
 *   --all   also list pages without any FAQ in the table
 * Exit: 0 all in sync, 1 any mismatch / missing side / fetch error, 2 usage or sitemap unreachable.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const EXE = "/home/raish/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell";
const CONCURRENCY = 4;

// ------------------------------------------------------------------ in-page parser
/** Runs in the browser: DOMParser never executes scripts or loads resources. */
function parseFaq(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  const stripHtml = (s) => {
    s = String(s == null ? "" : s);
    if (!/[<&]/.test(s)) return s;
    return new DOMParser().parseFromString(`<!doctype html><body>${s}`, "text/html").body.textContent;
  };
  const textOf = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll('[aria-hidden="true"], script, style, template, noscript').forEach((x) => x.remove());
    return c.textContent;
  };

  // JSON-LD
  const ld = { blocks: 0, faqNodes: 0, ids: [], items: [], errors: [] };
  for (const sc of doc.querySelectorAll('script[type="application/ld+json"]')) {
    ld.blocks++;
    let data;
    try {
      data = JSON.parse(sc.textContent);
    } catch (e) {
      ld.errors.push(`unparsable JSON-LD block #${ld.blocks}: ${String(e.message).slice(0, 120)}`);
      continue;
    }
    const visit = (n) => {
      if (Array.isArray(n)) return n.forEach(visit);
      if (!n || typeof n !== "object") return;
      const t = n["@type"];
      const types = Array.isArray(t) ? t : [t];
      if (types.includes("FAQPage")) {
        ld.faqNodes++;
        ld.ids.push(n["@id"] || null);
        const me = n.mainEntity == null ? [] : Array.isArray(n.mainEntity) ? n.mainEntity : [n.mainEntity];
        for (const q of me) {
          const aa = q && q.acceptedAnswer;
          const a = Array.isArray(aa) ? aa[0] : aa;
          const qs = q && q.name, as = a && a.text;
          // Plain text as written (the site's case), plus a tag-stripped/entity-decoded variant
          // for answers written as HTML (schema.org allows it); compare() prefers the plain one.
          ld.items.push({ q: norm(qs), a: norm(as), qText: norm(stripHtml(qs)), aText: norm(stripHtml(as)), type: (q && q["@type"]) || null });
        }
        return;
      }
      for (const k of Object.keys(n)) if (k !== "@context") visit(n[k]);
    };
    visit(data);
  }

  // Visible markup
  let source = "[data-faq-item]";
  let nodes = [...doc.querySelectorAll("[data-faq-item]")];
  if (!nodes.length) {
    source = "details in FAQ container";
    nodes = [...new Set(doc.querySelectorAll('[data-section="faq"] details, [id*="faq" i] details, .faq details, details.faq'))];
  }
  // Drop a node nested inside another FAQ node (keep the outermost).
  nodes = nodes.filter((n) => !nodes.some((o) => o !== n && o.contains(n)));
  const dom = nodes.map((d) => {
    const sum = d.querySelector(":scope > summary") || d.querySelector("summary");
    const qEl = sum ? sum.querySelector("h2, h3, h4, [data-faq-q]") || sum : d.querySelector("[data-faq-q], h2, h3, h4");
    let a = "";
    if (d.tagName === "DETAILS") {
      const c = d.cloneNode(true);
      const s = c.querySelector(":scope > summary");
      if (s) s.remove();
      a = textOf(c);
    } else {
      const aEl = d.querySelector("[data-faq-a], .faq-a");
      a = aEl ? textOf(aEl) : "";
    }
    const hiddenBy = d.closest("[hidden]");
    return {
      q: norm(qEl ? textOf(qEl) : ""),
      a: norm(a),
      id: d.getAttribute("data-focus-id"),
      hidden: hiddenBy ? `inside [hidden]${hiddenBy.id ? ` #${hiddenBy.id}` : ""}` : null,
    };
  });
  return { title: norm(doc.title), ld, dom, source, detailsTotal: doc.querySelectorAll("details").length };
}

// ------------------------------------------------------------------ compare
const short = (s, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
function diffAt(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 25);
  const cut = (s) => `${from > 0 ? "…" : ""}${s.slice(from, i + 35)}${s.length > i + 35 ? "…" : ""}`;
  return `at char ${i}: JSON-LD "${cut(a)}" | markup "${cut(b)}"`;
}

function compare(r) {
  const fails = [], warns = [...r.ld.errors];
  const L = r.ld.items, D = r.dom;
  if (r.ld.faqNodes > 1) warns.push(`${r.ld.faqNodes} FAQPage nodes on one page (${r.ld.ids.map((x) => x || "no @id").join(", ")}); compared concatenated`);
  for (const [i, d] of D.entries()) if (d.hidden) warns.push(`markup #${i + 1} "${short(d.q, 40)}" is ${d.hidden} in the raw HTML`);
  let status;
  if (!r.ld.faqNodes && !D.length) status = "NONE";
  else if (r.ld.faqNodes && !D.length) {
    status = "LD-ONLY";
    fails.push(`FAQPage JSON-LD (${L.length} questions) but no visible FAQ markup`);
  } else if (!r.ld.faqNodes && D.length) {
    status = "MARKUP-ONLY";
    fails.push(`${D.length} FAQ items in the markup (${r.source}) but no FAQPage JSON-LD`);
  } else {
    if (L.length !== D.length) fails.push(`count differs: JSON-LD ${L.length}, markup ${D.length}`);
    for (let i = 0; i < Math.max(L.length, D.length); i++) {
      const l = L[i], d = D[i];
      if (!l) { fails.push(`#${i + 1} only in markup: "${short(d.q)}"`); continue; }
      if (!d) { fails.push(`#${i + 1} only in JSON-LD: "${short(l.q)}"`); continue; }
      if (!l.q || !l.a) fails.push(`#${i + 1} JSON-LD has an empty ${!l.q ? "question" : "answer"}`);
      if (!d.q || !d.a) fails.push(`#${i + 1} markup has an empty ${!d.q ? "question" : "answer"}`);
      if (l.type && l.type !== "Question") warns.push(`#${i + 1} JSON-LD mainEntity @type is ${JSON.stringify(l.type)}, not "Question"`);
      const qOk = l.q === d.q || l.qText === d.q, aOk = l.a === d.a || l.aText === d.a;
      if (qOk && l.q !== d.q) warns.push(`#${i + 1} JSON-LD question is HTML/entity-encoded; matches the markup once stripped`);
      if (aOk && l.a !== d.a) warns.push(`#${i + 1} JSON-LD answer is HTML/entity-encoded; matches the markup once stripped`);
      if (!qOk) fails.push(`#${i + 1} question differs ${diffAt(l.q, d.q)}`);
      else if (!aOk) fails.push(`#${i + 1} answer differs (Q "${short(d.q, 50)}") ${diffAt(l.a, d.a)}`);
    }
    if (fails.length && L.length === D.length) {
      const key = (x) => `${x.q}\u0000${x.a}`;
      const a = L.map(key).sort().join("\u0001"), b = D.map(key).sort().join("\u0001");
      if (a === b) fails.unshift("same questions and answers, different ORDER");
    }
    status = fails.length ? "MISMATCH" : "OK";
  }
  return { status, fails, warns };
}

// ------------------------------------------------------------------ fetch
async function get(url, ua) {
  const headers = ua ? { "user-agent": ua } : {};
  const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(45000) });
  const body = await res.text();
  return { status: res.status, type: res.headers.get("content-type") || "", body, finalUrl: res.url };
}

const decodeXml = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
async function sitemapUrls(base, ua, url = `${base}/sitemap.xml`, depth = 0) {
  const r = await get(url, ua);
  if (r.status !== 200) throw new Error(`${url} -> HTTP ${r.status}`);
  const locs = [...r.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => decodeXml(m[1]));
  const rewrite = (loc) => {
    try { const u = new URL(loc); return base + u.pathname + u.search; } catch { return base + (loc.startsWith("/") ? loc : `/${loc}`); }
  };
  if (/<sitemapindex[\s>]/.test(r.body) && depth < 2) {
    const out = [];
    for (const loc of locs) out.push(...(await sitemapUrls(base, ua, rewrite(loc), depth + 1)));
    return out;
  }
  return locs.map(rewrite);
}

async function pool(items, n, fn) {
  const q = items.map((x, i) => [x, i]);
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => {
    while (q.length) { const [x, i] = q.shift(); out[i] = await fn(x); }
  }));
  return out;
}

// ------------------------------------------------------------------ main
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }

async function main() {
  const argv = process.argv.slice(2);
  const opt = (name) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
  const htmlFiles = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--html" && argv[i + 1]) htmlFiles.push(argv[++i]);
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--html");
  const ua = opt("ua");
  const jsonOut = opt("json");
  const showAll = argv.includes("--all");
  if (!positional[0] && !htmlFiles.length) {
    console.error("Usage: node faq-sync.cjs <baseUrl> [--ua=<user agent>] [--json=<file>] [--all]\n       node faq-sync.cjs --html <file.html> [--html <file2.html> ...]");
    return 2;
  }

  let targets;
  const base = positional[0] ? positional[0].replace(/\/+$/, "") : null;
  if (htmlFiles.length) {
    targets = htmlFiles.map((f) => ({ label: path.basename(f), file: path.resolve(f) }));
  } else {
    try {
      const urls = [...new Set(await sitemapUrls(base, ua))];
      targets = urls.map((u) => ({ label: u.slice(base.length) || "/", url: u }));
    } catch (e) {
      console.error(`Sitemap not reachable: ${e.message}`);
      return 2;
    }
    if (!targets.length) { console.error("Sitemap has no <loc> entries"); return 2; }
  }

  const fetched = await pool(targets, CONCURRENCY, async (t) => {
    if (t.file) return { ...t, status: "file", body: fs.readFileSync(t.file, "utf8"), type: "text/html" };
    try {
      const r = await get(t.url, ua);
      return { ...t, status: r.status, body: r.body, type: r.type };
    } catch (e) {
      return { ...t, status: "ERR", error: String(e.message || e).slice(0, 160) };
    }
  });

  const browser = await chromium.launch({ executablePath: EXE });
  const rows = [];
  try {
    const ctx = await browser.newContext({ javaScriptEnabled: true });
    const page = await ctx.newPage();
    for (const f of fetched) {
      if (f.status !== "file" && f.status !== 200) {
        rows.push({ page: f.label, http: f.status, ld: "-", dom: "-", status: "FETCH-ERR", fails: [f.error || `HTTP ${f.status}`], warns: [] });
        continue;
      }
      if (!/html/i.test(f.type)) {
        rows.push({ page: f.label, http: f.status, ld: "-", dom: "-", status: "SKIP", fails: [], warns: [`not HTML (${f.type})`] });
        continue;
      }
      let r;
      try {
        r = await page.evaluate(parseFaq, f.body);
      } catch (e) {
        rows.push({ page: f.label, http: f.status, ld: "-", dom: "-", status: "PARSE-ERR", fails: [String(e.message || e).split("\n")[0]], warns: [] });
        continue;
      }
      const c = compare(r);
      rows.push({
        page: f.label, http: f.status, ld: r.ld.faqNodes ? r.ld.items.length : "-", dom: r.dom.length || "-", source: r.dom.length ? r.source : null,
        status: c.status, fails: c.fails, warns: c.warns, ldItems: r.ld.items, domItems: r.dom,
      });
    }
  } finally {
    await browser.close();
  }

  // Table
  const failing = (r) => !["OK", "NONE", "SKIP"].includes(r.status);
  const shown = rows.filter((r) => showAll || r.status !== "NONE");
  const w = Math.min(60, Math.max(4, ...shown.map((r) => String(r.page).length)));
  const line = (a, b, c, d, e, f) => `${pad(a, w)}  ${pad(b, 4)}  ${pad(c, 6)}  ${pad(d, 6)}  ${pad(e, 11)}  ${f}`;
  console.log(`faq-sync ${base || "(files)"}${ua ? ` ua="${ua}"` : ""}: ${rows.length} pages, ${rows.filter((r) => r.status !== "NONE" && r.status !== "SKIP" && r.status !== "FETCH-ERR").length} with FAQ`);
  console.log(line("page", "http", "LD Qs", "DOM Qs", "result", "notes"));
  console.log(line("-".repeat(w), "----", "------", "------", "-----------", "-----"));
  for (const r of shown) {
    const notes = [...r.fails, ...r.warns.map((x) => `warn: ${x}`)];
    console.log(line(String(r.page).slice(0, w), r.http, r.ld, r.dom, r.status, notes[0] || (r.source ? `markup: ${r.source}` : "")));
    for (const n of notes.slice(1)) console.log(line("", "", "", "", "", n));
  }
  const none = rows.filter((r) => r.status === "NONE").length;
  if (!showAll && none) console.log(`(${none} pages without any FAQ not listed; --all lists them)`);
  const bad = rows.filter(failing);
  console.log(bad.length ? `FAIL: ${bad.length} page(s) out of sync: ${bad.map((r) => r.page).join(", ")}` : "PASS: every FAQPage block matches its visible FAQ 1:1");

  if (jsonOut) fs.writeFileSync(path.resolve(jsonOut), JSON.stringify({ base, ua, at: new Date().toISOString(), rows }, null, 2));
  return bad.length ? 1 : 0;
}

if (require.main === module) {
  main().then((code) => process.exit(code), (e) => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
}
module.exports = { parseFaq, compare };
