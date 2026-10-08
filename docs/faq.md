# FAQ

> [!WARNING]
> **Alpha software.** Cortex Desktop is not recommended for production use. Features can change or break between commits, nothing is guaranteed to be stable, and builds are **unsigned** (no code signing, no notarization). Back up anything you care about and expect rough edges.

**What is this?** A desktop app for Chat, Work, Bots and Code with a local agent engine. See the [README](../README.md).

**Is it production ready?** No. It's alpha. Features change or break, and there are no stability guarantees.

**Do I need an account?** No. Local mode needs only a provider key.

**Which providers work?** Anthropic, OpenAI, Google and OpenAI-compatible endpoints from the models.dev catalog ([providers](./providers.md)).

**Where are my keys?** In the main process credential store, never in the renderer. See [SECURITY.md](../SECURITY.md).

**Why do Bots need sign-in?** Bot screens talk to a Cortex Cloud account. Local mode doesn't show them.

**Which languages are supported?** `en fr es de ja zh-Hans pt-BR ko`. English is the default ([i18n](./i18n.md)).

**Why unsigned builds?** Release signing isn't configured yet.

**How do I report a bug or a vulnerability?** Bugs: GitHub issues. Vulnerabilities: privately, per [SECURITY.md](../SECURITY.md).

**How do I contribute?** [CONTRIBUTING.md](../CONTRIBUTING.md).
