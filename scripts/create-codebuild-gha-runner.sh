#!/usr/bin/env bash
# Create CodeBuild GitHub Actions runner projects for Cortex desktop Linux dist.
#
# Projects: cortex-gha-arm64, cortex-gha-x64
# Labels:   codebuild-cortex-gha-<arch>-${{ github.run_id }}-${{ github.run_attempt }}
#
# Requires an already-authenticated AWS CLI (GitHub OIDC or exported keys).
# Does not run `aws sso login`. Does not store a GitHub PAT in this repo.
#
# Required env:
#   CODECONNECTIONS_ARN  GitHub App connection ARN
# Optional env:
#   AWS_REGION           default us-east-1
#   GITHUB_REPO_URL      default https://github.com/CortexLM/desktop.git
#   ARCHES               "arm64 x64" (default both)
set -euo pipefail

usage() {
  cat <<'EOF'
Create cortex-gha-arm64 and/or cortex-gha-x64 CodeBuild projects (GitHub Actions
runners) plus a WORKFLOW_JOB_QUEUED webhook. Same naming as backend cortex-gha-*.

  CODECONNECTIONS_ARN=arn:aws:codeconnections:... ./scripts/create-codebuild-gha-runner.sh

Credentials must already be in the environment. Prefer GitHub OIDC:

  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT:role/gha-oidc
    aws-region: us-east-1

Do not run aws sso login (device code). Terraform equivalent: infra/codebuild-gha/.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is not installed" >&2
  exit 1
fi

if [[ -z "${CODECONNECTIONS_ARN:-}" ]]; then
  echo "Set CODECONNECTIONS_ARN to a GitHub App CodeConnections ARN" >&2
  usage >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "No AWS credentials. Use GitHub OIDC or export a role. Do not aws sso login." >&2
  exit 1
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
GITHUB_REPO_URL="${GITHUB_REPO_URL:-https://github.com/CortexLM/desktop.git}"
ARCHES="${ARCHES:-arm64 x64}"
ROLE_NAME="codebuild-cortex-gha-role"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

BUILDSPEC='version: 0.2
phases:
  build:
    commands:
      - echo "GitHub Actions runner; the workflow YAML is the build."
'

assume_policy='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "codebuild.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$assume_policy" >/dev/null
fi

role_policy="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": [
        "arn:aws:logs:${AWS_REGION}:${ACCOUNT_ID}:log-group:/aws/codebuild/cortex-gha-*",
        "arn:aws:logs:${AWS_REGION}:${ACCOUNT_ID}:log-group:/aws/codebuild/cortex-gha-*:*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "codeconnections:GetConnection",
        "codeconnections:GetConnectionToken",
        "codeconnections:UseConnection",
        "codestar-connections:GetConnection",
        "codestar-connections:GetConnectionToken",
        "codestar-connections:UseConnection"
      ],
      "Resource": "${CODECONNECTIONS_ARN}"
    }
  ]
}
EOF
)"

aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name codebuild-cortex-gha \
  --policy-document "$role_policy" >/dev/null

create_project() {
  local arch="$1"
  local project="cortex-gha-${arch}"
  local env_type image
  case "$arch" in
    arm64)
      env_type="ARM_CONTAINER"
      image="aws/codebuild/amazonlinux-aarch64-standard:3.0"
      ;;
    x64)
      env_type="LINUX_CONTAINER"
      image="aws/codebuild/standard:7.0"
      ;;
    *)
      echo "Unknown arch ${arch} (want arm64 or x64)" >&2
      return 1
      ;;
  esac

  local source_json environment_json
  source_json="$(cat <<EOF
{
  "type": "GITHUB",
  "location": "${GITHUB_REPO_URL}",
  "gitCloneDepth": 1,
  "buildspec": $(python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<<"$BUILDSPEC"),
  "auth": {
    "type": "CODECONNECTIONS",
    "resource": "${CODECONNECTIONS_ARN}"
  }
}
EOF
)"
  environment_json="$(cat <<EOF
{
  "type": "${env_type}",
  "image": "${image}",
  "computeType": "BUILD_GENERAL1_XLARGE",
  "privilegedMode": false,
  "imagePullCredentialsType": "CODEBUILD"
}
EOF
)"

  if aws codebuild batch-get-projects --names "$project" \
      --query 'projects[0].name' --output text 2>/dev/null | grep -qx "$project"; then
    echo "Project ${project} already exists"
  else
    aws codebuild create-project \
      --name "$project" \
      --description "GitHub Actions runner for Cortex desktop Linux Electron dist (${arch})" \
      --source "$source_json" \
      --artifacts '{"type":"NO_ARTIFACTS"}' \
      --environment "$environment_json" \
      --service-role "$ROLE_ARN" \
      --timeout-in-minutes 180 \
      --queued-timeout-in-minutes 60 \
      --region "$AWS_REGION" >/dev/null
    echo "Created project ${project}"
  fi

  if aws codebuild batch-get-projects --names "$project" \
      --query 'projects[0].webhook.payloadUrl' --output text 2>/dev/null \
      | grep -vq 'None\|null'; then
    echo "Webhook already present on ${project}"
  else
    aws codebuild create-webhook \
      --project-name "$project" \
      --filter-groups '[[{"type":"EVENT","pattern":"WORKFLOW_JOB_QUEUED"}]]' \
      --region "$AWS_REGION" >/dev/null
    echo "Created WORKFLOW_JOB_QUEUED webhook on ${project}"
  fi

  echo "runs-on: codebuild-${project}-\${{ github.run_id }}-\${{ github.run_attempt }}"
}

export AWS_DEFAULT_REGION="$AWS_REGION"

for arch in $ARCHES; do
  create_project "$arch"
done
