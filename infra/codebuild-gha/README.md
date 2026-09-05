# CodeBuild GitHub Actions runners (desktop)

Creates `cortex-gha-arm64` and `cortex-gha-x64` so long Linux Electron dist
jobs can use:

```text
codebuild-cortex-gha-arm64-${{ github.run_id }}-${{ github.run_attempt }}
```

Same project-name style as backend `cortex-gha-*`. This directory does not
touch `CortexLM/cortex`.

## Before apply

1. Create a **CodeConnections** GitHub App connection in the AWS account
   (`aws codeconnections create-connection` or the console). A PAT in git is
   not acceptable.
2. Put credentials in the environment with **GitHub OIDC**
   (`aws-actions/configure-aws-credentials`) or an already-assumed role.
   Do not run `aws sso login` (device code).
3. `terraform init && terraform apply -var='codeconnections_arn=arn:aws:codeconnections:…'`

Equivalent AWS CLI: `scripts/create-codebuild-gha-runner.sh`.

macOS and Windows Electron dist stay on GitHub-hosted runners. These projects
are Linux only.
