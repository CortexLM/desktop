variable "aws_region" {
  type        = string
  description = "Region for the CodeBuild GitHub Actions runner projects."
  default     = "us-east-1"
}

variable "github_repository" {
  type        = string
  description = "HTTPS URL of CortexLM/desktop. CodeBuild clones this to start the runner; the workflow checks out again."
  default     = "https://github.com/CortexLM/desktop.git"
}

variable "codeconnections_arn" {
  type        = string
  description = "CodeConnections (GitHub App) ARN. Do not use a PAT in git. Do not use aws sso login."
}

variable "compute_type" {
  type        = string
  description = "CodeBuild compute. Electron dist needs disk; XLARGE is the floor."
  default     = "BUILD_GENERAL1_XLARGE"
}

variable "build_timeout" {
  type        = number
  description = "Minutes before a queued-or-running Electron dist is killed."
  default     = 180
}

variable "queued_timeout" {
  type        = number
  description = "Minutes to wait for a runner to start. Fail closed if the project is missing."
  default     = 60
}
