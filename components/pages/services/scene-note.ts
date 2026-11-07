// What the services scene shows on each service page, in plain words (the 3D caption).
// Keyed by slug; a service without an entry gets the generic line.
const NOTES: Record<string, string> = {
  "nextjs-development":
    "On the right, an App Router route tree streams server components into a page, block by block.",
  "mern-stack-development":
    "On the right, React, Express, Node.js and MongoDB pass data round one loop, with a live Socket.IO channel.",
  "devops-aws-consulting":
    "On the right, a CI/CD loop builds containers and ships them to a Kubernetes cluster on AWS.",
  "api-backend-development":
    "On the right, an API gateway checks auth and rate limits; the backend answers, queues jobs and traces each call.",
};

export const serviceSceneNote = (slug: string) =>
  NOTES[slug] ?? "On the right, this engagement runs in 3D as the system it delivers, built from its real stack.";
