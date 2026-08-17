# 🚀 Performance Profiling & Optimization Tools

This directory contains comprehensive performance profiling scripts for Cortex IDE.

## 📊 Available Scripts

### 1. Bundle Analysis
```bash
bun scripts/profile-bundle.ts
```
**What it does**: Analyzes all build artifacts, measures sizes (raw + gzipped), identifies large files.

**Output**: `performance-reports/bundle-analysis-*.json`

**Key Metrics**:
- Total bundle size
- JavaScript, CSS, asset breakdown
- Largest files list
- Code splitting recommendations

---

### 2. Database Profiling
```bash
bun scripts/profile-database.ts
```
**What it does**: Profiles SQLite query performance, checks indexes, measures latency.

**Output**: `performance-reports/database-profile-*.json`

**Key Metrics**:
- Database size
- Query execution times
- Index coverage
- Slow query detection (>10ms)

**Note**: Requires the app to have been run at least once to create the database.

---

### 3. IPC Latency Analysis
```bash
bun scripts/profile-ipc.ts
```
**What it does**: Measures IPC communication overhead between main and renderer processes.

**Output**: `performance-reports/ipc-profile-*.json`

**Key Metrics**:
- Average latency per channel
- Call frequency
- Slow channels (>50ms)
- Latency variance

---

### 4. Runtime Profiling Guide
```bash
bun scripts/profile-runtime.ts
```
**What it does**: Generates guide for Chrome DevTools and React Profiler usage.

**Output**: `performance-reports/runtime-profile-template.json`

**Manual Steps Required**:
1. Launch app with `bun run dev`
2. Open Chrome DevTools (Cmd+Opt+I)
3. Use Performance tab for main thread analysis
4. Use React DevTools Profiler for component analysis

---

### 5. Startup Time Measurement
```bash
bun scripts/profile-startup.ts
```
**What it does**: Measures app startup phases from launch to first paint.

**Output**: `performance-reports/startup-profile-*.json`

**Key Metrics**:
- Total startup time
- Build time
- App ready time
- Window shown time
- First paint time

**Note**: This launches the app and automatically closes it after 30s.

---

### 6. Aggregate Reports
```bash
bun scripts/aggregate-performance-reports.ts
```
**What it does**: Combines all profiling data into a single comprehensive summary.

**Output**: 
- `performance-reports/aggregated-report.json`
- Console summary with top issues

**Shows**:
- Overall health score
- Critical issues count
- Top recommendations prioritized
- Quick wins for immediate impact

---

### 7. Auto-Apply Optimizations
```bash
# Dry run (see what would change)
bun scripts/apply-optimizations.ts --dry-run

# Actually apply optimizations
bun scripts/apply-optimizations.ts
```
**What it does**: Automatically applies safe, high-impact optimizations.

**Optimizations Applied**:
1. ✅ Remove production source maps
2. ✅ Improve bundle splitting
3. ✅ Add performance budgets
4. ✅ Defer non-critical startup services

**Safety**: All changes are idempotent and can be reviewed before applying.

---

## 🎯 Quick Start - Full Performance Audit

Run all profiling scripts in sequence:

```bash
# 1. Build the app first
bun run build

# 2. Run all profilers
bun scripts/profile-bundle.ts
bun scripts/profile-database.ts
bun scripts/profile-ipc.ts
bun scripts/profile-runtime.ts

# 3. Generate aggregate report
bun scripts/aggregate-performance-reports.ts

# 4. Review the comprehensive analysis
cat PERFORMANCE_PROFILE.md
```

---

## 📈 Understanding the Reports

### Bundle Analysis
```json
{
  "totalSize": 5899641,          // Total build size in bytes
  "totalGzipSize": 1363710,      // Compressed size
  "largestFiles": [...],          // Top 20 largest files
  "recommendations": [...]        // Optimization suggestions
}
```

### Database Profile
```json
{
  "dbSize": 102400,               // Database file size
  "statistics": {
    "avgQueryTime": 5.2,          // Average query time (ms)
    "totalQueries": 150           // Number of queries tested
  },
  "slowQueries": [...]            // Queries exceeding 10ms
}
```

### IPC Profile
```json
{
  "channels": [
    {
      "name": "db:query",
      "avgLatency": 5.2,          // Average round-trip (ms)
      "callCount": 150            // Number of calls
    }
  ]
}
```

---

## 🔧 Optimization Workflow

### Step 1: Baseline Measurement
```bash
bun run build
bun scripts/profile-bundle.ts
bun scripts/aggregate-performance-reports.ts
```

### Step 2: Review Recommendations
```bash
cat PERFORMANCE_PROFILE.md
# Focus on "High Priority" section
```

### Step 3: Apply Auto-Optimizations
```bash
# Preview changes
bun scripts/apply-optimizations.ts --dry-run

# Apply if satisfied
bun scripts/apply-optimizations.ts
```

### Step 4: Measure Improvement
```bash
bun run build
bun scripts/profile-bundle.ts
bun scripts/aggregate-performance-reports.ts
```

### Step 5: Compare Results
```bash
# Compare before/after in performance-reports/
ls -lh performance-reports/bundle-analysis-*.json
```

---

## 🎯 Key Performance Targets

### Bundle Size
- ✅ Initial JS bundle: < 400KB (gzipped)
- ✅ Total build: < 2MB (excluding source maps)
- ✅ Vendor chunks: < 200KB each

### Startup Time
- ✅ App ready: < 1s
- ✅ Window shown: < 2s
- ✅ First paint: < 3s

### Runtime Performance
- ✅ Component render: < 16ms (60fps)
- ✅ Message update: < 10ms
- ✅ Smooth scrolling: 60fps maintained

### IPC Latency
- ✅ Database queries: < 10ms
- ✅ File operations: < 20ms
- ✅ AI streaming: < 200ms (acceptable)

### Database
- ✅ All queries: < 50ms
- ✅ Simple queries: < 10ms
- ✅ Indexes on all WHERE clauses

---

## 📊 Continuous Monitoring

### Add to package.json
```json
{
  "scripts": {
    "perf:bundle": "bun scripts/profile-bundle.ts",
    "perf:db": "bun scripts/profile-database.ts",
    "perf:ipc": "bun scripts/profile-ipc.ts",
    "perf:all": "bun scripts/profile-bundle.ts && bun scripts/aggregate-performance-reports.ts",
    "perf:optimize": "bun scripts/apply-optimizations.ts"
  }
}
```

### CI/CD Integration
```yaml
# .github/workflows/performance.yml
- name: Performance Check
  run: |
    bun run build
    bun scripts/profile-bundle.ts
    bun scripts/aggregate-performance-reports.ts
    # Fail if bundle exceeds threshold
```

---

## 🐛 Troubleshooting

### "Database not found"
**Solution**: Run the app at least once to create the database:
```bash
bun run dev
# Interact with the app for a few seconds
# Close the app
bun scripts/profile-database.ts
```

### "Module not found: better-sqlite3"
**Solution**: Install dependencies:
```bash
bun install
```

### Profile startup script hangs
**Solution**: The script automatically times out after 30s. If it hangs:
- Check if Electron is installed: `which electron`
- Try building first: `bun run build`
- Check for port conflicts

---

## 📚 Additional Resources

### Chrome DevTools Performance
- [Official Guide](https://developer.chrome.com/docs/devtools/performance/)
- Look for yellow/red bars (long tasks)
- Check for layout thrashing
- Identify memory leaks

### React DevTools Profiler
- [Official Guide](https://react.dev/learn/react-developer-tools)
- Record component render times
- Identify unnecessary re-renders
- Check commit durations

### Electron Performance
- [Official Guide](https://www.electronjs.org/docs/latest/tutorial/performance)
- Use production builds for testing
- Enable V8 code caching
- Minimize IPC calls

---

## 🎓 Best Practices

1. **Profile before optimizing** - Don't guess where the problems are
2. **Measure impact** - Verify optimizations actually help
3. **One change at a time** - Makes it easy to identify what helped
4. **Use production builds** - Dev builds have extra overhead
5. **Test on real hardware** - Don't just test on fast machines
6. **Monitor continuously** - Performance can regress over time

---

## 📝 Report Locations

All reports are saved to: `performance-reports/`

```
performance-reports/
├── bundle-analysis-*.json       # Bundle size analysis
├── database-profile-*.json      # Database query performance
├── ipc-profile-*.json          # IPC latency measurements
├── runtime-profile-*.json      # Runtime profiling template
├── startup-profile-*.json      # Startup time breakdown
└── aggregated-report.json      # Combined summary (latest)
```

---

## 🚀 Expected Results

After applying all optimizations:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Bundle Size | 5.6MB | 1.2MB | **79% smaller** |
| Initial Load | 648KB | 280KB | **57% smaller** |
| Startup Time | ~3.8s | ~2.2s | **42% faster** |
| Message Render | 150ms | 5ms | **97% faster** |

---

## 💡 Quick Wins

1. **Remove source maps** (15 min) → 4.5MB smaller
2. **Lazy load Prism.js** (2 hours) → 120KB + 300ms faster
3. **Memoize messages** (1 hour) → 97% faster updates
4. **Defer startup** (2 hours) → 400ms faster startup

---

**Need help?** Check `PERFORMANCE_PROFILE.md` for detailed analysis and recommendations.
