#!/usr/bin/env python3
"""SEO/GEO regression checker for the raish-momin portfolio redesign (stdlib only).

Usage:
  # live server (local `next start` or a preview URL)
  python3 -I seo_check.py --base http://localhost:3000 --paths baseline/paths.txt [--ua GPTBot]
  # saved HTML files (e.g. the baseline snapshot)
  python3 -I seo_check.py --dir baseline/html

Exit code 1 if any HARD failure. Prints one line per page plus a summary.
HARD rules: status 200, exactly one <h1>, <title> present and inside <head>,
meta description present, self-referencing absolute canonical, og:image present,
every JSON-LD block parses, no raw '</script' / '<' inside JSON-LD payloads,
Person + WebSite JSON-LD present, BreadcrumbList on every non-home page.
SOFT warnings: title > 70 chars, description outside 70-170, visible words < MIN_WORDS[page],
elements with inline opacity:0 (hidden until hydration), heading level skips.
"""
import argparse, glob, html, json, os, re, sys, urllib.request

SITE = "https://raish-momin.vercel.app"
UAS = {
    "default": "Mozilla/5.0 (seo-check)",
    "Googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "GPTBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)",
    "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
    "ClaudeBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "PerplexityBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "Bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
}
# Minimum visible words (SSR, JS off). Baseline: home 275, about 420, projects 88, skills 73, experience 64.
MIN_WORDS = {"/": 600, "/about": 500, "/projects": 300, "/skills": 150, "/experience": 200,
             "/services": 200, "/contact": 200, "/blog": 500}
NON_HTML = (".xml", ".txt", ".webmanifest", "opengraph-image", "google797364b8fd6f1221.html")


def visible_text(s):
    s = re.sub(r"<script[\s\S]*?</script>", " ", s)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return html.unescape(re.sub(r"\s+", " ", s)).strip()


def check(path, status, s):
    hard, soft = [], []
    if status != 200:
        hard.append(f"status {status}")
        return hard, soft, {}
    head_end = s.find("</head>")
    head = s[:head_end] if head_end > 0 else ""
    t = re.search(r"<title[^>]*>(.*?)</title>", s, re.S)
    if not t:
        hard.append("no <title>")
    elif head_end > 0 and t.start() > head_end:
        hard.append("<title> streamed outside <head>")
    title = html.unescape(t.group(1)) if t else ""
    d = re.search(r'<meta name="description" content="([^"]*)"', head)
    if not d:
        hard.append("no meta description in <head>")
    c = re.search(r'<link rel="canonical" href="([^"]*)"', head)
    expected = SITE + (path if path != "/" else "/")
    if not c:
        hard.append("no canonical")
    elif c.group(1).rstrip("/") != expected.rstrip("/"):
        hard.append(f"canonical {c.group(1)} != {expected}")
    if not re.search(r'<meta property="og:image" content="[^"]+"', head):
        hard.append("no og:image")
    h1 = len(re.findall(r"<h1[\s>]", s))
    if h1 != 1:
        hard.append(f"h1 count {h1}")
    types = []
    for m in re.finditer(r'<script type="application/ld\+json"[^>]*>([\s\S]*?)</script>', s):
        raw = m.group(1)
        if "<" in raw:
            hard.append("raw '<' inside JSON-LD (escape as \\u003c)")
        try:
            j = json.loads(raw)
        except Exception as e:
            hard.append(f"invalid JSON-LD: {e}")
            continue
        for x in (j if isinstance(j, list) else [j]):
            graph = x.get("@graph", [x]) if isinstance(x, dict) else []
            for g in graph:
                tt = g.get("@type") if isinstance(g, dict) else None
                types += tt if isinstance(tt, list) else [tt]
    for need in ("Person", "WebSite"):
        if need not in types:
            hard.append(f"JSON-LD missing {need}")
    if path != "/" and "BreadcrumbList" not in types:
        hard.append("JSON-LD missing BreadcrumbList")
    if path == "/" and "ProfilePage" not in types:
        hard.append("JSON-LD missing ProfilePage on home")
    words = len(visible_text(s).split())
    if len(title) > 70:
        soft.append(f"title {len(title)} chars")
    if d and not (70 <= len(d.group(1)) <= 170):
        soft.append(f"description {len(d.group(1))} chars")
    if words < MIN_WORDS.get(path, 300 if path.startswith("/blog/") else 150):
        soft.append(f"only {words} visible words")
    hidden = len(re.findall(r'style="[^"]*opacity:\s*0[;"]', s))
    if hidden:
        soft.append(f"{hidden} elements SSR'd with opacity:0")
    levels = [int(x) for x in re.findall(r"<h([1-6])[\s>]", s)]
    if any(b - a > 1 for a, b in zip(levels, levels[1:])):
        soft.append("heading level skip")
    return hard, soft, {"title": title, "words": words, "types": types}


def fetch(url, ua):
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base")
    ap.add_argument("--paths")
    ap.add_argument("--dir")
    ap.add_argument("--ua", default="default", choices=list(UAS))
    a = ap.parse_args()
    pages = []
    if a.dir:
        for f in sorted(glob.glob(os.path.join(a.dir, "*.html"))):
            name = os.path.basename(f)[:-5]
            path = "/" if name == "index" else "/" + name.replace("_", "/", 1)
            pages.append((path, 200, open(f, encoding="utf-8", errors="ignore").read()))
    else:
        for p in open(a.paths).read().split():
            st, body = fetch(a.base.rstrip("/") + p, UAS[a.ua])
            pages.append((p, st, body))
    fails = 0
    for path, st, body in pages:
        if path.endswith(NON_HTML) or any(path.endswith(n) for n in NON_HTML):
            ok = st == 200
            fails += not ok
            print(f"{'OK ' if ok else 'FAIL'} {path} status={st}")
            continue
        hard, soft, info = check(path, st, body)
        fails += bool(hard)
        print(f"{'FAIL' if hard else 'OK  '} {path[:90]} words={info.get('words')} "
              f"{'HARD: ' + '; '.join(hard) if hard else ''} {'WARN: ' + '; '.join(soft) if soft else ''}")
    print(f"\n{len(pages)} checked, {fails} with hard failures")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
