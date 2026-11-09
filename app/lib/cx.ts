// Class-name joiner for client components: plain clsx, no tailwind-merge. Client
// islands never pass conflicting utilities, and tailwind-merge (about 9 KB gzip plus
// its first-call setup) would ship on every route. Server code keeps `cn` from ./utils.
export { clsx as cx } from "clsx";
