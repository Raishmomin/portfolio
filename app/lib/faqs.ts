import type { FAQ } from "./seo";

export const FAQS: Record<string, FAQ[]> = {
  "/about": [
    {
      q: "How many years of experience do you have?",
      a: "4+ years shipping production full-stack applications. Stack defaults are Next.js 14, Node.js 20 LTS, TypeScript (strict), MongoDB or PostgreSQL, and AWS (ECS, Lambda, RDS, S3).",
    },
    {
      q: "What stack do you specialize in?",
      a: "Next.js + React + TypeScript on the frontend, Node.js (Express/Fastify) on the API, MongoDB or PostgreSQL for data, and AWS for infra. For DevOps I work in Terraform, Docker, ECS/EKS, and GitHub Actions.",
    },
    {
      q: "Are you available for full-time work or only freelance?",
      a: "Primarily freelance. I take 1–2 active clients at a time, usually on weekly retainers or fixed-price MVP builds. Open to senior contract-to-hire arrangements for the right fit.",
    },
    {
      q: "What time zone do you work in?",
      a: "Remote-first. I overlap 4+ hours with US Eastern and full working days with EU, MENA, and APAC. Async-first by default — sync only when blocked.",
    },
    {
      q: "What do you charge?",
      a: "Weekly retainers from $2,500/week ($3,000/week for DevOps engagements). Fixed-price MVPs from $8,000. Every engagement starts with a written SOW — no surprises on the invoice.",
    },
    {
      q: "Do you sign NDAs?",
      a: "Yes — mutual NDAs are standard. I can sign yours or provide a template. I also work under existing master services agreements when clients have them.",
    },
    {
      q: "What contract types do you accept?",
      a: "Fixed-price per-milestone for greenfield MVPs, weekly retainers for ongoing platform work, paid 1-week audits for codebase reviews before larger engagements. All scoped in writing first.",
    },
    {
      q: "How do you handle payment?",
      a: "USD or EUR, via wire or Stripe Invoicing. 50% upfront for fixed-price work; net-7 weekly for retainers. International clients only — no 1099 / W-2 / India-PAN arrangements.",
    },
  ],

  "/contact": [
    {
      q: "How quickly will you respond?",
      a: "Within one business day for new inquiries — usually faster. Existing clients get same-day responses during overlap hours.",
    },
    {
      q: "What's the smallest project you'll take?",
      a: "A focused 1-week audit ($2,500). I don't take sub-week ad-hoc tasks — context-switching costs too much for both sides.",
    },
    {
      q: "What's the largest project you'll take?",
      a: "Solo engagements up to 6 months. Beyond that I'll bring in trusted collaborators; we scope the team and SOW together.",
    },
    {
      q: "Can you start this week?",
      a: "Sometimes. I keep a 2–4 week pipeline. If your timeline is rigid, mention it in the first message — I'll be honest about fit.",
    },
    {
      q: "Do you work with agencies or only direct clients?",
      a: "Both. Agency subcontracts welcomed with clear scope and white-label terms. I prefer direct relationships for retainer work.",
    },
  ],
};
