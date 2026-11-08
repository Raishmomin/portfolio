// What the services scene shows on each service page, in plain words (the 3D caption).
// No direction words: the machine sits beside the headline on desktop and above it on
// phones. Keyed by slug; a service without an entry gets the generic line.
const NOTES: Record<string, string> = {
  "nextjs-development": "In 3D: an App Router route tree streams server components into a page, block by block.",
  "mern-stack-development": "In 3D: React, Express, Node.js and MongoDB pass data round one loop, with a live Socket.IO channel.",
  "devops-aws-consulting": "In 3D: a CI/CD loop builds containers and ships them to a Kubernetes cluster on AWS.",
  "api-backend-development":
    "In 3D: an API gateway validates and rate-limits each request; the backend answers, queues jobs and traces each call.",
};

export const serviceSceneNote = (slug: string) =>
  NOTES[slug] ?? "In 3D: this engagement runs as the system it delivers, built from its real stack.";

/**
 * Phones: an empty room at the top of the page intro where the services machine runs (the
 * scene frames itself into [data-svc-room]). Not a section of its own: it overlays the
 * intro's top padding (globals, fm3-services), so it is the intro's opening, the stage keeps
 * it clear, and the intro stays the page's first [data-section]. Hidden from 1024px, where
 * the machine sits beside the headline.
 */
export const SERVICE_ROOM = {
  "data-svc-room": "",
  "aria-hidden": true,
  className: "svc-room lg:hidden",
} as const;
