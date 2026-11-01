---
name: browser-control
description: "Full browser control skill for AI agents. Multi-channel web access (search, fetch, Jina, CDP) with real Chrome session inheritance. Read, click, fill, upload, screenshot — including pages behind authentication. Three-layer safety system. Sub-agent parallel dispatch. Site experience memory. Auto-detects macOS, Windows, and Linux."
argument-hint: "<url or action>"
license: MIT
version: "3.0.0"
metadata:
  remixed-from:
    - {name: "browser-control-skill", author: "d-wwei", version: "1.0", url: "https://github.com/d-wwei/browser-control-skill"}
    - {name: "web-access", author: "一泽Eze", version: "2.4.1", url: "https://github.com/eze-is/web-access"}
---

<!-- Update check preamble — runs once per session, <5ms from cache -->
```bash
if command -v npx &>/dev/null; then
  _UK_DIR="${SKILL_DIR:-$(cd "$(dirname "$0")" && pwd)}"
  _UK_JSON=$(npx update-kit check --json --config "$_UK_DIR/../../update-kit.config.json" 2>/dev/null || echo '{}')
  _UK_KIND=$(echo "$_UK_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('kind',''))" 2>/dev/null || echo "")
  if [ "$_UK_KIND" = "upgrade_available" ]; then
    _UK_VER=$(echo "$_UK_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('latest',''))" 2>/dev/null)
    echo "Browser Control Skill update available: $_UK_VER — run: cd ~/.claude/skills/browser-control && npx update-kit apply"
  fi
fi
```

# Browser Control

Control the user's real Chrome browser with full login session inheritance. Multi-channel web access — from lightweight search to full CDP browser automation — with three-layer safety, sub-agent parallel dispatch, and site experience memory.

## When to Use

- Access any web page — public or behind corporate authentication (SSO, MFA, security gateways)
- Search, fetch, and extract information from the web
- Automate browser interactions: clicking, form filling, navigation, file upload
- Read content from dynamic pages (SPA, lazy-load, infinite scroll, virtual DOM)
- Write operations: compose messages, submit forms, upload files on web apps
- Rich interactions: React/Vue apps, rich text editors, file pickers, dropdowns
- Parallel research: dispatch sub-agents to investigate multiple targets simultaneously

## Companion Sub-Skill: Web Search

For enhanced public web search, the companion **web-search** sub-skill (powered by [omni-search-skill](https://github.com/d-wwei/omni-search-skill)) provides multi-engine search, fetch, resolve, and crawl — stronger than built-in WebSearch/WebFetch.

On first use, check availability:

```bash
OMNI_SEARCH_DIR="${OMNI_SEARCH_DIR:-$(find ~ -maxdepth 4 -type d -name 'omni-search-skill' 2>/dev/null | head -1)}"
[ -n "$OMNI_SEARCH_DIR" ] && [ -f "$OMNI_SEARCH_DIR/scripts/omni_search.py" ] && echo "available" || echo "not installed"
```

If not installed, suggest once:

> 💡 For enhanced web search, consider installing omni-search-skill:
> `git clone https://github.com/d-wwei/omni-search-skill.git && cd omni-search-skill && python3 -m pip install -r requirements.txt`

Do not block on this — built-in multi-channel tools (WebSearch → WebFetch → Jina → curl → CDP) work without it. Only suggest once per session.

---

## Browsing Philosophy

**Browse like a human — goal-driven, adaptive, evidence-based.**

Do not over-plan steps upfront. Enter with a clear goal, observe the page, decide the next action based on what you see, handle obstacles as they arise, and dig deeper when content is insufficient. Every decision traces back to: "Am I getting closer to what the user needs?"

### The Four Phases

**1. Understand** — Clarify what the user wants. Define success: what information, what action, what result? This anchors all subsequent decisions.

**2. Enter** — Choose the most direct entry point for the task. Consider platform characteristics and success criteria. If login is needed or static methods are known to fail (e.g., Xiaohongshu, WeChat), go straight to CDP.

**3. Verify** — Every result is evidence, not just pass/fail. Compare against the success criteria from phase 1. Is the path progressing? Is the quality, relevance, and completeness pointing toward the goal? If direction is wrong, pivot immediately — don't retry the same approach hoping for different results. Search misses don't always mean "wrong query" — they might mean "target doesn't exist." API errors, missing DOM elements, unchanged results after retry: these all signal "reassess direction."

**4. Complete** — Check against the defined success criteria. Stop when done. Don't over-operate for the sake of "completeness."

### Step-by-Step Reasoning (EOPA)

Before each browser action, follow this mental model:

**E — EVALUATE**: What happened after my last action? Did it succeed?
- If I navigated: did the URL change? Is the page loaded?
- If I clicked: did anything change on the page?
- If I typed: is the text visible in the field?

**O — OBSERVE**: What does the current page state tell me?
- Read page content or check the current URL
- What interactive elements are available?
- Am I on the right page for the user's goal?

**Auto-snapshot rules** — decide whether to re-read:
- Last action was **read-only** (get text, get URL, list elements) → page state unchanged, **skip re-read**
- Last action was **click / navigate / submit / scroll-that-loads** → page state likely changed, **must re-read**
- You already have the **exact selector or element index** → **operate directly**, no need to list all elements first
- **Never** execute the same read command twice consecutively

**P — PLAN**: What is the single next action needed?
- Do I need to scroll to reveal more content?
- Do I need to wait for something to load?
- Which specific element should I interact with?

**A — ACT**: Execute exactly ONE browser action, then return to E.

---

## Multi-Channel Web Access

Choose the lightest tool that gets the job done. Escalate only when lighter tools fail.

| Scenario | Tool | Notes |
|----------|------|-------|
| Search snippets, discover sources | **WebSearch** | Discovery only — not proof of truth |
| Known URL, extract specific info | **WebFetch** | Small model processes content per your prompt |
| Known URL, need raw HTML (meta, JSON-LD) | **curl** | Direct, fast |
| Known URL, convert to Markdown (save tokens) | **Jina** (`r.jina.ai/example.com`) | 20 RPM limit; best for articles/docs |
| Dynamic content, anti-scraping sites | **CDP Browser** | Full browser rendering |
| Login required, interactive operations | **CDP Browser** | Inherits real session |

**Jina usage**: Prefix URL without `http(s)://` — e.g., `curl -s https://r.jina.ai/example.com`. Great for articles, blogs, documentation. May extract wrong sections on dashboards or product pages.

**Escalation principle**: When multiple search attempts show no quality improvement, escalate to primary sources (official sites, original pages) via CDP.

**Information integrity**: Search engines are discovery tools, not proof. Primary sources (official sites, original documents, source code) outweigh secondary reports. Multiple media citing the same error creates circular confirmation — always trace to origin.

### Programmatic vs GUI Interaction

Inside the browser, two approaches:

- **Programmatic** (construct URL, eval DOM): Fast and precise when it works, but sites may detect non-human behavior and trigger anti-scraping.
- **GUI interaction** (click buttons, fill inputs, scroll): Designed for humans — sites never restrict normal UI operations. Reliable fallback.

When programmatic access fails, GUI interaction is the dependable fallback. Site-generated links (DOM hrefs) carry full context; manually constructed URLs may miss implicit parameters.

---

## Platform Detection

Before executing any command, detect the platform:

```bash
uname -s
```

- **Darwin** → macOS → AppleScript (basic) + CDP Proxy (advanced)
- **Linux** → CDP Proxy
- **MINGW* / CYGWIN* / MSYS* / Windows_NT** → CDP Proxy (+ optional agent-browser)

---

## Preflight Check

### macOS AppleScript Preflight

```bash
# Check Chrome is running and JS access is enabled
osascript -e 'tell application "Google Chrome" to get name'
osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "document.title"'
```

If the second command fails: Chrome → View → Developer → Allow JavaScript from Apple Events (中文: 查看 → 开发者 → 允许 Apple 事件中的 JavaScript).

### CDP Preflight (All Platforms)

```bash
node "${SKILL_DIR}/scripts/check-deps.mjs"
# (`bash "${SKILL_DIR}/scripts/check-deps.sh"` is a thin wrapper over the same entry point)
```

The script requires Node.js 22+, reuses a healthy running proxy, and only then discovers the browser and starts the proxy in the background. Handle its exit codes:

- `0` → ready. Call the proxy API directly; never start or restart the proxy yourself.
- `2` → no browser configured and no reusable shared service → first-time setup (below).
- `1` → follow the stdout message. If it contains 「Agent 处理顺序」, follow those steps (e.g. open the browser first, then retry) — self-resolvable cases shouldn't bother the user. “配置错误” only needs the config fixed; never stop or restart the shared service for it.

**Browser = its user-data directory.** `WEB_ACCESS_BROWSER` in `~/.web-access/config.env` holds a data-dir path — the level containing `Local State` (e.g. `~/Library/Application Support/Dia/User Data`). Any Chromium browser works; legacy values `chrome` / `chrome-canary` / `chromium` / `edge` still map to the standard directories per platform. Only that directory's `DevToolsActivePort` is read: no port scanning, no browser switching, hard error when unreachable. `--browser <path>` overrides for one run without writing config.

**Chrome remote debugging setup**: Open `chrome://inspect/#remote-debugging` in Chrome (Edge: `edge://inspect/#remote-debugging`), check "Allow remote debugging for this browser instance", restart the browser if needed.

**First-time setup** (`exit 2`): the script lists only the top-level folder names under the OS application-data root. Recognise the Chromium browser from those names, probe it with `node "${SKILL_DIR}/scripts/browser-probe.mjs" <folder> [...]`, then **ask the user which one to use — even if there is only one** — and write the chosen data dir into `~/.web-access/config.env`.

**User data** (`config.env`, `site-patterns/`) lives in `~/.web-access/`, outside the skill dir, so upgrades never lose it. Legacy in-skill copies are auto-migrated once on first run (a `user-data:` line reports it).

**Maintenance** — the proxy is a shared long-lived service. Never restart it because you changed code, are waiting on a connection, or finished a task. Use the cross-platform command when you genuinely need to:

```bash
node "${SKILL_DIR}/scripts/proxy-maintenance.mjs" status
node "${SKILL_DIR}/scripts/proxy-maintenance.mjs" restart
```

It refuses to stop while requests, commands, managed tabs, or a connection attempt are in flight. Exit codes: `0` ok / `2` busy, identity conflict or migration needed / `3` started but not yet connected (`waitingAuthorization`).

### Risk Notice (show once per session, before site operations)

After preflight passes, show this to the user verbatim before operating on any site:

```
温馨提示：部分站点对浏览器自动化操作检测严格，存在账号封禁风险。已内置防护措施但无法完全避免，Agent 继续操作即视为接受。
```

---

## Mode Routing

This skill operates in two modes. The `/browse` command handles routing automatically, but the logic is documented here for all agents.

### Two Modes

**Foreground (`here`)** — macOS AppleScript, operates on user's visible page
- Targets `front window` → `active tab` — the page the user is looking at
- User sees every action in real time
- Zero dependencies beyond Chrome
- Single-page, supervised operations

**Background (`bg`)** — CDP Proxy, operates in background tabs
- Creates its own tabs, never touches user's tabs
- User continues browsing normally, zero disruption
- Supports sub-agent parallel dispatch
- Required for advanced write operations (keyboard, upload, hover, isTrusted)

### Routing Decision

```
Platform is macOS?
├─ NO → background (CDP only option)
└─ YES
    ├─ User references current page? ("这个页面", "current tab", etc.)
    │   → foreground
    ├─ Multiple targets or parallel work? ("同时", "simultaneously", etc.)
    │   → background
    ├─ Implies don't-disturb? ("后台", "background", etc.)
    │   → background
    ├─ Needs keyboard/upload/isTrusted/hover?
    │   → background
    └─ DEFAULT → background
```

### Escalation Within Foreground Mode

If a foreground (AppleScript) operation fails:
1. Try React-compatible event dispatch (still AppleScript)
2. Still fails → auto-start CDP Proxy, switch to CDP for that operation
3. Simple reads can stay on AppleScript even after one operation escalated

### Operation-Level Reference

| Task | Foreground | Background |
|------|-----------|------------|
| Read page text/HTML | AppleScript JS eval | CDP `/eval` |
| Click links, basic form fill | AppleScript JS click | CDP `/click` |
| Navigate | AppleScript new tab | CDP `/new` (POST body) |
| Upload files | — (escalate to CDP) | CDP `/setFiles` or helper |
| Rich text editors | — (escalate to CDP) | CDP helper `type` |
| Sites checking `isTrusted` | — (escalate to CDP) | CDP `/clickAt` |
| Keyboard shortcuts | — (escalate to CDP) | CDP helper `key` |
| Hover-triggered menus | — (escalate to CDP) | CDP helper `hover` |
| Cross-process iframes | Not possible | CDP `/frames` + `/eval?frame=` or `/clickXY` |
| Parallel multi-target | Not possible | Sub-agent dispatch |

**Local CLI helpers** (BCS-only, absent upstream): `scripts/browse-cmd.sh <new|navigate|eval|click|frames|clickxy|…>` is a shortcut over the same proxy endpoints; `scripts/cdp-helper.py <key|type|upload|select|hover>` covers the write operations in `modules/cdp-write-ops.md`. Both are optional — every one of them has an equivalent raw `curl` form in `modules/cdp-proxy-api.md`, which is the reference of record.

---

## Element Targeting Priority

### macOS (AppleScript)
1. **Element index** — inject `List Interactive Elements`, then use `window.__interactiveElements[index]` (most reliable)
2. **Text content match** — most readable for buttons/links
3. **CSS selector** — for form inputs, specific elements
4. **Coordinates** — last resort, fragile across screen sizes

### CDP (All Platforms)
1. **CSS selector** via `/click` — simple JS click, fast
2. **CDP mouse event** via `/clickAt` — trusted, bypasses anti-automation
3. **JS eval** — for complex targeting logic
4. **Frame-scoped eval** via `/frames` + `/eval?frame=` — reach into same- or cross-process iframes by DOM
5. **Viewport coords** via `/clickXY` — required when the target sits in a cross-process iframe; also the last resort when no selector can reach the element

---

## macOS AppleScript Quick Reference

Zero-dependency browser control via macOS native AppleScript. **Full reference**: `modules/applescript-commands.md`

```bash
# Get current URL
osascript -e 'tell application "Google Chrome" to return URL of active tab of front window'
# Get page text
osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "document.body.innerText.substring(0, 15000)"'
# Open URL in new tab
osascript -e 'tell application "Google Chrome" to tell front window to make new tab with properties {URL:"https://example.com"}'
# Click by CSS selector
osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "document.querySelector(\"#submit-btn\").click()"'
# Execute arbitrary JavaScript
osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "YOUR_JS_CODE_HERE"'
```

For JXA tab targeting and MutationObserver-based element waiting, see `modules/advanced-applescript.md`.

---

## CDP Proxy Quick Reference

HTTP-to-CDP bridge proxy for the user's daily Chrome. **Full reference**: `modules/cdp-proxy-api.md`

```bash
# Create new background tab — URL in POST body, never URL-encoded
curl -s -X POST --data-raw 'https://example.com' http://localhost:3456/new
# Execute JS
curl -s -X POST "http://localhost:3456/eval?target=ID" -d 'document.title'
# Execute JS inside an iframe (frameId from /frames)
curl -s -X POST "http://localhost:3456/eval?target=ID&frame=FRAME_ID" -d 'document.body.innerText'
# List iframes (incl. cross-process, which the parent page cannot read)
curl -s "http://localhost:3456/frames?target=ID"
# JS click
curl -s -X POST "http://localhost:3456/click?target=ID" -d 'button.submit'
# Real mouse click at viewport coords (reaches cross-process iframes)
curl -s "http://localhost:3456/clickXY?target=ID&x=120&y=90"
# Navigate (URL in POST body, target in query)
curl -s -X POST --data-raw 'https://example.com' "http://localhost:3456/navigate?target=ID"
# Close tab
curl -s "http://localhost:3456/close?target=ID"
# Screenshot
curl -s "http://localhost:3456/screenshot?target=ID&file=/tmp/shot.png"
```

Setup: `node "${SKILL_DIR}/scripts/check-deps.mjs"` — proxy listens on `localhost:3456`.

> **v2.5.3 migration**: `GET /new?url=…` and `GET /navigate?target=…&url=…` are gone (they truncated target URLs carrying `&` in their own query, silently dropping e.g. `xsec_token`). All arbitrary-string payloads now travel in the POST body. Any site-experience file still using the old form gets a `400` with guidance — fix the source file in place. See `references/migration-2.5.3.md`.

---

## Security Boundaries (Summary)

Three-layer safety system. **Full reference with injectable scripts**: `modules/safety-system.md`

**Layer 1 — Domain Blacklist** (read-only, no interactions):
- Banking: chase, wellsfargo, bankofamerica, citi, capitalone, usbank, pnc, tdbank, hsbc, any `.bank`
- Payments: paypal, venmo, stripe, squareup, wise, revolut, robinhood, coinbase, binance
- Identity/Auth: `accounts.google.com`, `login.microsoftonline.com`, `login.live.com`, `icloud.com/account`, `*.okta.com`, `*.auth0.com`, `*.onelogin.com`
- Cloud: `console.aws.amazon.com`, `console.cloud.google.com`, `portal.azure.com`
- Chrome: `chrome://`, `chrome-extension://`, `about:`

**Layer 2 — Element Protection**: Never interact with password fields (`input[type=password]`, `*[name*=password]`, `*[autocomplete=*-password]`). Never click payment buttons (pay, purchase, buy, checkout, place order, **confirm payment, submit order**, subscribe, **upgrade, donate**, 付款, 支付, 购买, 下单, **确认订单, 立即购买**). Full keyword list: `modules/safety-system.md`

**Layer 3 — Operation Confirmation**: Confirm with user before: form submissions, submit/send/post/publish/create/delete/remove actions, file uploads to external services, actions on unvisited pages.

**General**: No untrusted JS in authenticated sessions. `chrome://` shadow DOM is inaccessible. Cross-origin iframes cannot be accessed. Confirm before extracting sensitive financial/medical data.

---

## Parallel Research: Sub-Agent Dispatch

Dispatch sub-agents for parallel execution when a task has multiple independent targets.

**Full reference**: `modules/parallel-dispatch.md` — load when you have multiple independent targets to research in parallel.

---

## Site Experience Memory

Per-domain knowledge for known sites — load patterns, check experience, record new findings.

**Full reference**: `modules/site-experience.md` — load when operating on a site with known patterns.

---

## Login Handling

The user's daily Chrome naturally carries login sessions. Most commonly used sites are already logged in.

**Core question**: Did I get the target content?

Open the page and try to get content first. Only if content is inaccessible and login would solve it:
> "This page requires login to access [specific content]. Please log into [site name] in your Chrome, then tell me to continue."

After login, no restart needed — just refresh the page.

---

## Information Verification

| Information Type | Primary Source |
|-----------------|---------------|
| Policy/regulation | Issuing authority's official site |
| Corporate announcement | Company's official news page |
| Academic claim | Original paper / institutional site |
| Tool capability/usage | Official docs, source code |

When official source is unavailable, authoritative media (original reporting, not syndicated) serves as secondary evidence — but inform the user: "Official source not found. The following is from [media name] reporting; transcription error possible."

---

## Best Practices

1. **Smart wait**: Prefer `Wait for Element` over blind `sleep`. Fall back to `sleep 2` only when no specific condition is available.
2. **Scroll before interacting**: Off-screen elements may fail to click.
3. **Confirm actions succeeded**: After navigate → check URL. After click → check content. After fill → verify value.
4. **One action at a time**: Execute one action, observe, then decide next.
5. **Paginate long content**: Use `.substring(start, end)` to read in chunks.
6. **Prefer scrolling for lazy-load**: Scroll the real page first rather than switching strategies.
7. **Avoid redundant reads**: Don't re-read after read-only actions. If you know the selector, operate directly.
8. **Safety check on unfamiliar pages**: Inject the safety check before interacting.
9. **Verify each field after filling**: Read back values. React/Vue may silently reject `el.value`.
10. **Escalate progressively**: AppleScript → CDP Proxy → CDP helper. Only escalate when simpler mode fails.
11. **Screenshot before irreversible actions**: Capture state before Submit/Send/Delete.
12. **Coordinates expire**: After scroll/reflow/dropdown, re-query positions before CDP click.
13. **Tab hygiene**: Never navigate in user's tabs. Create and close your own.
14. **Proxy stays running**: Don't stop the proxy — restarting requires Chrome re-authorization.

## Recovery Strategy

If a browser action fails:

1. **Observe**: Read content or screenshot to understand current state
2. **Re-index**: Page may have changed — refresh element references
3. **Alternative targeting**: CSS selector failed → try text match. Text match failed → try different selector
4. **Check for overlays**: Dialogs, cookie banners, modals may be blocking — dismiss them first
5. **Don't retry blindly**: Never repeat the same failed action >2 times. Change approach.

---

## Limitations

- **Requires user login**: Cannot log in on behalf of the user
- **Long content**: Scroll first for lazy-load, then paginate output with `.substring()`
- **SPA navigation**: Wait for content after clicking navigation elements
- **Security**: JS executes in the user's authenticated session — never run untrusted scripts
- **macOS AppleScript**: No screenshot API (use `screencapture -l`). Chrome must be in foreground.
- **CDP**: Requires Chrome with remote debugging enabled. Coordinates are viewport-relative.
- **File upload**: Only `<input type="file">`. Drag-and-drop zones without file input need `DataTransfer` API fallback.
- **Cross-origin iframes**: Many enterprise apps use strict CSP that blocks automation.
- **Anti-scraping**: Some sites detect automation. Escalate from programmatic to GUI interaction.

---

## Module Index

| Module | When to Load |
|--------|-------------|
| `modules/applescript-commands.md` | Need full AppleScript command reference (observation, navigation, interaction) |
| `modules/advanced-applescript.md` | Need JXA robust tab targeting or MutationObserver element waiting |
| `modules/cdp-proxy-api.md` | Need full CDP Proxy API reference (all endpoints, setup, technical notes) |
| `modules/safety-system.md` | Need injectable safety check scripts (AppleScript + CDP versions) |
| `modules/dom-extraction.md` | Need structured Markdown extraction or virtual scroll |
| `modules/interactive-elements.md` | Need element indexing, click-by-index, or annotated screenshots |
| `modules/cdp-write-ops.md` | Need keyboard input, file upload, rich text fill, dropdown, hover, iframe |
| `modules/console-network.md` | Need console log or network request interception |
| `modules/parallel-dispatch.md` | Multiple independent targets to research in parallel |
| `modules/site-experience.md` | Operating on a site with known patterns |

---

## References

| File | When to Load |
|------|-------------|
| `references/cdp-api.md` | Need CDP API detail, JS extraction patterns, error handling |
| `~/.web-access/site-patterns/{domain}.md` | Before operating on a known site (the in-skill `references/site-patterns/` is migration source only — never read or write it) |
