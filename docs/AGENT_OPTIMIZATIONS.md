# Agent Optimizations for Long Context (300k+ tokens)

**Research synthesis — August 2026**

This document consolidates cutting-edge optimization techniques for AI coding agents operating in long-context environments (300k+ tokens), drawing from Factory CLI analysis, recent arxiv research (2025-2026), and FrontierBench/Terminal-Bench evaluation criteria.

---

## Executive Summary

Three optimization frontiers emerged from 2025-2026 research:

1. **Architectural**: Moving from sequential pipelines to joint planning, adaptive reasoning, and self-evolving harnesses
2. **Inference**: KV cache compression, dynamic attention, and hardware-software co-design for memory walls
3. **Coordination**: Hierarchical graph-based memory, role-aware context routing, and governed shared state

**Key insight from FrontierBench**: The best agents (Claude Opus 5 at 43.5%, GPT-5.6 Sol at 34.6%) succeed through **long-horizon task decomposition**, **structured memory management**, and **adaptive tool orchestration** — not just raw context window size.

---

## 1. Factory CLI Architecture Analysis

### 1.1 What Factory Got Right

From analyzing Factory's Droid agent structure at `/root/.factory`:

**Mission-scoped isolation**:
- Each mission has its own directory with `architecture.md`, `AGENTS.md`, `validation-contract.md`
- Missions define strict boundaries: repository path, port ranges, off-limits resources
- **Lesson**: Scope enforcement prevents agent drift and context pollution

**Hierarchical documentation**:
- Architecture doc is authoritative, with §12 as "most recent decision layer"
- Library of reusable patterns under `library/`
- Evidence capture with structured verification
- **Lesson**: Living documentation that agents can reference beats static prompts

**Verification-first workflow**:
- Every assertion has a status: `passed`, `failed`, `blocked`
- Discrimination checks prove tests are real (break implementation, confirm test fails)
- Real-time UI verification via automated screenshot capture
- **Lesson**: Proof over claims — agents must show their work

**Test-driven development mandate**:
- Write failing test first, watch it fail, then implement
- Prove tests discriminate when they never had a natural red state
- Fast fakes with deliberate stalls to catch transient states
- **Lesson**: TDD prevents agents from fooling themselves with passing-by-default tests

**Island architecture** (from Cortex IDE mission):
- Pure, DI-free, Node-testable core (`contrib/cortex/common/**`)
- Forbidden imports enforced by CI
- Plain values cross boundaries, never service handles
- **Lesson**: Testability at speed (12,599 tests in 23s) requires architectural discipline

### 1.2 Factory's Context Management Patterns

**Structured handoffs**:
- Each worker produces `salientSummary` (20-500 chars), `commitId`, test counts
- Metadata schema enforced — rejections cost 5 retries
- **Lesson**: Constrained outputs prevent context bloat

**Durable artifacts**:
- Setup scripts go to `{missionDir}/library/`, never `/tmp`
- Idempotent seeders that later rounds can reuse
- **Lesson**: Persistent workspace memory beats ephemeral scratch

**Baseline snapshots**:
- Measure parent commit before starting
- Compare against own baseline, not stale written figures
- Ratchet floors when features grow test suites
- **Lesson**: Dynamic baselines prevent false positives from growth

---

## 2. Research Insights: Long-Context Optimization (2025-2026)

### 2.1 Inference Optimizations

#### **Jet-Long: Dynamic Bifocal RoPE** (arXiv 2607.07740)
- Pairs local RoPE window with adaptive long-range rescaling
- Recovers base model at short inputs, extrapolates cleanly to 128K+
- **1.39× FA2 throughput** on H100, ≤4% generation overhead
- **Application**: Zero-shot context extension without retraining

#### **FreqDepthKV: KV Cache Compression** (arXiv 2607.06519)
- Factorizes adjacent-layer KV into shared low-freq + sparse high-freq residuals
- Online probe assigns heads to shared-depth/residual-depth/exact modes
- **3.9× compression ratio**, 70.4 tok/s decode, 2.06s TTFT
- **Application**: Maintain accuracy under aggressive memory budgets

#### **Latent-Condensed Attention (LCA)** (ACL 2026)
- Condenses context within MLA's latent space
- Query-aware pooling for semantics, anchor selection for positions
- **2.5× prefill speedup**, 90% KV cache reduction at 128K
- **Application**: Joint optimization of compute + memory

#### **PLENA: Hardware-Software Co-Design** (arXiv 2509.09505v3)
- Flattened systolic arrays + asymmetric quantization + native FlashAttention
- **2.23× vs A100**, 4.70× vs TPU v6e throughput for agentic inference
- **Application**: Specialized accelerators for long-context agent workloads

**Recommendation for Cortex IDE**:
- Implement **FreqDepthKV-style caching** if serving models locally
- Use **Jet-Long's bifocal pattern** for context window extension
- Profile KV cache as % of memory budget — optimize this first

### 2.2 Reasoning & Planning Optimizations

#### **P³: Joint Program-and-Proof Planning** (arXiv 2608.09277)
- Unified plan for implementation + correctness proof before elaboration
- Avoids brittle repair loops from code-then-prove
- **4.6-11.2pp solve rate improvement**, 40% cost reduction, 37% time savings
- **Application**: Plan verification strategy alongside code generation

#### **GraphAlignCoder: Structural Transfer** (arXiv 2608.11394v1)
- Implementation graph + proof-flow graph alignment
- Graph-derived descriptions of why regions are correct
- **31.6% gain** on LiveCodeBench, 43.8% on BigCodeBench Hard
- **Application**: Inject correctness structure into generation

#### **ALAR: Adaptive Latent Agentic Reasoning** (arXiv 2606.02871v1)
- Compact latent reasoning for routine turns
- Escalates to explicit CoT only when deeper reasoning needed
- **43.6% token reduction** in search, 84.6% in tool use
- **Application**: Allocate reasoning effort dynamically, not uniformly

**Recommendation for Cortex IDE**:
- Adopt **P³'s joint planning** for complex refactors: plan verification + implementation together
- Use **ALAR's adaptive pattern**: latent mode by default, CoT for hard decisions
- Track which tool calls benefit from explicit reasoning vs. immediate execution

### 2.3 Multi-Step Repository Generation

#### **CodeTeam: Multi-Agent Framework** (arXiv 2606.22082)
- Architect agents draft competing designs (SDSs)
- CTO agent evaluates/normalizes into machine-checkable contract
- Developer agents under dependency-aware scheduler + Git coordination
- **34.6% PE, 42.3% SFT** pass rates on NL2Repo-Bench
- **Application**: Separate planning, decision-making, implementation stages

#### **ReASearch: Reasoning-Driven Optimization** (arXiv 2608.06714v1)
- Agent autonomously manages optimization loop
- Analyzes outcomes, allocates budget, refines strategy over long horizons
- **2-40% gains** over domain-specific baselines
- **Application**: Internalize search policy in agent, not hand-designed heuristics

**Recommendation for Cortex IDE**:
- **CodeTeam pattern** for multi-file features: competing designs → contract → dependency-ordered implementation
- **ReASearch insight**: Let agent decide what to evaluate next, when to verify, when to revert

---

## 3. Memory & Context Management for Multi-Agent Systems

### 3.1 Hierarchical Memory Architectures

#### **G-Memory: Three-Tier Graph** (NeurIPS 2025)
- Insight graph (high-level generalizable knowledge)
- Query graph (cross-trial patterns)
- Interaction graph (fine-grained collaboration trajectories)
- Bi-directional traversal retrieves both insights + condensed interactions
- **20.89% embodied action improvement**, 10.12% knowledge QA gain
- **Application**: Progressive evolution of agent teams across sessions

#### **MAGMA: Multi-Graph Agentic Memory** (ACL 2026)
- Orthogonal semantic, temporal, causal, entity graphs
- Policy-guided traversal for query-adaptive retrieval
- Decouples memory representation from retrieval logic
- **Application**: Transparent reasoning paths, fine-grained retrieval control

#### **Governed Shared Memory (MemClaw)** (arXiv 2606.24535v1)
- Scoped retrieval, temporal supersession, provenance tracking
- Policy-governed propagation across agent fleets
- 97.5% cross-fleet propagation correctness, zero foreign leaks
- **Application**: Treat memory as distributed systems problem with governance

**Recommendation for Cortex IDE**:
- **G-Memory's three-tier pattern** for agent session memory:
  - Insight: "This codebase uses builder pattern for X"
  - Query: "User frequently asks to refactor Y"
  - Interaction: "Last 3 turns fixed import paths in src/"
- **MAGMA's multi-graph** for code understanding:
  - Semantic: component relationships
  - Temporal: edit history
  - Causal: "changed X because Y broke"
  - Entity: file/class/function references
- **MemClaw's governance** for team agents: scoped access, temporal correctness, provenance

### 3.2 Context Routing Optimizations

#### **RCR-Router: Role-Aware Routing** (arXiv 2508.04903)
- Dynamically selects semantically relevant memory subsets per agent role
- Lightweight scoring policy, strict token budget
- Agent outputs iteratively integrated into shared memory
- **30% token reduction** while maintaining/improving answer quality
- **Application**: Don't route full context to every agent — filter by role

#### **Self-Guided Test-Time Training (S-TTT)** (arXiv 2607.09415v1)
- Model identifies evidence spans it should learn from
- TTT applied only to selected spans, not full context
- **15% relative improvement** on LongBench-v2/Pro
- **Application**: Adapt on-demand to task-specific evidence, not entire history

**Recommendation for Cortex IDE**:
- **RCR-Router** for multi-agent coordination:
  - Test agent gets only test files + specs
  - Refactor agent gets call graph + affected files
  - Review agent gets diff + related documentation
- **S-TTT pattern**: Identify relevant code regions before deep analysis

---

## 4. FrontierBench / Terminal-Bench Insights

### 4.1 What the Leaderboard Reveals

**Terminal-Bench 3.0 (formerly FrontierBench)** — 74 tasks across 7 domains:
- Software engineering, ML, security, data science, system administration, web dev, file ops
- Measures long-horizon, multi-step professional tasks requiring real computer skills

**Top performers (July 2026)**:
1. Claude Opus 5 (mini-SWE-agent): **42.7% ± 1.6** — 7.3B tokens, $5.8k
2. GPT-5.6 Sol (Codex): **34.6% ± 1.6** — 5.8B tokens, $4.0k
3. Claude Fable 5 (Claude Code): **34.1% ± 1.7** — 3.6B tokens, $6.5k

**Key observations**:
- Resolution rates plateau around 43% — room for 2× improvement
- Token usage varies 2× (3.6B to 7.3B) among top-3
- Cost varies 1.6× ($4k to $6.5k)
- **Different harnesses produce different results** — workflow matters as much as model

### 4.2 What Separates Winners from Losers

**Continuous adversarial review**:
- 35-criteria implementation rubric
- Docker/oracle/no-op validation
- Live agent trials + adversarial "cheat" trials
- **Lesson**: Tasks evolve to prevent reward hacking

**Resolution rate = task completion**, not:
- Lines of code generated
- Tokens consumed
- Tool calls made
- **Lesson**: Outcome over activity

**Harness diversity**:
- mini-SWE-agent, Codex, Claude Code, Grok Build, Cursor CLI
- Different agents for different strengths
- **Lesson**: No single harness dominates all task types

**Open, evolving benchmark**:
- Anyone can propose tasks
- Automated review pipeline before maintainer sign-off
- Quarterly updates
- **Lesson**: Benchmark co-evolves with frontier capabilities

### 4.3 Winning Strategies Inferred

1. **Long-horizon planning**: 74-task suite rewards decomposition over one-shot
2. **Tool orchestration**: File ops, terminal, code search must be seamless
3. **Error recovery**: 43% success implies 57% failure — recovery matters
4. **Context efficiency**: 3.6B tokens (Fable 5) competitive with 7.3B (Opus 5)
5. **Domain breadth**: Generalists outperform narrow specialists

---

## 5. Concrete Recommendations for Cortex IDE

### 5.1 Immediate (M1-M3)

#### **Implement Island Architecture (Already Started)**
- Keep `contrib/cortex/common/**` pure and DI-free ✓
- Enforce with CI guard (`assert-island-boundary.mjs`)
- Unit test everything in Node, not Electron
- **Target**: 23s test runs like Factory achieves

#### **Structured Mission Memory**
- Create `/missions/{sessionId}/` with:
  - `architecture.md` — current codebase understanding
  - `contract.md` — user's stated goals
  - `library/` — reusable scripts/patterns this session
  - `evidence/` — screenshots, logs, verification artifacts
- **Pattern**: Every 10 turns, distill insights to architecture.md

#### **Verification-First Tool Execution**
- Before `write_file`: read existing, show diff, get approval
- After `run_terminal`: capture exit code + output, verify expected outcome
- Screenshot + visual diff after UI changes
- **Pattern**: Tool result must prove success, not just "bytes > 0"

#### **Adaptive Reasoning Budget**
- Routine tool calls (read_file, list_dir): latent mode
- Complex operations (refactor, debug): explicit CoT
- Track which tool+context combos benefit from reasoning
- **Target**: 40% token reduction per ALAR

### 5.2 Medium-term (M4-M6)

#### **Joint Planning for Multi-File Features**
- User: "Add authentication"
- Agent: Generate **design sketch** first:
  - Files to create/modify
  - Interfaces between components
  - Verification strategy
- User approves/refines sketch
- Agent executes under sketch constraints
- **Pattern**: P³'s program-and-proof planning

#### **Hierarchical Session Memory**
- **Insight tier**: "This is a React + TypeScript project using Vite"
- **Query tier**: "User prefers Zod for validation"
- **Interaction tier**: Last 20 turns, condensed
- On context limit: Promote interactions → queries → insights
- **Target**: 10× context compression per G-Memory

#### **Role-Aware Context Routing**
- Split agent into specialized roles:
  - **Planner**: sees user intent + codebase structure
  - **Implementer**: sees plan + relevant files only
  - **Reviewer**: sees diff + tests + original intent
- Each role gets <30% of full context
- **Target**: 3× context efficiency per RCR-Router

### 5.3 Advanced (M7+)

#### **Multi-Graph Code Memory**
- **Semantic graph**: imports, exports, function calls
- **Temporal graph**: git history, edit sequences
- **Causal graph**: "changed X to fix Y"
- **Entity graph**: class/function definitions, usages
- Query-adaptive traversal based on task type
- **Pattern**: MAGMA's orthogonal graphs

#### **Self-Evolving Harness**
- Agent reviews its own tool call patterns
- Identifies failure modes: "grep often misses X"
- Proposes tool schema improvements
- Updates system prompt with learned heuristics
- **Pattern**: Ouroboros self-improvement

#### **Governed Team Memory**
- Multiple agents (planner, implementer, reviewer) share memory
- Scoped access: reviewer sees test results, not raw context
- Temporal supersession: newer insights override stale
- Provenance tracking: "insight X from session Y"
- **Pattern**: MemClaw's distributed systems approach

---

## 6. Prompt Engineering Techniques (2026 SOTA)

### 6.1 From Recent Research

**Evolution: Three stages** (RUC-NLPIR/Awesome-Long-Horizon-Agents):
1. **Stage I (2020-2023)**: Prompt Engineering — language of a prompt
2. **Stage II (2023-2025)**: Context Engineering — information per call
3. **Stage III (2025-Present)**: Runtime Harnesses — sustained trajectories

**We are in Stage III**: The harness (mission structure, memory, verification) matters more than individual prompts.

### 6.2 Concrete Patterns

#### **Chain-of-Verification (CoV)**
```
1. Generate initial response
2. Generate verification questions for that response
3. Answer verification questions independently
4. Produce final response incorporating verification
```
**Use case**: Catch hallucinations in code explanations

#### **Structured Output Constraints**
```json
{
  "type": "object",
  "properties": {
    "plan": { "type": "array", "items": { "type": "string" } },
    "risks": { "type": "array", "maxItems": 3 },
    "verification": { "type": "string", "minLength": 20, "maxLength": 200 }
  },
  "required": ["plan", "risks", "verification"],
  "additionalProperties": false
}
```
**Use case**: Force agent to articulate plan before execution

#### **Few-Shot with Discrimination**
Show examples where:
- Test passed before implementation (BAD)
- Test failed, implementation made it pass (GOOD)
- Test passed, deliberate break made it fail (PROVES DISCRIMINATION)

**Use case**: Teach TDD discipline

#### **Budgeted Reasoning**
```
You have 3 reasoning tokens for this decision.
Use them only if the decision is non-obvious.
Options: [latent] or [reason: <text>]
```
**Use case**: Implement ALAR's adaptive allocation

### 6.3 Anti-Patterns to Avoid

❌ **Verbose uniform reasoning**: CoT on every tool call  
✅ **Adaptive reasoning**: Latent by default, CoT on demand

❌ **Full context every turn**: Route 300k tokens to every agent  
✅ **Role-scoped context**: Route 50k relevant tokens per role

❌ **Monolithic system prompt**: 10k token preamble  
✅ **Modular skills**: Load relevant 2k skill on demand

❌ **One-shot generation**: "Write the entire auth system"  
✅ **Incremental with verification**: "Write login route" → verify → "Write signup" → verify

❌ **Test after implementation**: Build then validate  
✅ **TDD discipline**: Write failing test → watch fail → implement → watch pass

---

## 7. Metrics & Observability

### 7.1 What to Measure

**Efficiency metrics**:
- Tokens per resolved task (lower is better)
- Wall-clock time per task (faster is better)
- Cost per task (cheaper is better)
- Context window utilization (% of 300k used)

**Quality metrics**:
- Task resolution rate (% of user intents completed)
- Test pass rate after agent changes
- Manual review acceptance rate
- Regression rate (new bugs introduced)

**Reasoning metrics**:
- % turns with explicit CoT
- Average reasoning length when used
- Correlation: reasoning length vs task success

**Memory metrics**:
- Insight tier size (KB)
- Query tier size (KB)
- Interaction tier compression ratio
- Memory retrieval precision/recall

### 7.2 Observability Requirements

**Per-session dashboard**:
- Turn count, tokens consumed, cost
- Tool call breakdown (types, success rates)
- Verification events (pass/fail/blocked)
- Memory tier sizes + recent promotions

**Cross-session analytics**:
- Most frequent failure modes
- Tool usage patterns
- Average turns to resolution by task type
- Context efficiency trends over time

**A/B testing harness**:
- Baseline: current agent
- Variant: optimized agent
- Metrics: resolution rate, tokens, time, cost
- Sample size: 100+ tasks per variant

---

## 8. Implementation Roadmap

### Phase 1: Foundation (M1-M3, ~4 weeks)
- [ ] Enforce island architecture with CI
- [ ] Mission-scoped memory structure
- [ ] Verification-first tool execution
- [ ] Adaptive reasoning budget (latent vs CoT)
- [ ] Basic metrics dashboard

**Success criteria**: 23s test runs, 40% token reduction, every tool result verified

### Phase 2: Planning & Memory (M4-M6, ~6 weeks)
- [ ] Joint planning for multi-file features
- [ ] Three-tier hierarchical memory
- [ ] Role-aware context routing
- [ ] Discrimination checks for tests
- [ ] Cross-session insight persistence

**Success criteria**: 10× context compression, 3× routing efficiency, TDD discipline enforced

### Phase 3: Advanced Optimization (M7+, ~8 weeks)
- [ ] Multi-graph code memory (semantic, temporal, causal, entity)
- [ ] Self-evolving harness (agent improves own tools/prompts)
- [ ] Governed team memory (multi-agent coordination)
- [ ] Hardware optimization (KV cache compression)
- [ ] Terminal-Bench evaluation

**Success criteria**: 20% resolution rate on Terminal-Bench subset, governed multi-agent workflows

---

## 9. References

### Papers (arXiv 2025-2026)

**Reasoning & Planning**:
- P³: Joint Program-and-Proof Planning (2608.09277)
- GraphAlignCoder: Aligning Program and Proof Graphs (2608.11394v1)
- ALAR: Adaptive Latent Agentic Reasoning (2606.02871v1)
- ReASearch: Reasoning-Driven Search (2608.06714v1)

**Long-Context Inference**:
- Jet-Long: Dynamic Bifocal RoPE (2607.07740)
- FreqDepthKV: KV Cache Compression (2607.06519)
- Latent-Condensed Transformer (ACL 2026)
- PLENA: Hardware-Software Co-Design (2509.09505v3)
- S-TTT: Self-Guided Test-Time Training (2607.09415v1)

**Multi-Agent & Memory**:
- G-Memory: Hierarchical Memory for MAS (NeurIPS 2025, 2506.07398)
- MAGMA: Multi-Graph Agentic Memory (ACL 2026)
- MemClaw: Governed Shared Memory (2606.24535v1)
- RCR-Router: Role-Aware Context Routing (2508.04903)

**Repository Generation**:
- CodeTeam: Multi-Agent Framework (2606.22082)
- RUC-NLPIR/Awesome-Long-Horizon-Agents (GitHub)

### Benchmarks

- **Terminal-Bench 3.0** (formerly FrontierBench): https://snorkel.ai/leaderboard/frontier-bench/
- **GitHub**: harbor-framework/terminal-bench

### Tools Analyzed

- **Factory CLI (Droid)**: v0.197.0 — mission structure, verification-first workflow, island architecture
- **Installation**: /root/.local/bin/droid, /root/.factory/

---

## 10. Conclusion

**The gap between 43% (SOTA) and 100% (ideal) is not a model problem — it's an architecture problem.**

Winning strategies for long-context agents:

1. **Structured memory** beats flat history (G-Memory, MAGMA)
2. **Joint planning** beats sequential pipelines (P³, CodeTeam)
3. **Adaptive reasoning** beats uniform verbosity (ALAR)
4. **Role-aware routing** beats full-context broadcast (RCR-Router)
5. **Verification-first** beats post-hoc validation (Factory's discrimination checks)
6. **Self-evolution** beats static harnesses (ReASearch, Ouroboros)

For Cortex IDE specifically:

- **Preserve the island architecture** — testability at speed is non-negotiable
- **Implement hierarchical memory** — insight/query/interaction tiers
- **Adopt P³'s joint planning** — verify and implement together
- **Use ALAR's adaptive reasoning** — don't waste tokens on routine decisions
- **Build verification into tools** — every result must prove success

The 2026 research consensus: **Runtime harnesses with structured memory and adaptive reasoning** will dominate the next frontier, not larger context windows or bigger models alone.

---

**Document status**: Living document — update quarterly with new research  
**Last updated**: August 16, 2026  
**Next review**: November 2026
