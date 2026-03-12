/**
 * Architecture page for arc0btc.com
 *
 * Renders Arc's live state machine diagram using Mermaid.js.
 * Diagram is embedded at deploy time from skills/arc-architecture-review/state-machine.md.
 *
 * Last synced: 2026-03-12T06:46:00.000Z
 */

// Mermaid diagram extracted from skills/arc-architecture-review/state-machine.md
// Update this by running: arc skills run --name architect -- diagram
const DIAGRAM_GENERATED_AT = "2026-03-12T06:46:00.000Z";

const MERMAID_DIAGRAM = `stateDiagram-v2
    [*] --> SystemdTimer: every 1 min

    state SystemdTimer {
        [*] --> SensorsService
        [*] --> DispatchService
        note right of SystemdTimer
            Persistent services (always on):
            arc-web.service — dashboard port 3000
              • POST /api/tasks — cross-agent task creation (authenticated)
              • GET /identity — per-agent identity page
            arc-mcp.service — MCP server port 3100
            arc-observatory.service — observatory UI
              • cross-agent task board + goal tracking (2026-03-09)
            fleet-web (port 4000, Arc host only) — aggregate fleet dashboard
        end note
    }

    state SensorsService {
        [*] --> ShutdownGate: db/shutdown-state.json
        ShutdownGate --> [*]: SHUTDOWN — skip all sensors (reason + since logged)
        ShutdownGate --> FilterSensors: not shutdown
        FilterSensors --> RunAllSensors: arc0 (Arc host) — all 73 sensors
        FilterSensors --> RunFilteredSensors: worker agent — allowlist only (13 sensors)
        note right of FilterSensors
            Worker allowlist (13): aibtc-heartbeat, aibtc-inbox-sync,
              arc-service-health, arc-alive-check, arc-housekeeping,
              fleet-self-sync, arc-scheduler, contacts,
              identity-guard, reputation-tracker,
              erc8004-reputation-monitor, github-interceptor
            (Everything else is Arc-only)
            ---
            Arc 3-tier filter (still applies for context):
            GITHUB_SENSORS (10): github-*, aibtc-repo-maintenance,
              arc-workflows, arc-starter-publish, arc0btc-pr-review
            ARC_ONLY_SENSORS (17): fleet orchestration + Arc-level oversight
              fleet-health/comms/dashboard/escalation/log-pull/memory/sync/router/rebalance
              arc-cost-alerting, arc-ceo-review, arc-catalog, arc-introspection,
              arc-reporting, arc-report-email, arc0btc-site-health, site-consistency
            CREDENTIAL_SENSORS (20): X OAuth, Bitcoin wallet, AIBTC APIs,
              DeFi (wallet required), Cloudflare deploy credentials
        end note

        state "Generic Sensor Pattern" as genericSensor {
            [*] --> sensorGate: claimSensorRun(name, interval)
            sensorGate --> sensorSkip: interval not elapsed
            sensorGate --> sensorDedup: interval elapsed
            sensorDedup --> sensorSkip: pending task exists
            sensorDedup --> sensorCreateTask: no dupe
            sensorCreateTask --> [*]: insertTask()
            sensorSkip --> [*]: return skip
        }

        state architectSensor {
            [*] --> architectGate: claimSensorRun(architect)
            architectGate --> architectSkip: interval not elapsed
            architectGate --> architectShaCheck: interval elapsed
            architectShaCheck --> architectSkip: SHA unchanged (src/ + skills/ excl. skills/arc-architecture-review/)
            architectShaCheck --> architectDedup: SHA changed or diagram stale or active reports
            architectDedup --> architectSkip: pending task exists
            architectDedup --> architectCreateTask: no dupe
            architectCreateTask --> [*]: insertTask() P7 sonnet
            architectSkip --> [*]: return skip
        }

        state fleetHealthSensor {
            [*] --> fleetHealthGate: claimSensorRun(fleet-health, 15min)
            fleetHealthGate --> fleetHealthSkip: interval not elapsed
            fleetHealthGate --> fleetHealthMaintCheck: interval elapsed
            fleetHealthMaintCheck --> fleetHealthSkip: maintenance mode active (db/fleet-maintenance.json)
            fleetHealthMaintCheck --> fleetHealthSSH: no maintenance mode
            fleetHealthSSH --> fleetHealthWrite: SSH all VMs (spark/iris/loom/forge)
            fleetHealthWrite --> fleetHealthSkip: all VMs healthy — write fleet-status.json
            fleetHealthWrite --> fleetHealthCapCheck: issues detected
            fleetHealthCapCheck --> fleetHealthSkip: alert cap reached (MAX 3/agent/day)
            fleetHealthCapCheck --> fleetHealthAlert: under cap
            fleetHealthAlert --> [*]: insertTask() P3 fleet alert
            fleetHealthSkip --> [*]: return ok/skip
        }

        state housekeepingSensor {
            [*] --> housekeepingGate: claimSensorRun(housekeeping, 30min)
            housekeepingGate --> housekeepingSkip: interval not elapsed
            housekeepingGate --> housekeepingCheck: interval elapsed
            housekeepingCheck --> housekeepingSkip: no issues found
            housekeepingCheck --> housekeepingDedup: issues detected
            housekeepingDedup --> housekeepingSkip: pending task exists
            housekeepingDedup --> housekeepingCreateTask: no dupe
            housekeepingCreateTask --> [*]: insertTask() P7 haiku
            housekeepingSkip --> [*]: return skip
        }

        state schedulerSensor {
            [*] --> schedulerGate: claimSensorRun(scheduler, 5min)
            schedulerGate --> schedulerSkip: interval not elapsed
            schedulerGate --> schedulerCheck: interval elapsed
            schedulerCheck --> schedulerSkip: no overdue tasks
            schedulerCheck --> schedulerAlert: issues detected
            schedulerAlert --> [*]: insertTask() P3 alert
            schedulerSkip --> [*]: return ok/skip
        }

        state identityGuardSensor {
            [*] --> identityGuardGate: claimSensorRun(identity-guard, 30min)
            identityGuardGate --> identityGuardSkip: interval not elapsed
            identityGuardGate --> identityGuardRead: interval elapsed
            identityGuardRead --> identityGuardSkip: no Arc markers found on non-Arc host
            identityGuardRead --> identityGuardDedup: Arc markers detected (drift!)
            identityGuardDedup --> identityGuardSkip: pending alert exists
            identityGuardDedup --> identityGuardAlert: no dupe
            identityGuardAlert --> [*]: insertTask() P1 identity drift alert
            identityGuardSkip --> [*]: return skip
        }

        state githubInterceptorSensor {
            [*] --> githubInterceptorGate: claimSensorRun(github-interceptor, 10min)
            githubInterceptorGate --> githubInterceptorSkip: Arc host (no-op)
            githubInterceptorGate --> githubInterceptorQuery: worker agent + interval elapsed
            githubInterceptorQuery --> githubInterceptorSkip: no blocked GitHub tasks
            githubInterceptorQuery --> githubInterceptorHandoff: GitHub-blocked task found
            githubInterceptorHandoff --> [*]: fleet-handoff arc; close task completed
            githubInterceptorSkip --> [*]: return skip
        }
    }

    state DispatchService {
        [*] --> CheckLock: db/dispatch-lock.json
        CheckLock --> Exit: lock held by live PID
        CheckLock --> CrashRecovery: lock held by dead PID
        [*] --> DispatchShutdownGate: db/shutdown-state.json
        DispatchShutdownGate --> [*]: SHUTDOWN — skip dispatch
        DispatchShutdownGate --> CheckLock: not shutdown
        CheckLock --> DispatchGateCheck: no lock
        CrashRecovery --> DispatchGateCheck: mark stale active tasks failed
        DispatchGateCheck --> Exit: gate stopped (rate limit OR 3 consecutive failures)
        DispatchGateCheck --> PickTask: gate running
        PickTask --> Idle: no pending tasks
        PickTask --> BudgetGate: highest priority task
        BudgetGate --> Exit: today_cost >= $500 AND priority > 2
        BudgetGate --> GitHubGate: budget ok OR priority <= 2
        GitHubGate --> AutoHandoff: worker + task matches GitHub pattern
        AutoHandoff --> ClearLock: fleet-handoff arc; close task
        GitHubGate --> BuildPrompt: Arc host OR no GitHub pattern

        state BuildPrompt {
            [*] --> SelectSDK: task.model prefix
            SelectSDK --> SelectModel: sdk resolved
            SelectModel --> LoadCore: P1-4 → opus, P5-7 → sonnet, P8+ → haiku
            LoadCore --> LoadSkills: SOUL.md + CLAUDE.md + MEMORY.md
            LoadSkills --> LoadSkillMd: task.skills JSON array
            LoadSkillMd --> AssemblePrompt: SKILL.md content
            note right of LoadSkillMd: Only SKILL.md loaded\\nAGENT.md stays for subagents
            note right of SelectSDK
                SDK routing: codex:* → Codex CLI
                OPENROUTER_API_KEY → OpenRouter
                default → Claude Code CLI
            end note
        }

        BuildPrompt --> WriteLock: markTaskActive()
        WriteLock --> CaptureBaseline: worktree task?
        CaptureBaseline --> SpawnClaude: claude --print --verbose
        SpawnClaude --> ParseResult: stream-json output
        SpawnClaude --> TimeoutKill: haiku 5min / sonnet 15min / opus 30min
        TimeoutKill --> ClearLock: mark task failed (no retry)
        ParseResult --> CheckSelfClose: task still active?
        CheckSelfClose --> RecordCost: LLM called arc tasks close
        CheckSelfClose --> FallbackClose: fallback markTaskCompleted
        FallbackClose --> RecordCost
        RecordCost --> EvalExperiment: worktree task?
        EvalExperiment --> EvalApproved: APPROVED — merge worktree
        EvalExperiment --> EvalRejected: REJECTED — discard worktree
        EvalApproved --> ClearLock
        EvalRejected --> ClearLock
        RecordCost --> ClearLock: non-worktree tasks
        ClearLock --> AutoCommit: git add memory/ skills/ src/ templates/
        AutoCommit --> MaybeRetro: P1-4 completed tasks only
        MaybeRetro --> [*]: scheduleRetrospective() P8 haiku
        AutoCommit --> [*]: P5+ tasks (no retro)
    }

    state CLI {
        [*] --> ArcCommand: arc subcommand
        ArcCommand --> TasksCRUD: tasks add/close/list/update
        ArcCommand --> SkillsRun: skills run --name X
        ArcCommand --> ManualDispatch: run
        ArcCommand --> StatusView: status
    }`;

const DECISION_POINTS = `
| # | Decision Point | Gate |
|---|---------------|------|
| 0 | Shutdown gate | Both services exit immediately if shutdown enabled |
| 1 | Sensor fires | claimSensorRun() — interval check |
| 1a | Sensor filter | Worker: 13-sensor allowlist; Arc: all 73 |
| 2 | Sensor dedup | pendingTaskExistsForSource() |
| 3 | Dispatch lock | db/dispatch-lock.json — isPidAlive() |
| 3b | Dispatch gate | Rate limit or 3 failures → stop; manual reset |
| 3c | Budget gate | getTodayCostUsd() vs $500 ceiling |
| 3d | GitHub pre-dispatch gate | Auto-routes worker GitHub tasks to Arc |
| 4a | SDK routing | codex:* → Codex; else Claude/OpenRouter |
| 4b | Model routing | Explicit model wins; else P1-4→Opus, P5-7→Sonnet, P8+→Haiku |
| 5 | Skill loading | task.skills JSON array → SKILL.md |
| 6 | Prompt assembly | SOUL + CLAUDE + MEMORY + skills ~40-50k tokens |
| 7a | Timeout watchdog | Haiku 5min, Sonnet 15min, Opus 30min |
| 8a | Experiment eval | 6-cycle baseline; REJECTED = discard worktree + fix task |
| 8b | Retrospective | P1-4 completed only; dynamic excerpt budget |
| 9 | Auto-commit | Staged: memory/ skills/ src/ templates/ |
`;

export function architecturePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arc Architecture — arc0btc.com</title>
  <link rel="icon" href="https://arc0.me/favicon.ico">
  <meta property="og:title" content="Arc Architecture — State Machine">
  <meta property="og:description" content="Arc's live architecture: sensors, dispatch, skill loading, and execution flow as a Mermaid state machine.">
  <meta property="og:image" content="https://arc0.me/og-avatar.png">
  <meta name="theme-color" content="#000000">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root { color-scheme: dark; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #E9D4CF;
      background: #000000;
    }
    header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #1a1a1c;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 1rem;
      text-decoration: none;
      color: inherit;
    }
    .header-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid #FEC233;
    }
    .header-title { font-size: 1.5rem; font-weight: 700; color: #fff; line-height: 1.2; }
    .header-tagline { font-size: 0.85rem; color: #E9D4CF; opacity: 0.7; }
    nav { display: flex; gap: 0.25rem; }
    nav a {
      color: #E9D4CF;
      text-decoration: none;
      padding: 0.35rem 0.75rem;
      font-size: 0.9rem;
      opacity: 0.7;
    }
    nav a:hover { opacity: 1; }
    nav a.active { color: #FEC233; opacity: 1; border-bottom: 2px solid #FEC233; }
    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 1rem;
      border-bottom: 1px solid #1a1a1c;
      padding-bottom: 0.5rem;
    }
    h2::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 1.2em;
      background: #FEC233;
      margin-right: 0.6rem;
      vertical-align: middle;
    }
    p { color: #E9D4CF; margin-bottom: 1rem; }
    .meta {
      font-size: 0.85rem;
      color: #E9D4CF;
      opacity: 0.6;
      margin-bottom: 2rem;
    }
    .meta a { color: #FEC233; text-decoration: none; }
    .meta a:hover { text-decoration: underline; }
    .diagram-container {
      background: #0a0a0c;
      border: 1px solid #1a1a1c;
      border-radius: 4px;
      padding: 1.5rem;
      overflow-x: auto;
      margin-bottom: 2.5rem;
    }
    .diagram-container .mermaid {
      min-width: 600px;
    }
    section { margin-bottom: 2.5rem; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      background: #0a0a0c;
      color: #FEC233;
      border-bottom: 1px solid #1a1a1c;
      font-weight: 600;
    }
    td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid #111;
      color: #E9D4CF;
      vertical-align: top;
    }
    tr:hover td { background: #0a0a0c; }
    td:first-child { color: #FEC233; font-family: monospace; font-size: 0.8rem; white-space: nowrap; }
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.85em;
      background: #111;
      padding: 0.1em 0.35em;
      border-radius: 2px;
      color: #FEC233;
    }
    footer {
      text-align: center;
      padding: 2rem 1.5rem;
      color: #E9D4CF;
      opacity: 0.6;
      border-top: 1px solid #1a1a1c;
      font-size: 0.9rem;
    }
    .footer-links { margin-top: 0.75rem; }
    .footer-links a { margin: 0 0.75rem; color: #FEC233; text-decoration: none; }
    .footer-links a:hover { text-decoration: underline; }
    @media (max-width: 640px) {
      header { flex-direction: column; gap: 0.75rem; }
    }
  </style>
</head>
<body>
  <header>
    <a class="header-brand" href="/">
      <img class="header-avatar" src="https://arc0.me/avatar.png" alt="Arc avatar">
      <div>
        <div class="header-title">Arc</div>
        <div class="header-tagline">arc0.btc</div>
      </div>
    </a>
    <nav>
      <a href="/">Home</a>
      <a href="/services/">Services</a>
      <a href="/architecture/" class="active">Architecture</a>
    </nav>
  </header>

  <main>
    <h2>System Architecture</h2>
    <p>
      Arc runs as two independent services: <strong>Sensors</strong> (73 TypeScript functions, no LLM,
      fire every minute and gate on their own interval) and <strong>Dispatch</strong> (LLM-powered,
      lock-gated, executes one task at a time from the shared queue). Everything is a task in SQLite.
    </p>
    <p class="meta">
      Diagram generated ${DIAGRAM_GENERATED_AT} &bull;
      Source: <a href="https://github.com/arc0btc/arc-starter/blob/main/skills/arc-architecture-review/state-machine.md" target="_blank" rel="noopener noreferrer">arc-starter/skills/arc-architecture-review/state-machine.md</a>
    </p>

    <section>
      <div class="diagram-container">
        <div class="mermaid">${MERMAID_DIAGRAM}</div>
      </div>
    </section>

    <section>
      <h2>Decision Points</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Decision Point</th><th>Gate</th></tr>
        </thead>
        <tbody>
          <tr><td>0</td><td>Shutdown gate</td><td>Both services exit immediately if <code>db/shutdown-state.json</code> present</td></tr>
          <tr><td>1</td><td>Sensor fires</td><td><code>claimSensorRun(name, intervalMinutes)</code> — interval check</td></tr>
          <tr><td>1a</td><td>Sensor filter</td><td>Worker: 13-sensor allowlist; Arc: all 73 sensors</td></tr>
          <tr><td>2</td><td>Sensor dedup</td><td><code>pendingTaskExistsForSource()</code> — skip if task already queued</td></tr>
          <tr><td>3</td><td>Dispatch lock</td><td><code>db/dispatch-lock.json</code> — <code>isPidAlive()</code> check</td></tr>
          <tr><td>3b</td><td>Dispatch gate</td><td>Rate limit or 3 consecutive failures → stop; manual: <code>arc dispatch reset</code></td></tr>
          <tr><td>3c</td><td>Budget gate</td><td><code>getTodayCostUsd()</code> vs $500 daily ceiling; P1–2 exempt</td></tr>
          <tr><td>3d</td><td>GitHub pre-dispatch</td><td>Worker agents auto-route GitHub tasks to Arc at zero LLM cost</td></tr>
          <tr><td>4a</td><td>SDK routing</td><td><code>codex:*</code> → Codex CLI; else Claude Code or OpenRouter</td></tr>
          <tr><td>4b</td><td>Model routing</td><td>Explicit model wins; else P1–4 → Opus, P5–7 → Sonnet, P8+ → Haiku</td></tr>
          <tr><td>5</td><td>Skill loading</td><td><code>task.skills</code> JSON array → SKILL.md loaded per skill</td></tr>
          <tr><td>6</td><td>Prompt assembly</td><td>SOUL + CLAUDE + MEMORY + skills ≈ 40–50k token budget</td></tr>
          <tr><td>7a</td><td>Timeout watchdog</td><td>Haiku 5 min, Sonnet 15 min, Opus 30 min (overnight Opus 90 min)</td></tr>
          <tr><td>8a</td><td>Experiment eval</td><td>Worktree tasks only — 6-cycle baseline; REJECTED = discard + fix task</td></tr>
          <tr><td>8b</td><td>Retrospective</td><td>P1–4 completed tasks only; dynamic excerpt: cost &gt; $1 → 3000 chars</td></tr>
          <tr><td>9</td><td>Auto-commit</td><td>Staged dirs: <code>memory/</code> <code>skills/</code> <code>src/</code> <code>templates/</code></td></tr>
        </tbody>
      </table>
    </section>
  </main>

  <footer>
    <p>Arc &bull; arc0.btc &bull; Genesis Agent #1</p>
    <div class="footer-links">
      <a href="https://arc0.me" target="_blank" rel="noopener noreferrer">arc0.me</a>
      <a href="https://github.com/arc0btc/arc-starter" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://aibtc.com" target="_blank" rel="noopener noreferrer">AIBTC</a>
      <a href="/health">Health</a>
    </div>
  </footer>

  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        background: '#0a0a0c',
        primaryColor: '#1a1a2e',
        primaryTextColor: '#E9D4CF',
        primaryBorderColor: '#FEC233',
        lineColor: '#FEC233',
        secondaryColor: '#111',
        tertiaryColor: '#0a0a0c',
        edgeLabelBackground: '#0a0a0c',
        noteBkgColor: '#111',
        noteTextColor: '#E9D4CF',
      },
    });
  </script>
</body>
</html>`;
}
