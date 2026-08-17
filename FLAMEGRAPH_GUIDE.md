# 🔥 Flamegraph Generation Guide

## What is a Flamegraph?

A flamegraph is a visualization of profiled software, showing which code paths consume the most CPU time. The width of each bar represents the time spent in that function and all its children.

```
┌────────────────────────────────────────────────────────┐
│ main() ──────────────────────────────────────────────  │ 100%
├────────────────────────────────────────────────────────┤
│ render() ──────────────────┐  db.query() ──────┐      │
│                             │                    │      │
│ highlightCode() ────┐       │  execute() ─────┐ │      │
│                      │       │                  │ │      │
│ Prism.highlight()── │       │  prepare() ────  │ │      │
└────────────────────────────────────────────────────────┘
     35% of time              20% of time    15%
```

---

## 🎯 Generating Flamegraphs for Cortex IDE

### Method 1: Chrome DevTools (Renderer Process) ⭐ RECOMMENDED

**Best for**: React components, UI rendering, syntax highlighting

#### Step 1: Launch with DevTools
```bash
bun run dev
# App opens with DevTools automatically
```

#### Step 2: Record Profile
1. Click **Performance** tab
2. Click **Record** button (red circle)
3. Interact with the app:
   - Send messages in chat
   - Open terminal
   - Switch views
   - Scroll through long lists
4. Click **Stop** after 5-10 seconds

#### Step 3: Analyze in DevTools
- **Main thread**: Shows JS execution
- **Frames**: Shows 60fps target line
- **Yellow/Red bars**: Long tasks blocking UI
- **Bottom-Up tab**: Shows which functions consumed most time

#### Step 4: Export for External Analysis
1. Click **gear icon** → "Save profile..."
2. Save as `renderer-profile.json`
3. Install speedscope:
   ```bash
   npm install -g speedscope
   ```
4. Open profile:
   ```bash
   speedscope renderer-profile.json
   ```

---

### Method 2: Node.js Profiler (Main Process)

**Best for**: IPC handlers, database queries, file operations

#### Step 1: Launch with Inspector
```bash
electron --inspect=9229 packages/main/dist/index.js
```

#### Step 2: Connect Chrome DevTools
1. Open Chrome
2. Navigate to `chrome://inspect`
3. Click **inspect** under "Remote Target"
4. Go to **Profiler** tab
5. Click **Start**

#### Step 3: Generate Profile
1. Interact with the app
2. Click **Stop** after 30 seconds
3. Profile appears in the list

#### Step 4: Analyze
- Review **Heavy (Bottom Up)** view
- Look for unexpected hot paths
- Check for blocking operations

---

### Method 3: V8 CPU Profiler (Production Profiling)

**Best for**: Production-like performance analysis

#### Step 1: Enable CPU Profiler
```typescript
// Add to packages/main/src/index.ts
import { Session } from 'electron';

if (process.env.PROFILE === 'true') {
  const session = Session.defaultSession;
  
  app.on('ready', async () => {
    await session.startProfiling();
    
    // Stop after 60 seconds
    setTimeout(async () => {
      const profile = await session.stopProfiling();
      const fs = require('fs');
      fs.writeFileSync('cpu-profile.cpuprofile', JSON.stringify(profile));
      console.log('Profile saved to cpu-profile.cpuprofile');
    }, 60000);
  });
}
```

#### Step 2: Run with Profiling
```bash
PROFILE=true electron .
```

#### Step 3: Visualize
```bash
speedscope cpu-profile.cpuprofile
```

---

### Method 4: React Profiler (Component Performance)

**Best for**: Identifying unnecessary re-renders

#### Step 1: Install React DevTools
- Chrome extension: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)

#### Step 2: Profile Components
1. Open React DevTools
2. Go to **Profiler** tab
3. Click **Record**
4. Interact with the app
5. Click **Stop**

#### Step 3: Analyze
- **Flamegraph view**: Shows component render hierarchy
- **Ranked view**: Shows slowest components
- **Component details**: Shows why each component rendered

#### Key Metrics
- **Render duration**: Time spent rendering
- **Render count**: How many times component rendered
- **Why did it render**: Props change, state change, parent render

---

## 📊 Interpreting Flamegraphs

### What to Look For

#### 🔴 Hot Paths (Wide Bars)
```
┌─────────────────────────────────────────────┐
│ ChatView.render() ───────────────────────   │ ← 40% of time
│   └─ Prism.highlight() ────────────────     │ ← 35% of time (OPTIMIZE THIS!)
│       └─ tokenize() ──────────────          │
└─────────────────────────────────────────────┘
```
**Action**: Optimize or move to Web Worker

#### 🟡 Tall Stacks (Many Nested Calls)
```
┌──────────────────────────┐
│ main()                   │
│  └─ processMessage()     │
│      └─ parseMarkdown()  │
│          └─ tokenize()   │
│              └─ ...      │ ← Deep nesting = overhead
│                  └─ ... │
└──────────────────────────┘
```
**Action**: Flatten call stack, reduce abstraction

#### 🟢 Expected Patterns
```
┌────────────────────────────────────────────┐
│ React.render() ──────────────              │
│   ├─ Components ─────                      │
│   └─ DOM.commit ─────                      │
│                                             │
│ db.query() ────                            │ ← Small, fast
│ ipc.send() ────                            │ ← Small, fast
└────────────────────────────────────────────┘
```

---

## 🎯 Common Performance Issues & Flamegraph Signatures

### Issue 1: Expensive Synchronous Operation
**Flamegraph**:
```
┌────────────────────────────────────────────────────┐
│ Prism.highlight() ═════════════════════════════════ │ ← Very wide!
└────────────────────────────────────────────────────┘
```
**Solution**: Move to Web Worker or lazy load

### Issue 2: Excessive Re-renders
**React Profiler**:
```
ChatView (23 renders) ← Too many!
  └─ MessageItem (230 renders) ← 10x per message!
```
**Solution**: React.memo, useMemo, useCallback

### Issue 3: Layout Thrashing
**DevTools Timeline**:
```
JS ─── Layout ─ JS ─── Layout ─ JS ─── Layout
    ↑ Read     ↑ Write ↑ Read   ↑ Write
    └─ Forced reflow (purple bars in DevTools)
```
**Solution**: Batch DOM reads and writes

### Issue 4: Memory Leak
**Memory Timeline**:
```
Heap Size: ╱╲╱╲╱╲╱╲╱╲╱╲╱╲  ← Should go down
           ╱  ╱  ╱  ╱  ╱  ╱   ← Going up = leak!
          ╱  ╱  ╱  ╱  ╱  ╱
```
**Solution**: Remove event listeners, clear intervals

---

## 🔬 Advanced: Custom Flamegraphs

### Using `perf` on Linux
```bash
# Record performance data
perf record -F 99 -g electron .

# Generate flamegraph
perf script | stackcollapse-perf.pl | flamegraph.pl > flame.svg

# Open in browser
firefox flame.svg
```

### Using dtrace on macOS
```bash
# Sample process
sudo dtrace -x ustackframes=100 -n 'profile-997 /pid == $1/ { @[ustack()] = count(); }' -p $(pgrep electron)

# Convert to flamegraph
dtrace output | stackcollapse.pl | flamegraph.pl > flame.svg
```

---

## 📋 Flamegraph Checklist

### Before Recording
- [ ] Build in production mode (`NODE_ENV=production`)
- [ ] Clear cache and restart app
- [ ] Close other applications
- [ ] Disable browser extensions (for renderer)
- [ ] Use consistent test scenario

### During Recording
- [ ] Record 10-30 seconds minimum
- [ ] Reproduce the slow scenario
- [ ] Perform actions multiple times
- [ ] Include idle time between actions

### After Recording
- [ ] Export profile immediately
- [ ] Save with descriptive name (e.g., `chat-rendering-2024.json`)
- [ ] Document what was being tested
- [ ] Compare with baseline if available

---

## 🎯 Expected Flamegraph Results

### Good Renderer Performance
```
┌────────────────────────────────────────────┐
│ React.render() ══════════  50%             │
│ Event handlers ═══════     30%             │
│ Browser internals ═══      15%             │
│ Your app code ═══          5%              │
└────────────────────────────────────────────┘
```

### Good Main Process Performance
```
┌────────────────────────────────────────────┐
│ IPC handlers ═══════════   40%             │
│ File I/O ═══════           25%             │
│ DB queries ═════           20%             │
│ Event loop ═════           15%             │
└────────────────────────────────────────────┘
```

### 🔴 Bad Performance (What to Avoid)
```
┌────────────────────────────────────────────┐
│ Prism.highlight() ════════════════  80%    │ ← Single function dominates!
│ Everything else ════                20%    │
└────────────────────────────────────────────┘
```

---

## 🚀 Quick Commands Reference

```bash
# Chrome DevTools (automatic)
bun run dev

# Node inspector
electron --inspect=9229 .

# With CPU profiling
PROFILE=true electron .

# Generate speedscope visualization
speedscope profile.json

# List available targets
chrome://inspect
```

---

## 📚 Tools & Resources

### Visualization Tools
- **speedscope**: https://www.speedscope.app/ (best for JS profiles)
- **flamegraph.pl**: https://github.com/brendangregg/FlameGraph
- **Chrome DevTools**: Built-in
- **React DevTools**: Chrome extension

### Learning Resources
- [Flamegraph.org](http://www.brendangregg.com/flamegraphs.html)
- [Chrome Performance Guide](https://developer.chrome.com/docs/devtools/performance/)
- [React Profiler Guide](https://react.dev/reference/react/Profiler)

---

## 💡 Pro Tips

1. **Always profile in production mode** - Dev builds have extra overhead
2. **Profile multiple times** - Results can vary, average 3-5 runs
3. **Focus on the widest bars** - That's where the time goes
4. **Compare before/after** - Measure impact of optimizations
5. **Profile real user scenarios** - Not artificial benchmarks
6. **Use React Profiler for UI** - Better than Chrome DevTools for React
7. **Sample at high frequency** - Use `-F 997` or `-F 99` for perf

---

## 🎯 Cortex IDE Specific Hot Paths

Based on static analysis, these are likely hot paths:

### 1. Syntax Highlighting
```typescript
// Location: ChatView.tsx:13-20
Prism.highlight() // Likely 30-40% of render time
```

### 2. Message Rendering
```typescript
// Location: ChatView.tsx:200+
messages.map() // Re-renders entire list
```

### 3. Auto-scroll
```typescript
// Location: ChatView.tsx:46-52
scrollIntoView() // Triggers every message
```

### 4. IPC Database Queries
```typescript
// Location: Multiple locations
window.cortex.db.query() // Frequent IPC overhead
```

**Generate flamegraphs to confirm these hypotheses!**

---

**Ready to profile?** Start with Method 1 (Chrome DevTools) - it's the easiest and most informative for UI performance.
