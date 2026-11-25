---
name: Auth model
description: Why there is no self-service signup and why the first admin is bootstrapped from a secret
---

Sign-in is server-side email/password only; self-service company registration was deliberately not built.

**Why:** the login screen used to be a client-only mockup. During a security hardening pass the user wanted vulnerabilities fixed without new flows, and seeded demo users have no passwords, so the first Manager is bootstrapped from a secret instead of a signup flow.

**How to apply:** if asked to add signup/SSO, treat it as a new feature decision, not a bug fix. Never let a non-privileged caller set role or password; anything that writes those must stay Manager/Admin-gated.
