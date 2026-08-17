# Two-Tier Model Routing

Route mechanical work to a cheap model, reserve frontier models for reasoning.

Reading code is 60-80% of tokens in a typical agent session, and most of those
turns are mechanical. The price gap between the cheap and top lanes is ~40x at
default pricing, so moving that majority off the top lane is where the savings
come from.

## Lanes

| Lane | Model | Input $/M | Output $/M | Context |
|---|---|---|---|---|
| `cheap` | Gemini 3.7 Flash | 0.30 | 2.50 | 1M |
| `mid` | Claude Sonnet 4.5 | 3.00 | 15.00 | 200k |
| `expensive` | Claude Opus 4.8 | 15.00 | 75.00 | 200k |

Note the cheap lane has the *largest* context window. The router accounts for
this: a 500k-token task can only run on the cheap lane, and escalating it would
make things worse, not better.

## Basic use

```typescript
import { ModelRouter } from 'ai-engine';

const router = new ModelRouter();

router.route({ id: '1', prompt: 'format this file with prettier' });
// -> { tier: 'cheap', model: 'google/gemini-3.7-flash', ... }

router.route({ id: '2', prompt: 'fix the bug in the login handler' });
// -> { tier: 'mid', model: 'claude-sonnet-4.5', ... }

router.route({ id: '3', prompt: 'redesign the provider architecture' });
// -> { tier: 'expensive', model: 'claude-opus-4.8', ... }
```

Every decision carries a `reason` string, so routing is inspectable rather than
opaque:

```typescript
router.route({ id: '4', prompt: 'format these files', fileCount: 20 }).reason;
// 'lexical match: formatting (1 pattern); 20 files -> complex'
```

## Classification

Two signal families combine:

- **Lexical** — what the prompt asks for. Patterns are weighted by specificity,
  so "fix the indentation" reads as formatting rather than as a bug fix, even
  though "fix" matches both.
- **Structural** — how big the job is (`fileCount`, `estimatedTokens`,
  `requiresReasoning`). These only push complexity *up*, never down, so a large
  job is never silently downgraded to the cheap lane.

When nothing matches, the task classifies as `medium` with low confidence, and
the low-confidence guard starts it one lane higher. An unrecognised task on the
cheap lane is a coin flip, and a wasted attempt plus escalation costs more than
starting safe.

Callers who already know the task type should say so — it is more reliable than
inference:

```typescript
router.route({ id: '5', prompt: '...', kind: 'file-read' });
```

## Auto-escalation

`execute` runs the task, escalates on failure, and stops when it succeeds:

```typescript
const result = await router.execute(task, async (choice) => {
  const res = await callModel(choice.provider, choice.model);
  return { success: testsPass(res), usage: res.usage };
});

result.attempts.map((a) => a.tier); // ['cheap', 'mid']
```

Failures are triaged rather than treated alike:

| Failure kind | Action |
|---|---|
| `incorrect-output`, `validation-failed`, `refusal`, `incomplete` | escalate a lane |
| `context-overflow` | move to a lane that fits, if one exists |
| `transient` | retry the same lane |
| `provider-error` | stop; another model will not fix bad credentials |

This distinction is the difference between routing that saves money and routing
that quietly triples the bill: reading a rate limit as a capability failure
escalates a task to Opus for no reason.

## Learning

The router tracks per-`(kind, tier)` success rates and starts at the lane with
the lowest expected total cost:

```
E[i] = c_i + (1 - p_i) * (w + E[i+1])
```

`w` prices a wasted attempt beyond its token bill (latency, burned tool calls,
the risk of a wrong answer reaching the user), as a fraction of one top-lane
call. It defaults to `0.5`. Without it, token math alone always says "start
cheap" — with a 40x gap, a cheap attempt plus a mid attempt still costs a
fraction of one Opus call, so even a 5%-success lane looks optimal on paper.
Set `failurePenalty: 0` for pure token economics.

Evidence requirements are asymmetric, and deliberately so:

- Moving **up** needs evidence that the current lane fails.
- Moving **down** needs evidence that the cheaper lane *succeeds*. A
  well-behaved Opus lane says nothing about whether Sonnet could have done the
  job.

Until there is evidence (`minSamples`, default 5), classification stays in
charge.

### Exploration

Downshift learning has a bootstrapping problem: if "refactor" always routes to
Opus, the router never finds out that some refactors would have been fine on
Sonnet. So with probability `explorationRate` (default `0.05`) the router probes
one lane down.

Exploration is self-limiting — it stops once the lane below has `minSamples`
observations for that task kind — so it costs a one-off sampling budget per kind
rather than a permanent tax. In the demo workload it costs ~1% of spend. Set
`explorationRate: 0` to disable it, at the price of only ever being able to learn
upward.

Selection is a hash of the task id rather than a coin flip, so `route` stays a
pure function: asking twice about the same task always gives the same lane. The
hash needs its avalanche finaliser — plain FNV-1a puts sequential ids like
`task-1`, `task-2` into a 0.52–0.57 band, so a 5% rate would never fire on
exactly the id scheme most callers use.

```typescript
router.getLearner().export(); // persist
router.getLearner().import(saved); // restore across sessions
```

Persisting the learner across sessions matters more than it looks: without it,
every restart re-pays the exploration cost.

## Cost tracking

Every attempt is recorded against a baseline of "what this would have cost
unrouted", i.e. all-Opus:

```typescript
const summary = router.getCostSummary();
summary.savingsRatio;          // 0.94
summary.escalationWaste;       // spend on attempts that were escalated away from
summary.costPerSuccessfulTask; // the number that actually matters

console.log(router.formatCostReport());
```

`costPerSuccessfulTask` is the honest metric. Cost per token makes the cheap lane
look free even when it fails half the time and every task gets paid for twice.

Reports slice by task kind, complexity, and tier:

```typescript
router.getCostReport().byKind['file-read'].savingsRatio;
router.getCostReport().tierDistribution; // { cheap: 0.72, mid: 0.21, expensive: 0.07 }
```

## Provider integration

`routedChat` wires the router to the existing `AIProviderRegistry` and maps
provider errors onto failure kinds:

```typescript
import { ModelRouter, routedChat } from 'ai-engine';

const result = await routedChat(router, registry, task, messages, {
  validate: (res) => res.content.includes('```'),
});
```

## Configuration

```typescript
new ModelRouter({
  // Pin different models or negotiated rates.
  tiers: {
    cheap: { provider: 'ollama', model: 'qwen3-coder', pricing: { input: 0, output: 0 } },
  },
  // Hard budget cap: never touch the top lane.
  maxTier: 'mid',
  // Quality floor.
  minTier: 'mid',
  learning: { minSamples: 10, failurePenalty: 0.5, maxEscalations: 2 },
  disableLearning: false,
  transientRetries: 1,
  explorationRate: 0.05,
});
```

Per-task bounds override router defaults, so a user can pin one request without
changing global policy:

```typescript
router.route({ id: '6', prompt: 'refactor this', maxTier: 'mid' });
```

## Simulated savings

> These are **simulation** figures, not measurements of real traffic. They come
> from a fixed usage profile and a hardcoded model of which lane can handle what.
> They show the policy is arithmetically sound; they are not a validated result
> and should not be quoted as one.

`src/examples/routing-demo.ts` simulates 100 tasks on the research mix (70%
mechanical reads, 20% bug fixes, 10% architecture) and reports:

```
Actual cost:           $13.1215
Baseline (all-Opus):   $53.4300
Savings:               $40.3085 (75.4%)
Cost per success:      $0.1312

Tier distribution
  cheap      70.0%
  mid        20.0%
  expensive  10.0%

By task kind
  architecture       $10.1250  saved   0.0%
  bug-fix             $2.2500  saved  80.0%
  file-read           $0.6750  saved  97.7%
  formatting          $0.0615  saved  97.4%
```

In simulation that is -97.7% on simple tasks against a -70% target, and -75.4%
overall. Architecture tasks show 0% because they belong on the top lane; routing
is not supposed to save money there.

Reproduce with `npx tsx src/examples/routing-demo.ts`.

Two things inflate these numbers relative to what real traffic would show:

1. **The lane gap in the default table is optimistic.** It pairs a Flash-class
   cheap lane against Opus, giving ~40x. On realistically mixed tokens the gap is
   closer to ~8x, which compresses the headline saving substantially.
2. **The simulation decides success by fiat.** It assumes the cheap lane handles
   the mechanical share. Real savings depend on how often the cheap lane actually
   succeeds on your traffic, which is what the learner measures and the simulation
   assumes.

Check `costPerSuccessfulTask` and `escalationWaste` against your own usage before
treating any of these figures as yours.
