# Context-as-a-Tool (CAT)

Context maintenance as a set of callable, learnable tools rather than passive
preprocessing. Implements the paradigm from **"Context as a Tool: Context
Management for Long-Horizon SWE-Agents"** (arXiv:2512.22087).

> Cortex agents remember what matters, forget what doesn't.

## Why this exists

A static context pipeline decides what the agent sees before the agent knows what
it needs, then truncates blindly when the window fills. Both decisions are made
without the one signal that matters: whether the context actually helped.

CAT inverts this. The agent sees its own token budget, and it has tools to change
what it holds. A learner watches which context contributed to progress and biases
future retention and retrieval accordingly.

## The four tools

Advertised to the model via `CONTEXT_TOOL_DEFINITIONS` and routed through
`dispatchContextTool`:

| Tool | Purpose |
| --- | --- |
| `get_more_context` | Fetch files/symbols, optionally expanding dependencies by `depth`. |
| `forget_context` | Drop irrelevant items to reclaim tokens. Doubles as a negative training signal. |
| `summarize_context` | Fold a turn range of working memory into a compact, still-actionable summary. |
| `search_codebase` | Semantic search when the agent doesn't yet know which files matter. |

Every result carries a fresh `BudgetSnapshot`, so the agent's next decision is
made against real numbers instead of a stale estimate.

## Structured workspace

Three tiers, mirroring the paper. The tier decides eviction eligibility, which is
what makes later compression safe rather than lossy:

- **`task`** — goal and constraints. Pinned implicitly; no compression path can
  drop it. Losing the goal is unrecoverable.
- **`long-term`** — fold summaries and durable facts. Survives compression cycles.
- **`short-term`** — raw file bodies, tool output, search hits. The eviction and
  folding target.

Fold summaries keep file paths and symbol names, so anything folded can be
re-fetched with `get_more_context`. That is the difference between compression
and data loss.

## Learning

`ContextUsageLearner` records whether each item contributed to progress, then:

- Smooths per-file hit rates (a single unlucky fetch shouldn't zero a file out).
- Scores retention from recency, use frequency, learned file reliability, task
  term overlap, and tier — transparent weighted terms, because eviction decisions
  need to be explainable when they go wrong.
- Ranks eviction candidates worst-first.
- Predicts what to fetch next from learned hit rates plus co-occurrence.
- Serializes, so patterns carry across sessions.

Call `recordUsefulContext()` when context contributes to progress. Without that
signal the learner has no ground truth and scoring degrades to plain recency.

## Token budget

`ContextBudgetManager` reserves output tokens up front — an agent that fills the
window to `max` has no room left to answer. It reports a named pressure state
(`low` / `moderate` / `high` / `critical`) rather than a raw float, because models
act on named states more reliably.

When a fetch doesn't fit and `autoOptimize` is on, `optimize()` reclaims space:
evict lowest-utility unused items first (cheap, precise), then fold older turns
(lossy but bulk). Used context is preferred for folding over deletion.

## Usage

```typescript
import {
  CATContextManager,
  CONTEXT_TOOL_DEFINITIONS,
  dispatchContextTool,
} from 'ai-engine';

const manager = new CATContextManager({
  provider: myCodebaseProvider, // implements CodebaseProvider
  maxTokens: 128_000,
  reserveForOutput: 8_000,
});

manager.setTask('Fix session expiry: expired tokens are still accepted', {
  constraints: ['no breaking API changes'],
});

// Advertise the tools, and show the agent its budget.
const tools = CONTEXT_TOOL_DEFINITIONS;
const budgetText = manager.describeBudget();

// Route a model-produced tool call.
const result = await dispatchContextTool(manager, toolCall.name, toolCall.arguments);

// Close the learning loop when context helped.
manager.recordUsefulContext(['src/auth/session.ts']);
manager.advanceTurn();
```

Bring your own retrieval by implementing `CodebaseProvider` (`search`,
`readFile`, optional `findSymbol` and `getDependencies`). The CAT layer is
retriever-agnostic, so it can sit on an embedding index, a dependency graph walk,
or ripgrep.

## Measured results

`__tests__/cat-vs-baseline.test.ts` runs a 5-stage task over an 8000-token window
against a repository with 3 relevant files and 10 plausible distractors. Both arms
get the same repo, task, budget, and retrieval limits; only the context policy
differs. The baseline is static top-k retrieval with oldest-first truncation.

| Metric | Baseline | CAT |
| --- | --- | --- |
| Context precision (useful tokens / held tokens) | 27.3% | **100%** |
| Tokens held at end | 6190 | **174** |
| Budget overflow events | 7 | **0** |
| Tokens wasted re-fetching evicted files | 609 | **0** |
| Tokens reclaimed deliberately | — | 9492 |

The precision gap is the headline: the baseline ends up with roughly three
quarters of its window spent on content that never contributed, because it cannot
revise a retrieval decision after making it. Overflow and re-fetch numbers show
the second cost — truncation without a utility signal discards files the task
still needs, and they get paid for twice.

Reproduce with:

```bash
npx vitest run src/context-tools --reporter=verbose
```

## Caveats

- Token counts use the package's ~4 chars/token heuristic by default. Pass
  `countTokens` for provider-exact counting.
- The baseline comparison is a deterministic simulation of context policy, not an
  end-to-end SWE-Bench run. It isolates context management from model capability
  on purpose; it does not by itself predict solve-rate gains.
- `defaultStructuralSummarizer` uses regex heuristics for declaration names. It
  covers TypeScript/JavaScript shapes well; other languages fall back to paths
  and recorded symbols.
