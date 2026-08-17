# Screenshots & Visual Testing Suite

## 📸 Quick Start

```bash
# Capture all screenshots
bun run screenshots:capture

# View the interactive report
bun run screenshots:view

# Compare with baseline
bun run screenshots:compare

# Compare with Paper designs
bun run screenshots:paper
```

## 📁 What's Included

### 1. Visual Regression Tests
**Location**: `tests/visual/visual-regression.spec.ts`

Captures screenshots of:
- All application views (Editor, Git, Terminal, Agents, etc.)
- All component states (loading, error, success)
- Dark AND light themes
- Multiple viewport sizes
- All dialogs/modals
- Error states and notifications

### 2. Component Isolation Tests
**Location**: `tests/visual/component-isolation.spec.ts`

Tests individual components in isolation:
- Buttons (all variants and states)
- Inputs (empty, filled, focused, error, disabled)
- Dialogs, Selects, Tabs, Progress bars
- All UI primitives from the design system

### 3. Storybook-Style Documentation
**Location**: `tests/visual/storybook-screenshots.spec.ts`

Generates a visual component library:
- Typography showcase
- Color palette
- Component variants
- Real-world usage examples

### 4. Automated Capture Script
**Location**: `scripts/capture-screenshots.ts`

Orchestrates all tests and generates:
- HTML report with filtering
- Organized directory structure
- Metadata and statistics

### 5. Comparison Tools

#### Baseline Comparison
**Location**: `scripts/compare-screenshots.sh`

Uses ImageMagick to:
- Detect pixel-level differences
- Generate visual diffs
- Create comparison reports

#### Paper Design Comparison
**Location**: `scripts/compare-with-paper.ts`

Compares screenshots with Paper designs:
- Design token validation
- Component-specific checks
- Manual inspection checklist
- HTML and Markdown reports

## 📊 Output Structure

```
screenshots/
├── index.html                          # Main interactive report
├── {component}__{theme}__{state}__{viewport}.png
├── components/                         # Isolated component screenshots
│   └── {component}__{theme}__{state}.png
├── storybook/                          # Storybook documentation
│   └── {category}__{component}__{theme}.png
└── comparison/                         # Comparison results
    ├── comparison-report.html          # Baseline comparison
    ├── paper-comparison.html           # Paper design comparison
    ├── paper-comparison.md             # Markdown report
    └── diff-*.png                      # Visual diffs
```

## 🎯 Test Coverage

### Views Captured
- ✅ Application Shell
- ✅ Git Panel (all states)
- ✅ Editor View (with autocomplete)
- ✅ Terminal (single/split)
- ✅ AI Chat (empty/messages/loading/error)
<!-- « Background Agents (list/detail/monitor) » retiré : composants supprimés
     (voir DIFFERENTIATION.md §2). Ces captures ne montraient de toute façon
     que la vue par défaut, la suite ne naviguant pas vers ces panneaux. -->
- ✅ Automations (list/editor/logs)
- ✅ Extensions & MCP (marketplace/config)
- ✅ Account & Settings
- ✅ Debug Panel (all tabs)
- ✅ Workspace Views (file explorer, docs, notes)

### Component States
- ✅ Default
- ✅ Hover
- ✅ Active/Pressed
- ✅ Focused
- ✅ Disabled
- ✅ Loading
- ✅ Error
- ✅ Success

### Themes
- ✅ Dark theme
- ✅ Light theme

### Viewports
- ✅ Desktop (1400x900)
- ✅ Laptop (1280x720)
- ✅ Wide (1920x1080)

## 🔄 CI/CD Integration

GitHub Actions workflow included:
- Runs on every PR
- Captures screenshots automatically
- Compares with baseline
- Comments on PR with results
- Uploads artifacts for manual review

**Location**: `.github/workflows/visual-regression.yml`

## 📖 Documentation

Full documentation available in:
- **[VISUAL_TESTING.md](./VISUAL_TESTING.md)** - Complete guide
- **[screenshots/README.md](./screenshots/README.md)** - Output directory info

## 🛠️ Next Steps

### Immediate
1. **Run the capture**:
   ```bash
   bun run screenshots:capture
   ```

2. **Review the report**:
   ```bash
   bun run screenshots:view
   ```

3. **Compare with Paper designs**:
   ```bash
   bun run screenshots:paper
   ```

### Manual Validation Required

Open Paper Cortex V3 designs and compare:

#### Design Tokens
- [ ] Colors match design system
- [ ] Typography (font-family, sizes, weights)
- [ ] Spacing values (margins, paddings)
- [ ] Border radius
- [ ] Shadow values

#### Components
- [ ] All states present
- [ ] Visual consistency
- [ ] Hover/active states
- [ ] Icon alignment
- [ ] Responsive behavior

#### Layout
- [ ] Alignment correct
- [ ] Proportions match
- [ ] Grid layout
- [ ] Overflow handling

#### Accessibility
- [ ] Contrast ratios sufficient
- [ ] Focus states visible
- [ ] Touch target sizes

### Found Issues?

Document them in `screenshots/comparison/paper-comparison.md`

## 🔧 Troubleshooting

See [VISUAL_TESTING.md](./VISUAL_TESTING.md#troubleshooting) for:
- App launch issues
- Empty screenshots
- Theme switching problems
- Component selector issues

## 📝 Scripts Reference

```json
{
  "screenshots:capture": "Full capture (all tests)",
  "screenshots:view": "Open HTML report",
  "screenshots:clean": "Delete all screenshots",
  "screenshots:baseline": "Save as baseline",
  "screenshots:compare": "Compare with baseline",
  "screenshots:paper": "Compare with Paper designs",
  "screenshots:visual": "App views only",
  "screenshots:components": "Components only",
  "screenshots:storybook": "Storybook only"
}
```

## 🎨 Paper Design Integration

The system is ready to integrate with Paper MCP for automated design validation:

1. **Token extraction** from Paper designs
2. **Automated comparison** of colors, spacing, typography
3. **Component matching** between code and design
4. **Diff visualization** with annotations

This requires Paper MCP server to be configured and accessible.

## 📚 Resources

- Playwright Documentation: https://playwright.dev
- Visual Testing Guide: [VISUAL_TESTING.md](./VISUAL_TESTING.md)
- Paper MCP: [Paper documentation](https://paper.dev)
