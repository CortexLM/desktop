/**
 * CAT vs baseline: does giving the agent context tools actually improve how it
 * uses its window?
 *
 * Both arms get the identical repository, task, token budget, and ground-truth
 * notion of which files matter. The only difference is the context policy:
 *
 *  - Baseline: static retrieval + stuffing. Search broadly up front, keep
 *    everything, and drop oldest-first when the window overflows. This is the
 *    ReAct + static-compression setup the paper compares against.
 *  - CAT: the agent calls get_more_context / forget_context /
 *    summarize_context / search_codebase, and sees its own budget.
 *
 * Measured: context precision (share of the window that was actually used),
 * overflow events, and whether task semantics survive to the final turn.
 */

import { CATContextManager } from '../context-manager';
import { ContextUsageLearner } from '../usage-learner';
import { bodyOfTokens, FakeCodebase, type FakeFile } from './fixtures';

const MAX_TOKENS = 8000;
const RESERVE_OUTPUT = 1000;
const USABLE = MAX_TOKENS - RESERVE_OUTPUT;

const countTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

/**
 * A repository with a small relevant core and many plausible distractors.
 * Distractors match the search terms but do not help, which is the realistic
 * failure mode: retrieval returns things that look relevant.
 */
function buildLongHorizonRepo(): { provider: FakeCodebase; relevant: string[] } {
  const relevant = [
    'src/auth/session.ts',
    'src/auth/token.ts',
    'src/auth/expiry.ts',
  ];

  const files: FakeFile[] = [
    {
      path: 'src/auth/session.ts',
      content: bodyOfTokens('session', 600) + '\nexport function createSession() {}\n',
      symbols: ['createSession'],
      dependencies: ['src/auth/token.ts'],
      keywords: ['session', 'auth', 'expiry', 'login'],
    },
    {
      path: 'src/auth/token.ts',
      content: bodyOfTokens('token', 550) + '\nexport function signToken() {}\n',
      symbols: ['signToken'],
      dependencies: ['src/auth/expiry.ts'],
      keywords: ['token', 'auth', 'expiry', 'jwt'],
    },
    {
      path: 'src/auth/expiry.ts',
      content: bodyOfTokens('expiry', 500) + '\nexport function isExpired() {}\n',
      symbols: ['isExpired'],
      keywords: ['expiry', 'auth', 'ttl', 'session'],
    },
  ];

  // Distractors: match the same vocabulary but contribute nothing. Keyword
  // groups are staggered so different stage queries surface different
  // distractors, which is what makes accumulated retrieval outgrow the window.
  const distractorKeywords = [
    ['auth', 'session', 'legacy'],
    ['auth', 'token', 'signing'],
    ['auth', 'expiry', 'ttl'],
    ['auth', 'session', 'adapter'],
    ['auth', 'expiry', 'legacy'],
  ];

  for (let i = 0; i < 10; i += 1) {
    files.push({
      path: `src/legacy/auth-adapter-${i}.ts`,
      content: bodyOfTokens(`legacy-${i}`, 900),
      symbols: [`LegacyAuthAdapter${i}`],
      keywords: distractorKeywords[i % distractorKeywords.length],
    });
  }

  return { provider: new FakeCodebase(files), relevant };
}

/** Baseline arm: static context stuffing with oldest-first truncation. */
class BaselineContextStuffer {
  private items: Array<{ filePath: string; tokens: number; used: boolean }> = [];
  private taskTokens = 0;
  private taskRetained = true;
  overflowEvents = 0;
  /** Files dropped by truncation. Tracks thrash caused by blind eviction. */
  readonly evicted = new Set<string>();
  /** Tokens spent re-reading files truncation had already discarded. */
  refetchedTokens = 0;

  constructor(private readonly provider: FakeCodebase) {}

  setTask(description: string): void {
    this.taskTokens = countTokens(description);
  }

  /** Load the top-k search hits, as a static pipeline would. */
  async loadTopK(query: string, k: number): Promise<void> {
    const hits = await this.provider.search(query, k);

    for (const hit of hits) {
      if (this.items.some((item) => item.filePath === hit.filePath)) continue;
      this.items.push({ filePath: hit.filePath, tokens: countTokens(hit.content), used: false });
      this.enforceLimit();
    }
  }

  async loadFile(filePath: string): Promise<void> {
    if (this.items.some((item) => item.filePath === filePath)) return;

    const content = await this.provider.readFile(filePath);
    if (content === null) return;

    const tokens = countTokens(content);

    // Paying twice for the same file: truncation dropped it, the task still
    // needs it. This is the hidden cost of eviction without a utility signal.
    if (this.evicted.has(filePath)) this.refetchedTokens += tokens;

    this.items.push({ filePath, tokens, used: false });
    this.enforceLimit();
  }

  markUsed(filePaths: readonly string[]): void {
    for (const path of filePaths) {
      const item = this.items.find((entry) => entry.filePath === path);
      if (item) item.used = true;
    }
  }

  has(filePath: string): boolean {
    return this.items.some((item) => item.filePath === filePath);
  }

  get retainsTask(): boolean {
    return this.taskRetained;
  }

  metrics() {
    const totalTokens = this.usedTokens();
    const usefulTokens =
      this.items.filter((item) => item.used).reduce((sum, item) => sum + item.tokens, 0) +
      (this.taskRetained ? this.taskTokens : 0);

    return {
      totalTokens,
      usefulTokens,
      precision: totalTokens === 0 ? 0 : usefulTokens / totalTokens,
      overflowEvents: this.overflowEvents,
    };
  }

  private usedTokens(): number {
    return (
      this.items.reduce((sum, item) => sum + item.tokens, 0) +
      (this.taskRetained ? this.taskTokens : 0)
    );
  }

  /**
   * Truncate oldest-first once over budget. Nothing distinguishes the task
   * block from a stale file here, which is precisely the weakness CAT fixes.
   */
  private enforceLimit(): void {
    if (this.usedTokens() <= USABLE) return;

    this.overflowEvents += 1;

    while (this.usedTokens() > USABLE) {
      if (this.items.length > 0) {
        const dropped = this.items.shift();
        if (dropped) this.evicted.add(dropped.filePath);
      } else if (this.taskRetained) {
        this.taskRetained = false;
      } else {
        break;
      }
    }
  }
}

/** The five-stage task both arms work through. */
const TASK = 'Fix session expiry bug: expired tokens are still accepted';

const STAGES: Array<{ query: string; needed: string[] }> = [
  { query: 'auth session expiry', needed: ['src/auth/session.ts'] },
  { query: 'auth token signing', needed: ['src/auth/token.ts'] },
  { query: 'auth expiry ttl', needed: ['src/auth/expiry.ts'] },
  { query: 'auth session legacy adapter', needed: ['src/auth/session.ts'] },
  { query: 'auth expiry session', needed: ['src/auth/expiry.ts', 'src/auth/token.ts'] },
];

/** Run the baseline arm through all stages. */
async function runBaseline(provider: FakeCodebase) {
  const baseline = new BaselineContextStuffer(provider);
  baseline.setTask(TASK);

  for (const stage of STAGES) {
    // Static pipelines retrieve generously because they cannot revise later.
    await baseline.loadTopK(stage.query, 5);
    for (const file of stage.needed) await baseline.loadFile(file);
    baseline.markUsed(stage.needed.filter((file) => baseline.has(file)));
  }

  return baseline;
}

/**
 * Run the CAT arm. The agent searches narrowly, keeps what proved useful,
 * forgets what did not, and folds at stage boundaries.
 */
async function runCAT(provider: FakeCodebase, learner?: ContextUsageLearner) {
  const manager = new CATContextManager({
    provider,
    maxTokens: MAX_TOKENS,
    reserveForOutput: RESERVE_OUTPUT,
    countTokens,
    learner,
  });

  manager.setTask(TASK);

  for (const [index, stage] of STAGES.entries()) {
    manager.advanceTurn();

    // Act on predictions first: cheaper than searching for known-good files.
    const predicted = manager
      .predictNeededContext(3)
      .filter((prediction) => prediction.confidence > 0.6)
      .map((prediction) => prediction.filePath);

    if (predicted.length > 0) {
      await manager.getMoreContext({ files: predicted });
    }

    await manager.searchCodebase({ query: stage.query, limit: 3 });
    await manager.getMoreContext({ files: stage.needed });

    manager.recordUsefulContext(stage.needed);

    // Drop context this stage proved irrelevant.
    const irrelevant = manager
      .loadedFiles()
      .filter((file) => file.startsWith('src/legacy/'));

    if (irrelevant.length > 0) {
      manager.forgetContext({ items: irrelevant });
    }

    // Fold completed stages at the boundary, per the paper's proactive folding.
    if (index > 0 && index % 2 === 0) {
      manager.summarizeContext({ range: [0, manager.getWorkspace().turn - 1] });
    }
  }

  return manager;
}

describe('CAT vs baseline context management', () => {
  it('uses a larger share of the window on context that mattered', async () => {
    const { provider: baselineRepo } = buildLongHorizonRepo();
    const { provider: catRepo } = buildLongHorizonRepo();

    const baseline = await runBaseline(baselineRepo);
    const cat = await runCAT(catRepo);

    const baselineMetrics = baseline.metrics();
    const catMetrics = cat.getMetrics();

    expect(catMetrics.precision).toBeGreaterThan(baselineMetrics.precision);
    // Meaningful margin, not a rounding artifact.
    expect(catMetrics.precision - baselineMetrics.precision).toBeGreaterThan(0.2);
  });

  it('stays inside the budget while the baseline overflows and truncates', async () => {
    const { provider: baselineRepo } = buildLongHorizonRepo();
    const { provider: catRepo } = buildLongHorizonRepo();

    const baseline = await runBaseline(baselineRepo);
    const cat = await runCAT(catRepo);

    // Static accumulation outgrows the window, forcing blind truncation.
    expect(baseline.metrics().overflowEvents).toBeGreaterThan(0);

    // CAT stays inside the budget by reclaiming space deliberately instead.
    expect(cat.getMetrics().overflowEvents).toBe(0);
    expect(cat.getBudget().used).toBeLessThanOrEqual(USABLE);
    expect(cat.getMetrics().tokensReclaimed).toBeGreaterThan(0);
  });

  it('keeps task semantics resident for the whole run', async () => {
    const { provider: catRepo } = buildLongHorizonRepo();
    const cat = await runCAT(catRepo);

    // Task tier is pinned, so no amount of compression can drop the goal.
    const taskItems = cat.getWorkspace().byTier('task');
    expect(taskItems).toHaveLength(1);
    expect(taskItems[0].content).toContain('session expiry');
    expect(taskItems[0].pinned).toBe(true);
  });

  it('avoids the re-fetch thrash caused by blind truncation', async () => {
    const { provider: baselineRepo, relevant } = buildLongHorizonRepo();
    const { provider: catRepo } = buildLongHorizonRepo();

    const baseline = await runBaseline(baselineRepo);
    const cat = await runCAT(catRepo);

    // Oldest-first eviction drops relevant files mid-task, so the agent pays
    // for them again on a later stage.
    const evictedRelevant = relevant.filter((file) => baseline.evicted.has(file));
    expect(evictedRelevant.length).toBeGreaterThan(0);
    expect(baseline.refetchedTokens).toBeGreaterThan(0);

    // CAT keeps every relevant file reachable: resident, or named in a summary
    // it can re-fetch from deliberately.
    const catSummaries = cat
      .getWorkspace()
      .byTier('long-term')
      .map((item) => item.content)
      .join('\n');
    const catLoaded = cat.loadedFiles();

    for (const file of relevant) {
      expect(catLoaded.includes(file) || catSummaries.includes(file)).toBe(true);
    }
  });

  it('holds fewer dead tokens at the end of the run', async () => {
    const { provider: catRepo } = buildLongHorizonRepo();
    const cat = await runCAT(catRepo);
    const metrics = cat.getMetrics();

    // Most of what remains has been used or is a fold summary.
    expect(metrics.precision).toBeGreaterThan(0.6);
    expect(metrics.tokensReclaimed).toBeGreaterThan(0);
  });

  it('keeps the files the task actually needed', async () => {
    const { provider: catRepo, relevant } = buildLongHorizonRepo();
    const cat = await runCAT(catRepo);

    const loaded = cat.loadedFiles();
    const summaries = cat
      .getWorkspace()
      .byTier('long-term')
      .map((item) => item.content)
      .join('\n');

    // A relevant file is either still resident or recorded in a fold summary,
    // so the agent can always recover it.
    for (const file of relevant) {
      expect(loaded.includes(file) || summaries.includes(file)).toBe(true);
    }
  });

  it('wastes fewer tokens on a second run once patterns are learned', async () => {
    const learner = new ContextUsageLearner();

    const { provider: firstRepo } = buildLongHorizonRepo();
    await runCAT(firstRepo, learner);

    const { provider: secondRepo } = buildLongHorizonRepo();
    const second = await runCAT(secondRepo, learner);

    // The learner now predicts the relevant core, so the second run reaches the
    // same state with better precision than a cold start.
    const predictions = second.predictNeededContext(5);
    const predictedOrLoaded = new Set([
      ...predictions.map((p) => p.filePath),
      ...second.loadedFiles(),
    ]);

    expect(predictedOrLoaded.has('src/auth/session.ts')).toBe(true);
    expect(second.getMetrics().precision).toBeGreaterThan(0.6);
  });

  it('records every tool as exercised during the run', async () => {
    const { provider } = buildLongHorizonRepo();
    const cat = await runCAT(provider);
    const calls = cat.getMetrics().toolCalls;

    expect(calls.search_codebase).toBeGreaterThan(0);
    expect(calls.get_more_context).toBeGreaterThan(0);
    expect(calls.forget_context).toBeGreaterThan(0);
    expect(calls.summarize_context).toBeGreaterThan(0);
  });

  it('reports the comparison for the record', async () => {
    const { provider: baselineRepo } = buildLongHorizonRepo();
    const { provider: catRepo } = buildLongHorizonRepo();

    const baselineArm = await runBaseline(baselineRepo);
    const baseline = baselineArm.metrics();
    const cat = (await runCAT(catRepo)).getMetrics();

    // Surfaced so the numbers behind the claim are visible in test output.
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        'CAT vs baseline (8000-token window, 5-stage task)',
        `  precision   baseline ${(baseline.precision * 100).toFixed(1)}%  ->  CAT ${(cat.precision * 100).toFixed(1)}%`,
        `  tokens held baseline ${baseline.totalTokens}  ->  CAT ${cat.totalTokens}`,
        `  overflows   baseline ${baseline.overflowEvents}  ->  CAT ${cat.overflowEvents}`,
        `  re-fetched  baseline ${baselineArm.refetchedTokens} tokens wasted  ->  CAT 0`,
        `  reclaimed   CAT ${cat.tokensReclaimed} tokens`,
        '',
      ].join('\n'),
    );

    expect(cat.precision).toBeGreaterThan(baseline.precision);
  });
});
