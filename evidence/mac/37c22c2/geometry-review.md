# Provider native geometry — independent bounded source review

**Current `c84743e…` correction needs one narrowing before approval: exempt only input self-clipping.**
Reviewed `/tmp/opencode/provider-draft-native.mjs` and retained diagnosis; no helper execution or Mac/runtime/network action.

## Exact source and recorded failure
- Original archived driver: `0125e457b2cd05ba2be8aa1344b6c6e5a0c15dbb7efdecab2af32a2add170d30`.
- Current driver: `c84743eeed5d8a5cda6f873269fcd0a247d8fcf467962fa6e6e7001bd9c0ad73`.
- Exact byte reconstruction verifies its only changes are two `node !== el &&` guards at line 63.
- Diagnosis JSON: `c7e8ac741c68ac9a1fe4853282ef58df81dbb1eea42a50a9b3f6fbe338bdfada`.
- Input border box `[631,358,831,392]`; own `overflow:clip` client box `[632,359,830,391]`.
- Original compares the border against that smaller box with 0.5px tolerance: all four 1px border edges fail. This is a measurement contradiction, not demonstrated product clipping.
- Five other targets pass visibility; all six hit tests pass. Recorded Save A / Disable / Enable pass, B remains preserved; zero captures, seven cleanup flags true.
- Original failure, original driver and original source review remain historical evidence, not retroactive passes.

## Smallest safe correction
Replace both new guards with `(node !== el || !(el instanceof HTMLInputElement)) &&`.
This fixes input border measurement while retaining original self-overflow checks for text, every ancestor clip, self/ancestor opacity, 0.5px tolerance, six targets and input/switch hit assertions.
The broad current guard also removes `.sub`'s real `overflow:hidden` text clip. Its recorded text fits, but a range ending at x=910 would incorrectly pass the ancestor right edge 915 while exceeding `.sub`'s right edge 901.
Do **not** require every text range inside its own border unconditionally: recorded `API key` ink starts y=313 above box y=314; `Enable` ink y=416 above box y=417. Their own overflow is visible; rejecting these would introduce another false failure.
Offline arithmetic replay of all six recorded bounds/ink against the proposed input-only rule passes; the constructed clipped-hint counterexample remains rejected. This is recorded-data validation, not a fresh runtime result.
No assertion, target, pixel capture, mutation count or cleanup step needs removal. Settings remains `b859cf9785ada768307e77a2546c02b80576b1491187b6ffa944c1673432eed6`.

**Disposition:** one concrete source blocker in current `c84743e…`; proposed two-condition input-only correction accepted in principle. Actual revised bytes need hash/diff readback before coordinator's finite confirmation run. Native pixel acceptance remains pending.
