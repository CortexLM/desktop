# GitHub Actions runner projects. Workflow labels:
#   codebuild-cortex-gha-arm64-${{ github.run_id }}-${{ github.run_attempt }}
#   codebuild-cortex-gha-x64-${{ github.run_id }}-${{ github.run_attempt }}
# Same naming as backend cortex-gha-*. Webhook event is WORKFLOW_JOB_QUEUED.

locals {
  # Placeholder buildspec: GitHub Actions runner mode uses the workflow YAML.
  runner_buildspec = <<-EOT
    version: 0.2
    phases:
      build:
        commands:
          - echo "GitHub Actions runner; the workflow YAML is the build."
  EOT

  runners = {
    arm64 = {
      environment_type = "ARM_CONTAINER"
      image             = "aws/codebuild/amazonlinux-aarch64-standard:3.0"
    }
    x64 = {
      environment_type = "LINUX_CONTAINER"
      image             = "aws/codebuild/standard:7.0"
    }
  }
}

resource "aws_codebuild_project" "gha" {
  for_each      = local.runners
  name          = "cortex-gha-${each.key}"
  description   = "GitHub Actions runner for Cortex desktop Linux Electron dist (${each.key})"
  service_role  = aws_iam_role.codebuild_gha.arn
  build_timeout = var.build_timeout
  queued_timeout = var.queued_timeout

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = var.compute_type
    image                       = each.value.image
    type                        = each.value.environment_type
    privileged_mode             = false
    image_pull_credentials_type = "CODEBUILD"
  }

  source {
    type            = "GITHUB"
    location        = var.github_repository
    git_clone_depth = 1
    buildspec       = local.runner_buildspec

    auth {
      type     = "CODECONNECTIONS"
      resource = var.codeconnections_arn
    }
  }
}

resource "aws_codebuild_webhook" "gha" {
  for_each     = aws_codebuild_project.gha
  project_name = each.value.name
  build_type   = "BUILD"

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "WORKFLOW_JOB_QUEUED"
    }
  }
}
