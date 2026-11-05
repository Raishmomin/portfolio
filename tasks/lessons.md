# Lessons

- Never `pkill -f "<pattern>"` when the pattern also appears in the running shell's own command line — it kills the shell, not the target. Kill servers by port PID (`lsof -ti tcp:<port>`), then confirm the port is free before starting a new server.
- After restarting a server for a comparison, confirm the NEW process is the one listening (check its log for "Ready" and that asset URLs return 200) before trusting any metric. A suspicious jump (perf 55 -> 100) means verify, not celebrate.
- Don't benchmark (Lighthouse/CWV) while background browser jobs are running; check `uptime` load first and A/B both builds back-to-back on an idle machine.
- In chrome-headless-shell, `--use-gl=swiftshader` DISABLES WebGL instead of enabling it (caught by the scout). For screenshotting 3D pages use the default GL or `--use-angle=swiftshader --enable-unsafe-swiftshader`, and assert `getContext('webgl2')` succeeds before trusting a blank capture.
