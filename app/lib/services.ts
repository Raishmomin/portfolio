import type { FAQ } from "./seo";

export type ServiceSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type ServiceConfig = {
  slug: string;
  h1: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  serviceType: string;
  hero: { problem: string; solution: string };
  sections: ServiceSection[];
  deliverables: string[];
  techStack: string[];
  pricing: { model: string; from: string };
  faqs: FAQ[];
  relatedBlogTags: string[];
  relatedProjectCategories: string[];
  ctaText: string;
};

export const SERVICES: Record<string, ServiceConfig> = {
  "nextjs-development": {
    slug: "nextjs-development",
    h1: "Next.js Development Services",
    tagline: "Production-grade Next.js apps — App Router, Server Components, edge-ready.",
    metaTitle: "Next.js Development Services — Raish Momin",
    metaDescription:
      "Freelance Next.js developer building production App Router apps with Server Components, ISR, edge runtime, and MongoDB/Postgres. 4+ years shipping at scale.",
    keywords: [
      "freelance Next.js developer",
      "hire Next.js developer",
      "Next.js App Router developer",
      "Next.js 14 freelancer",
      "Server Components developer",
      "Next.js SSR consultant",
    ],
    serviceType: "Web Application Development",
    hero: {
      problem:
        "Most Next.js projects ship broken cache, client-side waterfalls, and SEO that ranks for nothing. Migrations from Pages Router stall, ISR is misconfigured, and Core Web Vitals regress on every deploy.",
      solution:
        "I build and rescue Next.js apps end-to-end — App Router architecture, Server Components by default, ISR + tag-based revalidation, edge runtime where it matters, and a measurable Lighthouse 95+ on real hardware.",
    },
    sections: [
      {
        heading: "What I build",
        body:
          "Production Next.js applications that hold up under traffic. From SaaS MVPs to e-commerce storefronts to internal tools — Server Components for SSR, client components only where interactivity demands it, streaming with Suspense, and ISR/SSG wherever cacheable.",
      },
      {
        heading: "How I work",
        body:
          "Small, async, async sprints. I scope tightly in writing before any code, ship to a preview URL every day, and demo end-to-end behavior — never just code reviews. Each PR has a Lighthouse delta and a bundle-size delta so regressions surface before merge.",
        bullets: [
          "Discovery: 30-min call → written scope, fixed deliverables, fixed milestones.",
          "Weekly demos on a Vercel preview URL — no surprises at launch.",
          "GitHub PR-based workflow with squash merges and conventional commits.",
          "Async by default; sync only when blocked.",
        ],
      },
      {
        heading: "When Next.js is the right call (and when it isn't)",
        body:
          "Next.js wins for content-heavy SEO apps, hybrid SSR/SSG sites, dashboards needing fast initial paint, and storefronts where conversion correlates with LCP. It's the wrong tool for pure offline-first apps, heavy real-time collaboration, or anything that needs a thick desktop runtime. I'll tell you up front if your project is in the second bucket.",
      },
      {
        heading: "Performance is the product",
        body:
          "Every Next.js project I ship targets LCP < 2.0s on 4G, INP < 200ms p75, CLS < 0.05. I budget JS per route at 200KB First Load and track it on every PR. Real-user monitoring via Vercel Analytics or self-hosted Plausible. If you can't measure it, you can't ship it.",
      },
      {
        heading: "SEO is built-in, not bolted on",
        body:
          "Every page gets typed metadata, JSON-LD (Article, BreadcrumbList, FAQPage where relevant), a dynamic sitemap that reflects live content, ISR with tag-based revalidation so Google sees fresh pages, and per-page OG images. This site is the proof — it's a Next.js 14 portfolio with full schema coverage.",
      },
    ],
    deliverables: [
      "Architecture spec (Server vs Client component boundaries, data flow, cache strategy)",
      "App Router migration from Pages Router (incremental, with route-by-route preview)",
      "Type-safe data layer (MongoDB, Postgres, or external APIs)",
      "Auth: NextAuth, Clerk, Lucia, or roll-your-own JWT",
      "CMS integration: Sanity, Contentful, Payload, or DB-backed",
      "Lighthouse 95+ on production",
      "CI: GitHub Actions, lint + typecheck + build on every PR",
    ],
    techStack: [
      "Next.js 14 (App Router)",
      "React 18 + Server Components",
      "TypeScript (strict)",
      "Tailwind CSS + shadcn/ui",
      "MongoDB / Postgres / Drizzle / Prisma",
      "Vercel / AWS / Cloudflare Workers",
      "NextAuth / Clerk",
    ],
    pricing: {
      model: "Fixed-price per milestone or weekly retainer.",
      from: "$2,500 / week",
    },
    faqs: [
      {
        q: "Can you migrate our Pages Router app to App Router without downtime?",
        a: "Yes — incrementally. Next.js supports both routers in the same app, so I migrate route-by-route with feature flags and preview URLs. Typical 20-route app takes 3-5 weeks with zero production downtime.",
      },
      {
        q: "Do you use Server Components by default?",
        a: "Yes. Every page starts as a Server Component; I only mark a leaf as 'use client' when it genuinely needs interactivity (form state, event handlers, third-party hooks). This is the single biggest lever for bundle size and TTFB.",
      },
      {
        q: "How do you handle ISR with database-backed content?",
        a: "unstable_cache with tag-based keys, plus a /api/revalidate webhook the CMS or admin tool hits on write. Pages stay static (fast TTFB, low Mongo cost) but turn fresh within seconds of an edit. The same pattern this portfolio uses.",
      },
      {
        q: "Will the site work without JavaScript?",
        a: "Critical paths (content, navigation, forms via Server Actions) work fully without JS. Decorative animations and a few interactive widgets are progressive enhancements. SEO crawlers and accessibility tools see everything.",
      },
      {
        q: "Do you write tests?",
        a: "Yes — Vitest for unit, Playwright for E2E on critical flows (signup, checkout, primary CTA). I don't chase 100% coverage; I chase 'breaking changes are caught before merge.'",
      },
      {
        q: "What's your timezone / availability?",
        a: "I work async-first and overlap 4+ hours with US Eastern and full days with EU/MENA/APAC. Standups optional, demos required. I commit to 1-2 retainers at a time so I'm not context-switching across six clients.",
      },
      {
        q: "Can you take over an existing codebase?",
        a: "Often. I do a paid 1-week audit first (architecture review, perf audit, dependency risk, security pass) and deliver a written go/no-go report. About 80% of audits result in continued work; the other 20% I help find a better fit.",
      },
      {
        q: "Do you offer ongoing maintenance?",
        a: "Yes — monthly retainers for security patches, dependency upgrades, perf monitoring, and ad-hoc features. Sized 10-40 hours/month depending on the codebase.",
      },
    ],
    relatedBlogTags: ["Next.js", "React", "Server Components", "App Router", "ISR"],
    relatedProjectCategories: ["Web App", "SaaS", "Next.js", "Full Stack"],
    ctaText: "Tell me about your Next.js project",
  },

  "mern-stack-development": {
    slug: "mern-stack-development",
    h1: "MERN Stack Development",
    tagline: "End-to-end MERN apps — MongoDB, Express, React, Node — built for production.",
    metaTitle: "MERN Stack Developer for Hire — Raish Momin",
    metaDescription:
      "Freelance MERN stack developer. End-to-end MongoDB + Express + React + Node.js applications: SaaS MVPs, admin tools, real-time apps. 4+ years shipping production.",
    keywords: [
      "hire MERN stack developer",
      "freelance MERN developer",
      "MongoDB Express React Node developer",
      "MERN SaaS developer",
      "full stack JavaScript developer",
    ],
    serviceType: "Full Stack Web Development",
    hero: {
      problem:
        "MERN projects collapse under their own weight: Mongoose schemas that drift from the UI, Express routes that re-implement the same auth check ten ways, React clients that hit five endpoints to render one page. Six months in, every new feature breaks two old ones.",
      solution:
        "I build MERN apps with a single source of truth: typed schemas shared between API and client, one auth middleware, one query layer, and a deployment pipeline that doesn't require a Slack thread to use.",
    },
    sections: [
      {
        heading: "What I build",
        body:
          "SaaS MVPs, internal admin tools, real-time dashboards, multi-tenant B2B apps. MongoDB Atlas for data, Express or Fastify for the API, React (or Next.js) for the client, Node 20 LTS runtime. TypeScript end-to-end — no untyped boundaries.",
      },
      {
        heading: "MongoDB done right",
        body:
          "Most MERN apps misuse MongoDB. I model schemas around access patterns, not relational habits. Compound indexes that match real queries (verified with explain()), aggregation pipelines instead of N+1 in app code, proper use of $lookup only where it pays. I've cut a client's Atlas bill by 60% just by fixing indexes and adding two aggregation stages.",
      },
      {
        heading: "Auth and authorization",
        body:
          "JWT with refresh tokens, httpOnly cookies, RBAC at the middleware layer. No 'is this user an admin?' check sprinkled in 30 endpoints — one policy module, enforced once. SSO via Auth0/Clerk if you have it; built-in if you don't.",
      },
      {
        heading: "Real-time when you need it",
        body:
          "WebSockets via Socket.IO or native ws — for chat, live dashboards, collaborative editing. Server-Sent Events for one-way streams (notifications, AI token streaming). I'll talk you out of real-time when polling would do; latency budgets aren't a personality trait.",
      },
    ],
    deliverables: [
      "Mongo schema design + indexing strategy reviewed with explain()",
      "Typed Express/Fastify API with OpenAPI spec",
      "React client (or Next.js) with React Query / SWR data layer",
      "Auth: JWT + refresh, RBAC, optional SSO",
      "Admin dashboard for non-engineers",
      "Docker Compose for local dev + production Dockerfile",
      "GitHub Actions CI: test + build + deploy preview",
      "Monitoring: Sentry + structured logs",
    ],
    techStack: [
      "MongoDB Atlas",
      "Express.js / Fastify",
      "Node.js 20 LTS",
      "React 18 / Next.js 14",
      "TypeScript (strict)",
      "Mongoose / native driver",
      "Socket.IO",
      "Docker",
    ],
    pricing: {
      model: "Fixed-price per milestone for MVPs; weekly retainer for ongoing work.",
      from: "$8,000 / MVP or $2,500 / week",
    },
    faqs: [
      {
        q: "What's a realistic MERN MVP timeline?",
        a: "A focused MVP (auth + 3-5 core flows + admin) ships in 6-10 weeks. Anything faster is either a templated CRUD app or future technical debt — I'll tell you which up front.",
      },
      {
        q: "MongoDB vs Postgres for a new project?",
        a: "MongoDB wins for: flexible schemas during early product iteration, document-shaped data (orders with line items, posts with embedded comments), and horizontal scale beyond a single Postgres can handle. Postgres wins for: heavy relational queries, strong consistency requirements, mature tooling, and most teams' baseline familiarity. I'm honest about this tradeoff in scoping.",
      },
      {
        q: "Do you use Mongoose or the native driver?",
        a: "Both — Mongoose for projects where the schema-validation + middleware story buys clarity, native driver + Zod when I need raw aggregation performance and don't want ODM overhead. Default to Mongoose unless there's a measured reason not to.",
      },
      {
        q: "Can you replace our offshore dev team's MERN codebase?",
        a: "If 'replace' means rewrite from scratch — usually no, that's almost always the wrong move. I do paid audits and propose targeted refactors: typed boundaries, real tests, fixed deployment, modernized auth. Most 'unmaintainable' MERN codebases need a quarter of cleanup, not a rebuild.",
      },
      {
        q: "Real-time chat — Socket.IO or something else?",
        a: "Socket.IO for most cases (reconnection, rooms, transport fallback). For high-fanout (10k+ concurrent), I'd put a dedicated broker (Redis pub/sub, NATS, or a managed service like Ably) in front. Don't ship raw ws() in production unless you really know why.",
      },
      {
        q: "How do you handle file uploads?",
        a: "S3 (or Cloudflare R2 — cheaper egress) with presigned PUT URLs from the API, never proxying file bytes through Express. CDN-backed delivery, image variants generated on demand via Cloudflare Images or sharp.",
      },
      {
        q: "Do you do payments?",
        a: "Stripe integrations — Checkout for simple cases, Elements + Payment Intents for custom flows, subscriptions with proration, webhooks with idempotency. I don't touch card data directly (PCI scope reduction); everything tokenized.",
      },
      {
        q: "What about React Native?",
        a: "I lean on Expo for mobile; pair it with the same MERN backend. If you're a web-first MVP, ship the web app first and add Expo when you have product-market fit. Premature mobile is the #1 startup time-sink I see.",
      },
    ],
    relatedBlogTags: ["MERN", "MongoDB", "Node.js", "Express", "React"],
    relatedProjectCategories: ["MERN", "Full Stack", "SaaS"],
    ctaText: "Brief me on your MERN project",
  },

  "devops-aws-consulting": {
    slug: "devops-aws-consulting",
    h1: "DevOps & AWS Consulting",
    tagline: "CI/CD, infrastructure-as-code, AWS architecture — without the consultancy markup.",
    metaTitle: "Freelance DevOps & AWS Engineer — Raish Momin",
    metaDescription:
      "Freelance DevOps engineer specializing in AWS, CI/CD, Docker, Kubernetes, Terraform, and observability. Cut deploy times, fix flaky pipelines, lower cloud bills.",
    keywords: [
      "freelance AWS DevOps engineer",
      "hire DevOps engineer",
      "AWS consultant",
      "CI/CD pipeline freelancer",
      "Terraform consultant",
      "Kubernetes freelance",
    ],
    serviceType: "DevOps and Cloud Infrastructure Consulting",
    hero: {
      problem:
        "Deploys take 40 minutes. Half of them fail on cache invalidation. The AWS bill grew 3x year over year and nobody can explain why. Your IaC is half-Terraform, half-manual-clicks, fully out of sync.",
      solution:
        "I rebuild your delivery pipeline so deploys are 3-minute, idempotent, and rollback-safe. Terraform everything that's reproducible. Cut AWS spend by killing zombie resources, right-sizing compute, and moving cold workloads to spot/serverless.",
    },
    sections: [
      {
        heading: "What I fix first",
        body:
          "Three things break the same way at every company: slow deploys, flaky tests blocking merges, and an AWS bill nobody owns. I attack those in week one — pipeline rewrite, test flakiness audit, AWS Cost Explorer deep-dive. Wins compound: faster deploys mean more deploys, mean smaller changes, mean fewer incidents.",
      },
      {
        heading: "Infrastructure-as-code, actually",
        body:
          "Terraform modules with state in S3 + DynamoDB locking. Atlantis or Spacelift for PR-driven plans. Every resource tagged with owner + cost-center. No 'click ops' — if it can't be terraformed, it doesn't exist.",
      },
      {
        heading: "CI/CD that doesn't suck",
        body:
          "GitHub Actions with self-hosted runners (cheaper, faster, more powerful) or GitLab CI for monorepos. Build caching that actually works — Docker layer cache to S3/ECR, dependency cache keyed on lockfile hash, parallel matrix for tests. Deploy via blue/green or canary depending on blast radius.",
      },
      {
        heading: "Observability first",
        body:
          "You can't fix what you can't see. CloudWatch + Grafana for metrics, OpenTelemetry traces to Jaeger or Datadog, structured JSON logs to CloudWatch Logs Insights. Alerts that wake people only for SLO breaches, not noise. Runbooks linked from every alert.",
      },
      {
        heading: "Cost optimization",
        body:
          "Average savings I've shipped: 30-50% off compute through right-sizing + Savings Plans, 40-60% off transit costs by moving to private endpoints + Cloudfront, 70%+ off batch workloads by moving to Spot/Fargate Spot. I share the methodology — no vendor lock-in to me.",
      },
    ],
    deliverables: [
      "AWS account audit (security, cost, IAM) with prioritized fix list",
      "Terraform monorepo with state, modules, CI plans",
      "CI/CD pipeline rewrite (target: < 5min deploy, < 2min PR feedback)",
      "Docker images: multi-stage, distroless or alpine, signed",
      "Kubernetes: EKS cluster with Argo CD or Flux, HPA, NetworkPolicies",
      "Monitoring: Grafana dashboards, alerts, runbooks",
      "Disaster recovery: tested backup + restore procedures",
      "Documentation in /docs as code, not Confluence",
    ],
    techStack: [
      "AWS (EC2, ECS, EKS, Lambda, RDS, S3, CloudFront)",
      "Terraform / OpenTofu",
      "Docker + Buildkit",
      "Kubernetes / EKS / Helm",
      "GitHub Actions / GitLab CI",
      "Argo CD / Flux",
      "Grafana / Prometheus / OpenTelemetry",
      "Cloudflare (DNS, WAF, R2)",
    ],
    pricing: {
      model: "Project-based for migrations/audits; weekly retainer for ongoing platform work.",
      from: "$3,000 / week",
    },
    faqs: [
      {
        q: "Do I need Kubernetes?",
        a: "Probably not. ECS Fargate covers 90% of production workloads with a tenth of the operational overhead. K8s is the right call only when you have specific needs: GPU scheduling, multi-cluster mesh, complex network policies, or you already have a platform team that wants it. I'll talk you out of K8s when ECS is enough.",
      },
      {
        q: "Can you cut our AWS bill without breaking things?",
        a: "Almost always yes — 20-40% in the first month is typical. The big wins are unused resources, oversized instances, no Savings Plans coverage, NAT gateway data transfer, and cross-AZ traffic. I do a free 30-min cost review before any engagement.",
      },
      {
        q: "Terraform vs Pulumi vs CDK?",
        a: "Terraform for most teams (largest community, biggest module ecosystem, language-agnostic). CDK if your team is 100% TypeScript/Python and wants the abstraction. Pulumi if you're already invested. The choice matters less than 'use one of them consistently.'",
      },
      {
        q: "Self-hosted GitHub Actions runners — worth it?",
        a: "Yes if your CI minutes bill is > $500/month or builds are slow. ARM Graviton runners on Spot instances run CI at ~20% of GitHub-hosted cost and 30-50% faster for most workloads. Caveat: you own the security patching now.",
      },
      {
        q: "What's a realistic deploy time?",
        a: "Backend: < 5 minutes from merge to production. Frontend: < 3 minutes. Anything slower means caching is broken, builds aren't parallel, or tests are bloated. I haven't seen a codebase yet where this isn't achievable.",
      },
      {
        q: "Do you handle SOC 2 / compliance work?",
        a: "I'll get you to audit-ready on the technical controls (encryption, logging, access review, change management) and document them in code. I don't draft policies — for that, pair me with a Vanta/Drata implementation team.",
      },
      {
        q: "How do you handle secrets?",
        a: "AWS Secrets Manager or Parameter Store, sourced at runtime via IAM (no secrets in env vars in code). For local dev, 1Password or doppler. Secrets never live in .env files in git, period.",
      },
    ],
    relatedBlogTags: ["DevOps", "AWS", "Terraform", "Kubernetes", "CI/CD", "Docker"],
    relatedProjectCategories: ["DevOps", "Infrastructure", "Cloud"],
    ctaText: "Schedule a free 30-min AWS cost review",
  },

  "api-backend-development": {
    slug: "api-backend-development",
    h1: "API & Backend Development",
    tagline: "REST and GraphQL APIs built to outlast the team that ships them.",
    metaTitle: "Node.js API Developer for Hire — Raish Momin",
    metaDescription:
      "Freelance backend engineer building production REST and GraphQL APIs in Node.js, TypeScript, and Go. Auth, rate limiting, observability, and zero-downtime migrations.",
    keywords: [
      "Node.js API developer for hire",
      "hire backend developer",
      "freelance API developer",
      "GraphQL developer",
      "REST API consultant",
      "Express developer",
    ],
    serviceType: "API and Backend Engineering",
    hero: {
      problem:
        "Your API was designed when you had 3 endpoints. Now you have 80, half of them are inconsistent, error responses leak stack traces, rate limiting is a TODO, and a single slow query takes down all of it.",
      solution:
        "I design and rebuild APIs that scale with the product: consistent error contracts, OpenAPI specs that match reality, per-route rate limits, query budgets enforced in middleware, and observability that finds the slow endpoint before users do.",
    },
    sections: [
      {
        heading: "What I build",
        body:
          "Production REST APIs (Express, Fastify, Hono), GraphQL APIs (Apollo, Pothos, Yoga), and webhook/event-driven backends. Node.js 20 LTS is my default; I'll write Go when you need low p99 or high concurrency. TypeScript end-to-end, strict mode, no implicit any.",
      },
      {
        heading: "API design that survives growth",
        body:
          "Versioned URLs (/v1, /v2) with explicit deprecation windows. Consistent error envelopes (RFC 9457 problem details). Cursor-based pagination, never offset for large collections. ETags for cacheable GETs. Idempotency keys for POSTs that pay money. These aren't preferences — they're what stops your API from being unmaintainable at year two.",
      },
      {
        heading: "Auth that scales beyond MVP",
        body:
          "JWT with rotation, refresh tokens stored httpOnly, RBAC enforced in one middleware module. OAuth2 + OIDC if you need third-party login. Service-to-service auth via mutual TLS or signed JWTs (not API keys passed around Slack). Audit logs for every privileged action.",
      },
      {
        heading: "Performance: budgets, not vibes",
        body:
          "Every endpoint gets a p95 latency budget written in the spec. CI runs k6 load tests against staging on every PR and fails if budgets regress. Slow-query logs piped to Grafana; N+1 queries fail integration tests, not production.",
      },
      {
        heading: "Background jobs and queues",
        body:
          "BullMQ on Redis for most workloads — retries, exponential backoff, dead-letter queues. AWS SQS/SNS or Cloudflare Queues for higher fanout. Crucially: jobs that are idempotent, observable, and have written SLAs.",
      },
    ],
    deliverables: [
      "API design doc (resources, endpoints, errors, auth, rate limits)",
      "OpenAPI 3.1 spec that matches the implementation (Zod → OpenAPI)",
      "Typed API client generated from the spec",
      "Rate limiting (per-user, per-IP, per-endpoint) via Redis",
      "Request validation (Zod), response validation in dev",
      "Background job queue with retries + DLQ",
      "Structured logs (pino) + traces (OpenTelemetry)",
      "k6 load test suite in CI",
    ],
    techStack: [
      "Node.js 20 LTS",
      "TypeScript (strict)",
      "Express / Fastify / Hono",
      "Apollo Server / Pothos / GraphQL Yoga",
      "Zod (validation) + OpenAPI",
      "BullMQ (Redis) / SQS",
      "PostgreSQL / MongoDB",
      "pino + OpenTelemetry",
    ],
    pricing: {
      model: "Per-milestone for greenfield builds; weekly retainer for ongoing work.",
      from: "$2,500 / week",
    },
    faqs: [
      {
        q: "REST or GraphQL for a new product?",
        a: "REST unless you have a clear reason. REST is simpler to cache, simpler to operate, simpler to document. GraphQL pays off for client-driven aggregations across many resources (mobile apps, dashboards with deep nested data) — and it's nontrivial overhead. Most products ship REST + a few aggregate endpoints and never miss GraphQL.",
      },
      {
        q: "How do you version an API?",
        a: "URL-versioned (/v1, /v2). Each version supported for a published window (often 12 months). New versions accept old version payloads where possible. Breaking changes go in a major version bump, never quietly into v1. Clients consume the OpenAPI spec.",
      },
      {
        q: "What's a sensible rate-limit strategy?",
        a: "Tiered: per-IP rate limit on auth endpoints (login, signup), per-user limits on authenticated endpoints, per-API-key limits for partner endpoints. Sliding window in Redis. Return 429 with Retry-After header. Don't rate-limit by IP for authenticated users behind corporate NAT — you'll block whole companies.",
      },
      {
        q: "Webhooks — what do most teams get wrong?",
        a: "Three things: no signature verification (anyone can spoof), no idempotency (replays double-charge customers), no retries (one transient failure and the event is lost). I ship webhooks with HMAC signatures, idempotency keys, exponential-backoff retries, and dead-letter queues with replay tooling.",
      },
      {
        q: "Can you integrate with a payment processor?",
        a: "Yes — Stripe, Paddle, Razorpay. Webhooks with signature verification, idempotent handling, reconciliation jobs that compare API state vs. our DB nightly. PCI scope minimized: card data never touches our infra.",
      },
      {
        q: "What's your testing approach?",
        a: "Integration tests against a real Postgres/Mongo (testcontainers), not mocks. ~80% coverage on routes, 100% on payment/auth code paths. Contract tests against the OpenAPI spec so the implementation can't drift. Load tests in CI on critical endpoints.",
      },
      {
        q: "Do you write Go?",
        a: "Yes — when latency or concurrency demands it (high-throughput webhooks, real-time game backends, CPU-bound work). Default to Node + TypeScript unless we have a measured reason. Polyglot for the sake of polyglot is technical debt.",
      },
    ],
    relatedBlogTags: ["Node.js", "API", "Express", "Backend", "GraphQL", "REST"],
    relatedProjectCategories: ["Backend", "API", "Full Stack"],
    ctaText: "Walk me through your API needs",
  },
};

export const SERVICE_SLUGS = Object.keys(SERVICES);
