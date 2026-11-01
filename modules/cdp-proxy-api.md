# CDP Proxy Mode — Full API Reference

HTTP-to-CDP bridge proxy that connects to the user's daily Chromium browser (Chrome / Edge / Brave / Arc / Dia …). All operations via simple `curl` calls. Works on macOS, Linux, and Windows.

## Setup

```bash
# Run preflight + auto-start proxy
node "${SKILL_DIR}/scripts/check-deps.mjs"
# (`bash "${SKILL_DIR}/scripts/check-deps.sh"` is a thin wrapper over the same entry point)

# Cross-platform maintenance (status / restart / stop) — not per-task
node "${SKILL_DIR}/scripts/proxy-maintenance.mjs" status
```

The proxy listens on `localhost:3456`. It is a **long-lived shared service**: reuse a healthy instance, never stop it at the end of a task. It has no idle or max-lifetime timer.

**Browser identity = its user-data directory.** `~/.web-access/config.env` holds `WEB_ACCESS_BROWSER` as a data-dir path (the level containing `Local State`). Legacy values `chrome` / `chrome-canary` / `chromium` / `edge` still work and map to standard paths per platform. Only the configured directory's `DevToolsActivePort` is read — no port scanning, no browser switching, hard error on failure.

User data (`config.env`, site experience) lives in `~/.web-access/`, outside the skill dir, so skill upgrades never touch it.

## API Endpoints

```bash
# Health — status:"ok" = service alive, connected:true = browser connection valid
curl -s http://localhost:3456/health

# List user's open tabs
curl -s http://localhost:3456/targets

# Create new background tab (auto-waits for DOM interactive)
# URL goes in the POST body — no URL-encoding needed, & in query is NOT split
curl -s -X POST --data-raw 'https://example.com' http://localhost:3456/new

# Page info
curl -s "http://localhost:3456/info?target=ID"

# Execute arbitrary JS (the most powerful primitive)
curl -s -X POST "http://localhost:3456/eval?target=ID" -d 'document.title'

# Execute JS inside an iframe (frameId from /frames; cross-process iframes supported)
curl -s -X POST "http://localhost:3456/eval?target=ID&frame=FRAME_ID" -d 'document.body.innerText'

# List iframes in the page (index, frameId, url, crossProcess, id/name/src)
curl -s "http://localhost:3456/frames?target=ID"

# JS click (simple, fast)
curl -s -X POST "http://localhost:3456/click?target=ID" -d 'button.submit'

# Real mouse click (CDP Input.dispatchMouseEvent — trusted, bypasses anti-automation)
curl -s -X POST "http://localhost:3456/clickAt?target=ID" -d 'button.upload'

# Real mouse click at viewport coords — reaches cross-process iframes, no tab activation
curl -s "http://localhost:3456/clickXY?target=ID&x=120&y=90"

# File upload (bypasses OS file dialog)
curl -s -X POST "http://localhost:3456/setFiles?target=ID" -d '{"selector":"input[type=file]","files":["/path/to/file.png"]}'

# Scroll (triggers lazy-load, 800ms wait)
curl -s "http://localhost:3456/scroll?target=ID&y=3000"
curl -s "http://localhost:3456/scroll?target=ID&direction=bottom"

# Screenshot (captures current render including video frames)
curl -s "http://localhost:3456/screenshot?target=ID&file=/tmp/shot.png"

# Navigate / back — target in query, URL in POST body
curl -s -X POST --data-raw 'https://example.com' "http://localhost:3456/navigate?target=ID"
curl -s "http://localhost:3456/back?target=ID"

# Close tab
curl -s "http://localhost:3456/close?target=ID"
```

### POST-body rule

Anything carrying an arbitrary string payload travels in the **POST body**: `/eval`, `/click`, `/clickAt`, `/setFiles`, and since v2.5.3 also `/new` and `/navigate`. Opaque IDs (`target`, `frame`) stay in the query. Old `GET /new?url=…` returns `400` with migration guidance — see `references/migration-2.5.3.md`.

## CDP Advanced Write Operations

Keyboard input, file upload, rich text editor fill, select/dropdown, hover trigger, iframe penetration.

**Full reference**: `modules/cdp-write-ops.md` — load when you need keyboard input, file upload, rich text fill, dropdown, hover, or iframe operations.

## CDP Technical Notes

- **Tab isolation**: Each tab has its own `targetId`. Sub-agents create and manage their own tabs.
- **Page load waiting**: `/new` and `/navigate` create `about:blank`, attach, then navigate and wait for the DOM to reach at least `interactive`. This is a *document-level* guarantee, not a content-complete guarantee — verify target content with `/eval` afterwards.
- **Lazy-load**: `/scroll` to bottom triggers lazy-load with 800ms wait.
- **DOM beyond viewport**: Carousels, collapsed sections, hidden tabs — content exists in DOM but isn't visible. Think in data structures (containers, attributes, node relationships) to access hidden content.
- **Shadow DOM / iframe boundaries**: `/eval` with recursive traversal can penetrate same-process layers. Cross-process (cross-site) iframes are unreachable from the parent — use `/frames` + `/eval?frame=` or `/clickXY`.
- **Media extraction**: Use `/eval` to get image URLs from DOM directly — more precise than full-page screenshot.
- **Video analysis**: Control `<video>` elements via `/eval` (seek, play, pause), then `/screenshot` to capture specific frames.
- **Idle tabs**: Tabs created via `/new` and untouched for 15 minutes are auto-closed. The service itself never exits, and user tabs are never touched.
