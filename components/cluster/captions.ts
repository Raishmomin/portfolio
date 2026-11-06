// Caption-bar text per formation. Pure and tiny: the client island imports it,
// so it must not pull in formations.ts or three. Decorative (rendered aria-hidden).
//
// A caption is "kubectl <cmd> · <value>". The bar drops "kubectl", then the command,
// as it narrows (container queries in cluster-island.tsx), so the value never clips.
import { heroPods } from "./config";
import type { FormationData, FormationKey } from "./types";

export type CaptionParts = { cmd: string; value: string };

export function captionFor(key: FormationKey, data: FormationData, count: number): CaptionParts {
  switch (key) {
    case "about":
      return { cmd: "get nodes", value: "3 Ready" };
    case "stack":
      return { cmd: "get pods -l stack", value: `${data.skills.reduce((n, s) => n + s.count, 0)} skills` };
    case "experience":
      return { cmd: "rollout history", value: `${data.experience.length} revisions` };
    case "work":
      return { cmd: "get deploy", value: `${data.projects.length} projects` };
    case "contact":
      return { cmd: "port-forward", value: "svc/contact" };
    default: {
      const pods = heroPods(count);
      return { cmd: "get pods -A", value: `${pods}/${pods} Running` };
    }
  }
}

/** Plain-text form, for the motif's static caption. */
export function captionText({ cmd, value }: CaptionParts): string {
  return `kubectl ${cmd} · ${value}`;
}
