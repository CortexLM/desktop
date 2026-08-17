# Mission Orchestrator Implementation

## Overview

Implementation of the mission orchestrator system for Cortex IDE, inspired by `opencode-missions`. This provides a robust, filesystem-first approach to managing multi-step AI agent workflows.

## Architecture

### 1. **orchestrator/**

#### mission-runtime.ts
State machine-driven sequential runner:
- **States**: `planning → running → paused → completed`
- **Flow**:
  1. Pick topmost pending feature
  2. Claim (set `status: in_progress`), enforce exactly one in_progress
  3. Spawn worker via WorkerDriver
  4. Process result → completed/pending via store
  5. Retry with attempt budget (default 3)
  6. Pause on budget exhaustion
- **Key APIs**:
  - `startMissionRun(options)` — begin/resume execution
  - `pause(reason)` — cooperative pause with abort
  - `claimNextFeature()` — sequential feature selection
  - `applyWorkerResult()` — process worker completion

#### session-registry.ts
Worker tracking and authentication:
- Maps `workerSessionId → SessionIdentity`
- Used for tool authentication (e.g., `om_end_feature_run`)
- Supports lookup by feature ID or mission ID
- Thread-safe in-memory registry

#### worker-driver.ts
Abstraction for spawning worker agents:
- **WorkerDriver interface**:
  - `spawn(req: SpawnRequest): Promise<WorkerResult>`
  - `abort(workerSessionId: string): Promise<void>`
- **AIServiceDriver**: Production driver integrating with AIService
- **StubDriver**: Test driver for unit tests (no real AI calls)

### 2. **missions/**

#### mission-store.ts
Filesystem-first storage (SSOT):
- **Location**: `~/.cortex-ide/missions/<uuid>/`
- **Files**:
  - `state.json` — mission metadata and lifecycle state
  - `features.json` — feature queue with status
  - `validation-state.json` — validation contract tracking
  - `progress_log.jsonl` — append-only audit trail
  - `handoffs/*.json` — worker completion payloads
- **Key APIs**:
  - `createMission(input)` — atomic mission creation
  - `readState(dir)` / `updateState(dir, patch)` — state mutations
  - `readFeatures(dir)` / `updateFeature(dir, id, patch)` — feature CRUD
  - `writeHandoff(dir, payload)` — persist worker results
  - `appendProgress(dir, event)` — JSONL audit log

#### mission-types.ts
Zod schemas for validation:
- `State` — mission metadata
- `Feature` — individual work item with status
- `EndFeatureInput` — worker completion protocol (handoff)
- `ProgressEvent` — audit log event types
- `ValidationState` — validation contract assertions

#### progress-logger.ts
JSONL append-only audit trail:
- Structured event logging
- Event types: `mission_started`, `worker_selected_feature`, `worker_completed`, etc.
- Queryable by type, feature ID, or timestamp

### 3. **orchestrator/mission-orchestrator.ts**
High-level mission lifecycle management:
- `createMission(input)` — create new mission with features
- `startMission(missionDir, options)` — spawn runtime and begin execution
- `pauseMission(missionDir, reason)` — pause active mission
- `getMissionSummary(missionDir)` — progress metrics
- `listAllMissions()` — enumerate all missions
- Manages active runtimes and session registry

## Features Implemented

✅ **Mission Creation**: Filesystem-first storage with atomic writes  
✅ **State Machine**: `planning → running → paused → completed`  
✅ **Worker Spawning**: AIService integration via WorkerDriver  
✅ **Session Registry**: Worker authentication and tracking  
✅ **Progress Tracking**: JSONL append-only audit trail  
✅ **Handoff Protocol**: Structured worker completion with validation  
✅ **Attempt Budget**: Configurable retry budget with automatic pause  
✅ **Sequential Execution**: Exactly one in_progress feature at a time  
✅ **Cooperative Pause**: Abort in-flight workers cleanly  

## Integration with AIService

The orchestrator integrates with the existing `AIService` through the `AIServiceDriver`:

```typescript
const registry = AIProviderRegistry.fromEnv();
const orchestrator = new MissionOrchestrator({ registry });

const result = await orchestrator.createMission({
  workingDirectory: '/path/to/project',
  features: {
    features: [
      {
        id: 'setup-database',
        description: 'Create SQLite schema and migrations',
        milestone: 'M1',
        status: 'pending',
        preconditions: [],
        expectedBehavior: ['Database schema created', 'Migrations working'],
      },
    ],
  },
});

await orchestrator.startMission(result.missionDir);
```

## File Structure

```
packages/ai-engine/src/
├── orchestrator/
│   ├── mission-orchestrator.ts  # High-level API
│   ├── mission-runtime.ts       # Sequential runner
│   ├── session-registry.ts      # Worker tracking
│   └── worker-driver.ts         # Worker spawning
├── missions/
│   ├── mission-store.ts         # Filesystem SSOT
│   ├── mission-types.ts         # Zod schemas
│   └── progress-logger.ts       # Audit trail
└── index.ts                     # Public exports
```

## Storage Layout

```
~/.cortex-ide/missions/<uuid>/
├── state.json                   # Mission metadata
├── features.json                # Feature queue
├── validation-state.json        # Validation tracking
├── progress_log.jsonl           # Audit trail
└── handoffs/                    # Worker completions
    └── <timestamp>__<featureId>__<sessionId>.json
```

## Next Steps

1. **Integration with Main Process**: Wire up IPC handlers for mission CRUD
2. **Renderer UI**: Build mission list, detail view, and progress tracking
3. **Worker Prompt Engineering**: Enhance `buildWorkerPrompt()` with better context
4. **Validation Support**: Implement validation contract enforcement
5. **Parallel Missions**: Extend to support parallel feature execution (inspired by `opencode-parallel-missions`)
6. **Git Worktree Isolation**: Add worktree support for parallel execution safety

## References

- Architecture: `/root/opencode-missions/src/runner/mission-runtime.ts`
- Store: `/root/opencode-missions/src/store/mission-store.ts`
- Types: `/root/opencode-missions/src/types.ts`
- Session Registry: `/root/opencode-missions/src/driver/session-registry.ts`
