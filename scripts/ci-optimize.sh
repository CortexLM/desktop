#!/bin/bash

# Cache optimization script for CI/CD

set -e

echo "🚀 Optimizing CI/CD caches..."

# 1. Bun cache optimization
echo "📦 Optimizing Bun cache..."
if [ -d "~/.bun/install/cache" ]; then
  echo "  Cache size: $(du -sh ~/.bun/install/cache | cut -f1)"
fi

# 2. Playwright cache optimization
echo "🎭 Checking Playwright cache..."
if [ -d "~/.cache/ms-playwright" ]; then
  echo "  Cache size: $(du -sh ~/.cache/ms-playwright | cut -f1)"
fi

# 3. Node modules optimization
echo "📚 Analyzing node_modules..."
if [ -d "node_modules" ]; then
  echo "  Size: $(du -sh node_modules | cut -f1)"
  echo "  Packages: $(ls node_modules | wc -l)"
fi

# 4. Build cache optimization
echo "🏗️  Build cache status..."
if [ -d "dist" ]; then
  echo "  Dist size: $(du -sh dist | cut -f1)"
fi

# 5. Test results cache
echo "🧪 Test results cache..."
if [ -d "coverage" ]; then
  echo "  Coverage size: $(du -sh coverage | cut -f1)"
fi

echo ""
echo "✅ Cache optimization complete!"
echo ""
echo "💡 Tips for faster CI:"
echo "  - Use cache@v4 with proper keys"
echo "  - Enable fail-fast: false for matrix jobs"
echo "  - Shard E2E tests across multiple runners"
echo "  - Use concurrency to cancel outdated runs"
echo "  - Cache Playwright browsers separately"
