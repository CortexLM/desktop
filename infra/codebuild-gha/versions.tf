terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.40.0"
    }
  }
}

# Local state by default. Point this at the same backend the Cortex API
# `cortex-gha-*` projects use when that remote is available. Do not commit
# tfstate.
provider "aws" {
  region = var.aws_region
}
