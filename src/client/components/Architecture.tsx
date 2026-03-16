import { useEffect, useRef } from "react";

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

        state "Generic Sensor Pattern" as genericSensor {
            [*] --> sensorGate: claimSensorRun(name, interval)
            sensorGate --> sensorSkip: interval not elapsed
            sensorGate --> sensorDedup: interval elapsed
            sensorDedup --> sensorSkip: pending task exists
            sensorDedup --> sensorCreateTask: no dupe
            sensorCreateTask --> [*]: insertTask()
            sensorSkip --> [*]: return skip
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
        }

        BuildPrompt --> WriteLock: markTaskActive()
        WriteLock --> SpawnClaude: claude --print --verbose
        SpawnClaude --> ParseResult: stream-json output
        SpawnClaude --> TimeoutKill: haiku 5min / sonnet 15min / opus 30min
        TimeoutKill --> ClearLock: mark task failed (no retry)
        ParseResult --> RecordCost
        RecordCost --> ClearLock
        ClearLock --> AutoCommit: git add memory/ skills/ src/ templates/
        AutoCommit --> [*]
    }`;

const DECISION_POINTS = [
  { id: "0", point: "Shutdown gate", gate: "Both services exit immediately if db/shutdown-state.json present" },
  { id: "1", point: "Sensor fires", gate: "claimSensorRun(name, intervalMinutes) — interval check" },
  { id: "1a", point: "Sensor filter", gate: "Worker: 13-sensor allowlist; Arc: all 73 sensors" },
  { id: "2", point: "Sensor dedup", gate: "pendingTaskExistsForSource() — skip if task already queued" },
  { id: "3", point: "Dispatch lock", gate: "db/dispatch-lock.json — isPidAlive() check" },
  { id: "3b", point: "Dispatch gate", gate: "Rate limit or 3 consecutive failures → stop; manual: arc dispatch reset" },
  { id: "3c", point: "Budget gate", gate: "getTodayCostUsd() vs $500 daily ceiling; P1-2 exempt" },
  { id: "3d", point: "GitHub pre-dispatch", gate: "Worker agents auto-route GitHub tasks to Arc at zero LLM cost" },
  { id: "4a", point: "SDK routing", gate: "codex:* → Codex CLI; else Claude Code or OpenRouter" },
  { id: "4b", point: "Model routing", gate: "Explicit model wins; else P1-4 → Opus, P5-7 → Sonnet, P8+ → Haiku" },
  { id: "5", point: "Skill loading", gate: "task.skills JSON array → SKILL.md loaded per skill" },
  { id: "6", point: "Prompt assembly", gate: "SOUL + CLAUDE + MEMORY + skills \u2248 40-50k token budget" },
  { id: "7a", point: "Timeout watchdog", gate: "Haiku 5 min, Sonnet 15 min, Opus 30 min (overnight Opus 90 min)" },
  { id: "8a", point: "Experiment eval", gate: "Worktree tasks only — 6-cycle baseline; REJECTED = discard + fix task" },
  { id: "8b", point: "Retrospective", gate: "P1-4 completed tasks only; dynamic excerpt: cost > $1 → 3000 chars" },
  { id: "9", point: "Auto-commit", gate: "Staged dirs: memory/ skills/ src/ templates/" },
];

export function Architecture() {
  const diagramRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (rendered.current) return;
    rendered.current = true;

    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
      mermaid.initialize({
        startOnLoad: false,
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
      const el = document.getElementById('mermaid-diagram');
      if (el) {
        const { svg } = await mermaid.render('mermaid-svg', el.dataset.diagram);
        el.innerHTML = svg;
      }
    `;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      <section>
        <h2 className="section-title">System Architecture</h2>
        <p>
          Arc runs as two independent services: <strong>Sensors</strong> (73 TypeScript functions, no LLM,
          fire every minute and gate on their own interval) and <strong>Dispatch</strong> (LLM-powered,
          lock-gated, executes one task at a time from the shared queue). Everything is a task in SQLite.
        </p>
        <p className="arch-meta">
          Diagram generated {new Date(DIAGRAM_GENERATED_AT).toLocaleDateString()} &bull;{" "}
          <a
            href="https://github.com/arc0btc/arc-starter/blob/main/skills/arc-architecture-review/state-machine.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source on GitHub
          </a>
        </p>
      </section>

      <section>
        <div className="diagram-container">
          <div id="mermaid-diagram" ref={diagramRef} data-diagram={MERMAID_DIAGRAM}>
            <p className="diagram-loading">Loading diagram...</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Decision Points</h2>
        <table className="decision-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Decision Point</th>
              <th>Gate</th>
            </tr>
          </thead>
          <tbody>
            {DECISION_POINTS.map((dp) => (
              <tr key={dp.id}>
                <td>{dp.id}</td>
                <td>{dp.point}</td>
                <td>{dp.gate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <style>{architectureStyles}</style>
    </>
  );
}

const architectureStyles = `
  .arch-meta {
    font-size: 0.85rem;
    opacity: 0.6;
  }

  .arch-meta a {
    color: var(--gold);
    text-decoration: none;
  }

  .arch-meta a:hover {
    text-decoration: underline;
  }

  .diagram-container {
    background: #0a0a0c;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .diagram-container svg {
    min-width: 600px;
  }

  .diagram-loading {
    color: var(--text);
    opacity: 0.5;
    text-align: center;
    padding: 2rem;
  }

  .decision-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .decision-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    background: #0a0a0c;
    color: var(--gold);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
  }

  .decision-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #111;
    color: var(--text);
    vertical-align: top;
  }

  .decision-table tr:hover td {
    background: #0a0a0c;
  }

  .decision-table td:first-child {
    color: var(--gold);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    white-space: nowrap;
  }
`;
