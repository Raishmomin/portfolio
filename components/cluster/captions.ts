// Caption-bar text per formation. Pure and tiny: the client island imports it,
// so it must not pull in formations.ts or three. Decorative (rendered aria-hidden).
import { heroPods } from "./config";
import type { FormationData, FormationKey } from "./types";

export function captionFor(key: FormationKey, data: FormationData, count: number): string {
  switch (key) {
    case "about":
      return "kubectl get nodes · 3 Ready";
    case "stack": {
      const skills = data.skills.reduce((n, s) => n + s.count, 0);
      return `kubectl get pods -l stack · ${skills} skills`;
    }
    case "experience":
      return `kubectl rollout history · ${data.experience.length} revisions`;
    case "work":
      return `kubectl get deploy · ${data.projects.length} projects`;
    case "contact":
      return "kubectl port-forward svc/contact";
    default: {
      const pods = heroPods(count);
      return `kubectl get pods -A · ${pods}/${pods} Running`;
    }
  }
}
