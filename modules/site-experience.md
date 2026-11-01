# Site Experience Memory Module

> Part of browser-control skill. Load when needed, not by default.

Per-domain knowledge accumulated during operations. Stored in `~/.web-access/site-patterns/` — **outside the skill directory**, so skill upgrades and re-installs never lose it. `browser-control` and `web-access` share this single store (browser preference and site experience are the same user, same machine).

**Before operating on a known site**: Check if experience exists and load it.

```bash
ls ~/.web-access/site-patterns/ 2>/dev/null
# Or use the matcher (semantic aliases, incl. Chinese; ASCII aliases are word-bounded):
node "${SKILL_DIR}/scripts/match-site.mjs" "user input text"
```

The matcher prints the matching experience file path(s). Read the matched file before starting; if nothing matches, proceed with the general approach and record findings afterwards.

**After successfully operating on a site**: If you discovered new patterns worth recording (URL structure, platform characteristics, effective strategies, known traps), write them to the experience file. Only write verified facts, never unconfirmed guesses.

**Where to write**: `~/.web-access/site-patterns/{domain}.md`. Create the directory if missing. Never write into the skill directory — that copy is read-only skill content and is wiped on upgrade.

**File format:**
```markdown
---
domain: example.com
aliases: [示例, Example]
updated: 2026-03-29
---
## Platform Characteristics
Architecture, anti-scraping behavior, login requirements, content loading patterns

## Effective Patterns
Verified URL patterns, operational strategies, selectors

## Known Traps
What fails and why
```

Experience entries are date-stamped. Treat them as "likely valid hints" not "guaranteed facts." If following experience fails, fall back to general approach and update the experience file.

**Legacy files**: copies left in `references/site-patterns/` of the skill directory are auto-migrated to `~/.web-access/site-patterns/` once on first preflight (a `user-data:` line reports it, and a `.migrated` marker prevents repeats). After migration, the in-skill directory is no longer authoritative.

**Old API form**: if an experience file still documents `GET /new?url=…` or `GET /navigate?…&url=…`, that form now returns `400`. Rewrite it to the POST-body form (`curl -s -X POST --data-raw 'URL' http://localhost:3456/new`) while you are in the file. See `references/migration-2.5.3.md`.
