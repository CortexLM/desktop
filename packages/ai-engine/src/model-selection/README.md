# Composed model selection

One decision that answers "which model runs this?" using all three criteria that
previously answered it independently and in ignorance of each other.

## Why this exists

Three subsystems each owned part of the answer:

| Subsystem | Asks | Blind to |
| --- | --- | --- |
| `model-presets.ts` | What did the user ask for? | task difficulty, provider health |
| `routing/` | How hard is this task? | provider health, user intent |
| `orchestration/` | Which providers are callable? | task difficulty, user intent |

Nothing composed them. A caller using `routing/` would route to a provider whose
circuit was open. A caller using `orchestration/` would send a `format this file`
request to Opus because Opus happened to be idle. A caller using
`getModelForPreset` got neither signal.

The blocker was not missing glue code, it was an abstraction mismatch: a preset
names a model *within a provider*, a `routing/` lane named exactly one
`(provider, model)` pair, and `orchestration/` names a *provider* with no opinion
about the model. So when infrastructure vetoed the cheap lane's single provider,
the lane had nothing else to offer and the only way out was to change lane —
changing cost and capability for a reason unrelated to either.

The fix is [`lane-candidates.ts`](./lane-candidates.ts): **a lane holds several
interchangeable candidates across providers.** An infrastructure veto is then
absorbed inside the lane wherever possible.

## Order of application

```
preset (constraint)  →  classification (proposal)  →  context fit (filter)  →  infrastructure (veto + pick)
```

1. **Preset — constraint.** Bounds the lane window before anything is computed.
   It goes first because it is the only input that is not an inference: the user
   actually said it.
2. **Classification — proposal.** `routing/` proposes a lane *inside that window*,
   including its learned start-tier shift and bounded exploration.
3. **Context fit — hard filter.** Applied per *candidate*, not per lane, because
   context windows differ inside a lane.
4. **Infrastructure — veto, then pick.** `orchestration/` decides what is
   callable. It is last and it is final.

This matches the order proposed in the brief. One refinement: infrastructure acts
as a **veto rather than a preference**. When the lane's primary binding is
callable it wins outright and infra's score is not consulted — see
[Contested decisions](#contested-decisions).

## Usage

```typescript
import {
  AIProviderRegistry,
  InfraAwareOrchestrator,
  createUnifiedModelSelector,
  registerProviders,
} from 'ai-engine';

const registry = AIProviderRegistry.fromEnv();
const orchestrator = new InfraAwareOrchestrator();
registerProviders(orchestrator, registry);

const selector = createUnifiedModelSelector({ registry, orchestrator });
```

### All three criteria, composed

```typescript
const decision = selector.select({
  preset: 'fastest',                                 // (1) constrains lanes to cheap..mid
  task: { id: 't-1', prompt: 'format this file' },   // (2) trivial -> proposes cheap lane
  priority: 'high',
});
// (3) infra: cheap-lane providers are saturated, so the decision moves.

decision.tier;          // 'mid'
decision.proposedTier;  // 'cheap'
decision.deviation;     // 'lane-shift'
decision.provider;      // 'anthropic'
decision.reason;
// preset=fastest (lanes cheap..mid, objective=latency);
// task=simple/formatting @0.70 -> proposed cheap lane;
// cheap lane unavailable: openrouter:google/gemini-3.7-flash (queue saturated (1.00));
// infrastructure forced cheap -> mid;
// selected anthropic/claude-sonnet-4.5; selected anthropic (objective=latency, ...)
```

`reason` always names all three criteria, so a surprising choice is explainable
without a debugger. `rejected` carries the per-candidate breakdown.

### Executing

`execute` drives escalation and keeps both subsystems' bookkeeping in sync —
`routing/`'s learner and cost ledger, and `orchestration/`'s monitor and circuit
breakers.

```typescript
const result = await selector.execute(
  { task, preset: 'smartest' },
  async ({ provider, model }) => {
    const response = await registry.getProvider(provider)!.chat(messages, { model });
    return {
      success: response.content.trim().length > 0,
      value: response,
      usage: response.usage,
    };
  }
);

result.success;
result.attempts.map((a) => `${a.tier}/${a.provider}`);  // ['mid/anthropic', 'expensive/anthropic']
result.cost;
```

Failure handling differs by kind, because the three failure classes mean
different things:

| Failure | Response | Why |
| --- | --- | --- |
| `transient` | retry, failing over **within** the lane | infrastructure noise says nothing about capability |
| `provider-error` | try another provider in the same lane | auth/config faults are provider-local |
| capability (`validation-failed`, `incorrect-output`, …) | **escalate** a lane | this is the one case a different lane helps |

Do **not** also submit the same work to `InfraAwareOrchestrator.execute`; that
double-counts queue depth and spend. For the orchestrator's queueing and
congestion-aware parallelism, use `toOrchestrationTask` instead:

```typescript
const task = selector.toOrchestrationTask(request, async ({ provider, model }) => {
  const response = await registry.getProvider(provider)!.chat(messages, { model });
  return { value: response.content, usage: response.usage };
});
await orchestrator.executeAll([task]);
```

### No infrastructure wired

`new UnifiedModelSelector()` works with no registry and no orchestrator. It falls
back to lane ordering and says so in `reason` (`no infrastructure signal for this
lane`), rather than pretending to have checked.

## Preset semantics

| Preset | Lane window | Objective |
| --- | --- | --- |
| `cheapest` | `cheap` only | cost |
| `fastest` | `cheap`..`mid` | latency |
| `smartest` | `mid`..`expensive` | quality |
| `reasoning` | `expensive` only | quality |

Presets are **hard windows**, not preferences: a ceiling that can be exceeded is
not a ceiling. A `cheapest` request whose lane is entirely uncallable returns
`provider: null` with a reason, rather than quietly spending more. Two documented
escape hatches:

- **Context fit** always wins. An input that fits nowhere in the window may use a
  wider-window lane, because the alternative is a guaranteed overflow.
- **`allowInfraEscape: true`** (default `false`) opts into leaving the window when
  everything inside it is vetoed.

### The catalogue conflict

`MODEL_PRESETS` is **per provider** — "cheapest for anthropic" is Sonnet 4.5.
`routing/` lanes are **global** — Sonnet 4.5 *is* the mid lane. Both cannot be
authoritative about spend.

Resolution: the lane window is authoritative for spend; the preset's per-provider
model applies only as a tie-break *within* an already-selected lane, and only once
the lane's primary has been vetoed. So `cheapest` never buys a mid-lane model just
because one provider's own "cheapest" entry happens to be one.

## Known gaps

1. **Large-context work is single-provider.** Every candidate above 200k tokens is
   an OpenRouter-hosted Gemini. If OpenRouter is down, a 500k-token task has no
   home; selection returns `null` with that reason instead of picking a model
   guaranteed to overflow. Fixing this needs a non-OpenRouter long-context
   provider — a deployment decision, not a code change.
2. **Infra cost signals are per provider, not per model.** `ProviderCapacity`
   carries one price per provider, so the monitor cannot distinguish two models on
   the same provider. Lane pricing is therefore authoritative for spend; the
   monitor's prices are used only for its own budget accounting. This is the main
   reason infra is a veto rather than a preference.
3. **Only monitored providers are judged.** A candidate on a provider that was
   never registered with the monitor is invisible to infrastructure filtering. If a
   lane has *any* monitored candidates, unmonitored ones in that lane are skipped.
   Register every provider you want considered.

## Contested decisions

Points where this implementation departs from, or pushes back on, the brief.

**Infrastructure as veto, not preference.** The brief asks for infra to be "the
last authority", which it is — nothing overrides its ineligibility verdict. But
letting its *ranking* also pick the model among eligible providers was wrong, and
measurably so: with all providers healthy it moved a `redesign the architecture`
task off Opus onto GPT-4.5-turbo, purely because the monitor's per-provider price
for `openai` is lower. The monitor cannot see model-level price or capability, so
that is worse information overriding better information. Primary-wins-if-eligible
also means adopting this facade does not silently re-route healthy traffic.

**The three modules stay separate.** The brief asks to unify the *decision*, and
that is done. It does not follow that the modules should merge, and they should
not: `routing/` is per-task and stateless in its inputs, `orchestration/` is
per-process and stateful in wall-clock time, and `model-presets.ts` is a static
catalogue read directly by the UI. They have different lifecycles and different
test surfaces. What was missing was a composition layer, which is what this is.

**`reasoning` is pinned to `expensive`, `smartest` is not.** Both look like
"quality" presets. The asymmetry is deliberate: reasoning work that silently lands
on a cheap model produces confident wrong answers, which is the exact failure mode
the preset exists to prevent, so it refuses rather than degrades. `smartest` is a
general quality preference where the mid lane is a legitimate answer when the top
lane is uncallable.

**Lane search breaks ties upward.** When the proposed lane is uncallable, the
nearest lane is tried first, and ties break toward the *more* expensive lane. A
more capable lane gives a correct answer for more money; a cheaper one risks a
wrong answer, which costs a retry plus the user's trust. Overpaying is the
recoverable error.

## Cost-gap caveat

No logic here depends on the size of the gap between lanes, and
`preserved-corrections.test.ts` asserts that: halving the top lane's price does
not change which lane a trivial task starts on. `expectedCost` uses whatever
prices are configured and `failurePenalty` is expressed as a fraction of the top
lane, so both are scale-free.

Worth knowing: the default price table yields ~40x between cheap and expensive,
which is optimistic — it pairs a Flash-class model against Opus. On realistically
mixed tokens the gap is closer to ~8x. Prices are configuration; override them via
`tiers` to match your account.

Relatedly, the `-75.4%` figure in `routing/README.md` is a **simulation** on a
fixed usage profile, not a measurement of real traffic. It is not a validated
result.
