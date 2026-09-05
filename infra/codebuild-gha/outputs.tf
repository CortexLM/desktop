output "project_names" {
  value       = [for p in aws_codebuild_project.gha : p.name]
  description = "CodeBuild project names. Workflow runs-on must be codebuild-<name>-<run_id>-<run_attempt>."
}

output "role_arn" {
  value       = aws_iam_role.codebuild_gha.arn
  description = "Service role assumed by CodeBuild. Trust is codebuild.amazonaws.com, not GitHub OIDC."
}

output "runner_labels" {
  value = {
    for key, project in aws_codebuild_project.gha :
    key => "codebuild-${project.name}-\${{ github.run_id }}-\${{ github.run_attempt }}"
  }
  description = "Exact GitHub Actions runs-on labels for each arch."
}
