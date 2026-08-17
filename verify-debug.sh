#!/bin/bash

# Debug System Verification Script
# Run this to verify the debug system is properly installed

echo "🔍 Cortex IDE - Debug System Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check counters
TOTAL_CHECKS=0
PASSED_CHECKS=0

check_file() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}✗${NC} $1 (MISSING)"
    fi
}

check_dir() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}✗${NC} $1/ (MISSING)"
    fi
}

echo "📁 Checking Core Infrastructure..."
echo ""

# Shared package
echo "Shared Package:"
check_file "packages/shared/src/logger.ts"
check_file "packages/shared/src/types/debug.ts"

echo ""

# Main process
echo "Main Process:"
check_file "packages/main/src/services/debug-service.ts"
check_file "packages/main/src/services/ipc-monitor.ts"
check_file "packages/main/src/services/performance-monitor.ts"
check_file "packages/main/src/ipc/handlers/debug-handlers.ts"
check_file "packages/main/src/debug.ts"

echo ""

# Renderer process
echo "Renderer Process:"
check_dir "packages/renderer/src/views/debug"
check_file "packages/renderer/src/views/debug/DebugPanel.tsx"
check_file "packages/renderer/src/views/debug/ConsolePanel.tsx"
check_file "packages/renderer/src/views/debug/IPCInspector.tsx"
check_file "packages/renderer/src/views/debug/PerformancePanel.tsx"
check_file "packages/renderer/src/views/debug/MemoryPanel.tsx"
check_file "packages/renderer/src/views/debug/SettingsPanel.tsx"
check_file "packages/renderer/src/components/ErrorBoundary.tsx"
check_file "packages/renderer/src/contexts/DebugContext.tsx"
check_file "packages/renderer/src/utils/error-handlers.ts"

echo ""

# Documentation
echo "📚 Documentation:"
check_file "DEBUG.md"
check_file "DEBUG_QUICKSTART.md"
check_file "DEBUG_IMPLEMENTATION.md"
check_file "DEBUG_FILES.md"

echo ""
echo "=========================================="
echo -e "Results: ${GREEN}${PASSED_CHECKS}${NC}/${TOTAL_CHECKS} checks passed"

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✅ All files verified successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: DEBUG=true npm run dev"
    echo "  2. Press: Cmd/Ctrl+Shift+D to open Debug Panel"
    echo "  3. Read: DEBUG_QUICKSTART.md for examples"
    exit 0
else
    echo -e "${RED}❌ Some files are missing!${NC}"
    echo ""
    echo "Please check the output above for missing files."
    exit 1
fi
