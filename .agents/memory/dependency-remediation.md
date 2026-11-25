---
name: Dependency remediation
description: Why the Drizzle tooling needs a scoped esbuild override and how to verify it
---

Keep the esbuild override scoped to Drizzle's obsolete loader rather than forcing one esbuild version across all tools.

**Why:** The latest stable Drizzle tooling still depends on an abandoned loader pinned to a vulnerable esbuild release. Vite and tsx require different esbuild versions. Updating or deduplicating an existing npm lockfile did not reliably apply the scoped override; removing and re-adding the parent tooling did.

**How to apply:** Reassess the override when upgrading Drizzle tooling. Verify the installed dependency tree, audit, schema loading, and build rather than assuming that declaring an override replaced every vulnerable copy.
