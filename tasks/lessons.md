# Lessons

- Never `pkill -f "<pattern>"` when the pattern also appears in the running shell's own command line — it kills the shell, not the target. Kill servers by port PID (`lsof -ti tcp:<port>`), then confirm the port is free before starting a new server.
- After restarting a server for a comparison, confirm the NEW process is the one listening (check its log for "Ready" and that asset URLs return 200) before trusting any metric. A suspicious jump (perf 55 -> 100) means verify, not celebrate.
- Don't benchmark (Lighthouse/CWV) while background browser jobs are running; check `uptime` load first and A/B both builds back-to-back on an idle machine.
- In chrome-headless-shell, `--use-gl=swiftshader` DISABLES WebGL instead of enabling it (caught by the scout). For screenshotting 3D pages use the default GL or `--use-angle=swiftshader --enable-unsafe-swiftshader`, and assert `getContext('webgl2')` succeeds before trusting a blank capture.
- `lsof -ti tcp:<port>` can miss processes started by other agents/sandboxes; fall back to `ss -ltnp | grep :<port>` for the PID before assuming a port is free.
- tsconfig alias `@/*` maps to `app/*` only — `@/components/...` does NOT resolve. Import components by relative path (or add an alias deliberately, repo-wide).
- /tmp (scratchpad) is wiped on reboot. Anything a later phase depends on (rulebooks, checkers, specs) must live in the repo (tasks/), and every agent's work must be committed to a branch before the session can end. Commits in git worktrees survive because they live in the main repo's .git.
- Test capability gates on the OWNER's real hardware before calling a feature done. If verifiers must spoof navigator.hardwareConcurrency to see a feature, the gate is too strict for real users (a 4-thread laptop lost the whole 3D experience). Gate only genuinely weak devices and rely on a runtime frame monitor.
- Respect prefers-reduced-motion by default, but give visitors an explicit opt-in that overrides it, and make toggles show the EFFECTIVE state (a toggle that looks "on" while nothing animates reads as broken).
