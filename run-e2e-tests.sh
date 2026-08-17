#!/bin/bash

# Cortex IDE E2E Test Runner
# This script runs Playwright E2E tests with various options

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Cortex IDE E2E Test Runner${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if app is built
if [ ! -d "packages/main/dist" ]; then
  echo -e "${YELLOW}⚠️  Application not built. Building now...${NC}"
  bun run build
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Please fix build errors before running tests.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Application built successfully${NC}"
  echo ""
fi

# Parse arguments
MODE=${1:-"headless"}

case $MODE in
  "headless")
    echo -e "${GREEN}Running tests in headless mode...${NC}"
    playwright test
    ;;
  "headed")
    echo -e "${GREEN}Running tests in headed mode...${NC}"
    playwright test --headed
    ;;
  "debug")
    echo -e "${GREEN}Running tests in debug mode...${NC}"
    playwright test --debug
    ;;
  "ui")
    echo -e "${GREEN}Opening Playwright UI...${NC}"
    playwright test --ui
    ;;
  "report")
    echo -e "${GREEN}Opening test report...${NC}"
    playwright show-report test-results/html-report
    ;;
  "trace")
    echo -e "${GREEN}Opening trace viewer...${NC}"
    if [ -z "$2" ]; then
      echo -e "${RED}Please provide trace file path${NC}"
      echo "Usage: ./run-e2e-tests.sh trace <path-to-trace.zip>"
      exit 1
    fi
    playwright show-trace "$2"
    ;;
  "specific")
    if [ -z "$2" ]; then
      echo -e "${RED}Please provide test file path${NC}"
      echo "Usage: ./run-e2e-tests.sh specific <test-file-path>"
      exit 1
    fi
    echo -e "${GREEN}Running specific test: $2${NC}"
    playwright test "$2"
    ;;
  "grep")
    if [ -z "$2" ]; then
      echo -e "${RED}Please provide grep pattern${NC}"
      echo "Usage: ./run-e2e-tests.sh grep <pattern>"
      exit 1
    fi
    echo -e "${GREEN}Running tests matching: $2${NC}"
    playwright test --grep "$2"
    ;;
  "parallel")
    WORKERS=${2:-4}
    echo -e "${GREEN}Running tests with $WORKERS workers...${NC}"
    playwright test --workers=$WORKERS
    ;;
  "shard")
    if [ -z "$2" ]; then
      echo -e "${RED}Please provide shard info (e.g., 1/3)${NC}"
      echo "Usage: ./run-e2e-tests.sh shard <shard-index>/<total-shards>"
      exit 1
    fi
    echo -e "${GREEN}Running tests shard: $2${NC}"
    playwright test --shard=$2
    ;;
  "clean")
    echo -e "${YELLOW}Cleaning test results...${NC}"
    rm -rf test-results/
    rm -rf playwright-report/
    echo -e "${GREEN}✅ Test results cleaned${NC}"
    ;;
  "help"|"-h"|"--help")
    echo "Usage: ./run-e2e-tests.sh [mode] [options]"
    echo ""
    echo "Modes:"
    echo "  headless       Run tests in headless mode (default)"
    echo "  headed         Run tests with browser visible"
    echo "  debug          Run tests in debug mode"
    echo "  ui             Open Playwright UI"
    echo "  report         Open HTML test report"
    echo "  trace <file>   Open trace viewer with specific trace file"
    echo "  specific <file> Run specific test file"
    echo "  grep <pattern> Run tests matching pattern"
    echo "  parallel [N]   Run tests with N workers (default: 4)"
    echo "  shard <X/Y>    Run tests shard X of Y"
    echo "  clean          Clean test results"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run-e2e-tests.sh"
    echo "  ./run-e2e-tests.sh headed"
    echo "  ./run-e2e-tests.sh debug"
    echo "  ./run-e2e-tests.sh specific tests/e2e/specs/editor.spec.ts"
    echo "  ./run-e2e-tests.sh grep \"should open file\""
    echo "  ./run-e2e-tests.sh parallel 8"
    echo "  ./run-e2e-tests.sh shard 1/3"
    echo "  ./run-e2e-tests.sh trace test-results/traces/trace.zip"
    ;;
  *)
    echo -e "${RED}Unknown mode: $MODE${NC}"
    echo "Run './run-e2e-tests.sh help' for usage information"
    exit 1
    ;;
esac

if [ $? -eq 0 ] && [ "$MODE" != "report" ] && [ "$MODE" != "trace" ] && [ "$MODE" != "clean" ] && [ "$MODE" != "help" ]; then
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  Tests completed successfully!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "View HTML report: ${YELLOW}./run-e2e-tests.sh report${NC}"
  echo -e "View traces: ${YELLOW}playwright show-trace test-results/traces/*.zip${NC}"
fi
