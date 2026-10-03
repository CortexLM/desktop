# Documentation review resolution

The [independent review](documentation-review.md) identified three stale scope statements
in `evidence/STATUS.md`; all are corrected in this documentary follow-up:

- The 00:32 SDK readback is historical. SDK 0.3.5/API-types 0.2.0 against `c8f6a7f0` is
  admitted; discarded-frame observability requires a new pinned owner delivery.
- Main-only email-code sign-in is live. Unsupported continuations remain unavailable;
  real Cloud account/inference acceptance is still unproven.
- Independent package provenance is described as package verification. Installed runtime
  assertions, native images and their independent audit have separate receipts.

The later CI audit verifies 107 cases/426 renders per OS, 284 unique images and 28 full-size
views. Its report supersedes the review's accurate-at-the-time pending-audit wording.
All 284 retained canonical images pass SHA-256 and decoded-RGBA verification.
No application, test, workflow or dependency bytes differ from `2956564`.
