# E2E Test CI Configuration Examples

## GitHub Actions

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    name: Run E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 60
    
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Install Playwright browsers
        run: bunx playwright install chromium
      
      - name: Build application
        run: bun run build
      
      - name: Run E2E tests (shard ${{ matrix.shard }}/3)
        run: bun run test:e2e --shard=${{ matrix.shard }}/3
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report-${{ matrix.shard }}
          path: test-results/
          retention-days: 30
      
      - name: Upload HTML report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: html-report-${{ matrix.shard }}
          path: test-results/html-report/
          retention-days: 30

  merge-reports:
    name: Merge Test Reports
    if: always()
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - name: Download all reports
        uses: actions/download-artifact@v3
      
      - name: Merge reports
        run: |
          mkdir -p merged-reports
          # Merge logic here
      
      - name: Publish report
        uses: actions/upload-artifact@v3
        with:
          name: merged-playwright-report
          path: merged-reports/
```

## GitLab CI

```yaml
stages:
  - build
  - test
  - report

variables:
  NODE_ENV: "test"

cache:
  paths:
    - node_modules/
    - .bun/

build:
  stage: build
  image: oven/bun:latest
  script:
    - bun install
    - bun run build
  artifacts:
    paths:
      - packages/*/dist/
    expire_in: 1 hour

test:e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  parallel: 3
  needs:
    - build
  script:
    - bun install
    - bunx playwright install chromium
    - bun run test:e2e --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
  artifacts:
    when: always
    paths:
      - test-results/
    expire_in: 1 week
  only:
    - main
    - develop
    - merge_requests

report:
  stage: report
  image: alpine:latest
  needs:
    - test:e2e
  script:
    - echo "Test report generated"
  artifacts:
    paths:
      - test-results/html-report/
    expire_in: 1 month
  when: always
```

## Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        NODE_ENV = 'test'
    }
    
    stages {
        stage('Install Dependencies') {
            steps {
                sh 'bun install'
            }
        }
        
        stage('Build Application') {
            steps {
                sh 'bun run build'
            }
        }
        
        stage('Install Playwright') {
            steps {
                sh 'bunx playwright install chromium'
            }
        }
        
        stage('Run E2E Tests') {
            parallel {
                stage('Shard 1') {
                    steps {
                        sh 'bun run test:e2e --shard=1/3'
                    }
                }
                stage('Shard 2') {
                    steps {
                        sh 'bun run test:e2e --shard=2/3'
                    }
                }
                stage('Shard 3') {
                    steps {
                        sh 'bun run test:e2e --shard=3/3'
                    }
                }
            }
        }
    }
    
    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'test-results/html-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Test Report'
            ])
            
            archiveArtifacts artifacts: 'test-results/**/*', allowEmptyArchive: true
        }
    }
}
```

## CircleCI

```yaml
version: 2.1

orbs:
  bun: oven/bun@1.0.0

executors:
  playwright-executor:
    docker:
      - image: mcr.microsoft.com/playwright:v1.40.0-focal

jobs:
  build:
    executor: playwright-executor
    steps:
      - checkout
      - bun/install
      - run:
          name: Build application
          command: bun run build
      - persist_to_workspace:
          root: .
          paths:
            - packages/*/dist

  test-e2e:
    executor: playwright-executor
    parallelism: 3
    steps:
      - checkout
      - attach_workspace:
          at: .
      - bun/install
      - run:
          name: Install Playwright
          command: bunx playwright install chromium
      - run:
          name: Run E2E tests
          command: |
            SHARD_INDEX=$((CIRCLE_NODE_INDEX + 1))
            bun run test:e2e --shard=$SHARD_INDEX/$CIRCLE_NODE_TOTAL
      - store_artifacts:
          path: test-results
      - store_test_results:
          path: test-results

workflows:
  test:
    jobs:
      - build
      - test-e2e:
          requires:
            - build
```

## Docker Setup for CI

```dockerfile
# Dockerfile.test
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Copy package files
COPY package.json bun.lockb ./
COPY packages/*/package.json ./packages/

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build application
RUN bun run build

# Install Playwright browsers
RUN bunx playwright install chromium

# Run tests
CMD ["bun", "run", "test:e2e"]
```

```yaml
# docker-compose.test.yml
version: '3.8'

services:
  e2e-tests:
    build:
      context: .
      dockerfile: Dockerfile.test
    volumes:
      - ./test-results:/app/test-results
    environment:
      - NODE_ENV=test
      - CI=true
```

## Local Development CI Simulation

```bash
#!/bin/bash
# simulate-ci.sh - Simulate CI environment locally

echo "🚀 Simulating CI environment..."

# Clean previous builds
echo "🧹 Cleaning..."
rm -rf packages/*/dist test-results/

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Build application
echo "🔨 Building application..."
bun run build

# Install Playwright
echo "🎭 Installing Playwright..."
bunx playwright install chromium

# Run tests with sharding
echo "🧪 Running E2E tests with sharding..."

bun run test:e2e --shard=1/3 &
PID1=$!

bun run test:e2e --shard=2/3 &
PID2=$!

bun run test:e2e --shard=3/3 &
PID3=$!

# Wait for all shards to complete
wait $PID1 $PID2 $PID3

echo "✅ All test shards completed!"
echo "📊 View report: bun run test:e2e:report"
```
