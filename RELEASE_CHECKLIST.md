# Release Checklist

> **2026-04-29 update**: n8n's community-node release flow requires `@n8n/node-cli` + GitHub Actions publish + npm provenance, **mandatory from May 1 2026**. n8n auto-monitors npm for verified-node updates on a bi-weekly cadence; release notes from the CLI flow into n8n's Creator Portal.

## Release flow (current — v0.2.0+)

```bash
# Locally — bump version, update CHANGELOG, commit, tag, push, create GH Release.
# Does NOT publish to npm directly — that's left to GitHub Actions.
npm run release
```

The `release` script calls `n8n-node release` which:
1. Runs lint + build.
2. Prompts for version bump (patch / minor / major / custom).
3. Generates a CHANGELOG entry from commits.
4. Commits + tags (`X.Y.Z`, no `v` prefix per `.github/workflows/publish.yml`).
5. Pushes the tag.
6. Creates a GitHub Release with auto-generated notes.

The pushed tag triggers `.github/workflows/publish.yml` which:
1. Runs lint + build (again, in CI).
2. Publishes to npm with `--provenance` (signed by GitHub OIDC).

### One-time npm Trusted Publishing setup
1. Log in to npmjs.com → package settings → **Trusted Publishers** → Add a publisher.
2. Select GitHub Actions; fill in repo owner, repo name (`n8n-nodes-securevector`), workflow name (`publish.yml`), leave environment blank.
3. Leave `NPM_TOKEN` unset in GitHub repo secrets — OIDC handles auth.

### Fallback (if Trusted Publishing isn't set up)
Add `NPM_TOKEN` as a repo secret in GitHub. The workflow falls back to it automatically.

---

## Pre-flight (every release)

**BEFORE making repository public, verify:**

## Security ✅
- [x] No credentials in code
- [x] No secrets in git history  
- [x] Input validation enabled
- [x] Error messages don't expose internals
- [x] Peer dependency vulnerability documented in SECURITY.md

## Legal ✅
- [x] MIT LICENSE
- [x] DISCLAIMER.md comprehensive
- [x] README "AS-IS" warning prominent
- [x] No warranties or financial promises
- [x] NOTICE file with attributions
- [x] Trademark disclaimers

## Code Quality ✅
- [x] All tests pass (65/65)
- [x] Build succeeds
- [x] TypeScript compiles with no errors
- [x] ESLint passes
- [x] No TODO/FIXME in production code

## Documentation ✅
- [x] README.md simplified and clear
- [x] TEST_SETUP.md for local testing
- [x] CONTRIBUTING.md present
- [x] Examples provided (3 workflows)

## Pre-Release Testing
- [ ] Test local installation (`npm link`)
- [ ] Test non-blocking mode
- [ ] Test blocking mode  
- [ ] Test parallel mode
- [ ] Verify credential validation
- [ ] Test error scenarios

## Final Steps
- [ ] Run `npm pack` and inspect contents
- [ ] Verify `.npmignore` excludes source files
- [ ] Check `dist/` structure is correct
- [ ] Review git history for sensitive data
- [ ] Make repository public on GitHub
- [ ] Publish to npm: `npm publish --access public`
- [ ] Create GitHub release v0.1.0
- [ ] Submit to n8n community nodes registry

## Post-Release
- [ ] Monitor GitHub issues
- [ ] Watch npm download stats
- [ ] Respond to security reports within 48h
- [ ] Keep dependencies updated

---

**Approved for release**: YES ✅  
**Date**: December 27, 2025
