# Project Notes - 2026-03-17

## 1) Project quick interpretation

- Project: openvideo-editor (Next.js App Router + React + Prisma + Better Auth + Genkit + Zustand).
- Core product shape:
  - `/projects`: project list and creation entry.
  - `/edit/[projectId]`: editor page.
  - `/api/projects*`: project CRUD (auth protected).
  - `storage-service.ts`: client-side storage abstraction for projects/media/timeline/sounds.
- Editor architecture:
  - Left: media panel.
  - Middle: canvas + timeline.
  - Right: assistant panel.
  - Rendering relies on WebCodecs/OpenVideo compositor stack.

## 2) Main issues found during this session

### A. Project creation failed with 401 Unauthorized

Symptoms:
- `POST /api/projects` and `GET /api/projects*` returned 401 when not logged in.
- `storageService.saveProject()` threw and blocked project creation.

Root cause:
- Client attempted remote project APIs unconditionally.
- Backend requires auth session for project endpoints.

### B. Edit page had repeated 401 noise

Symptoms:
- Repeated requests to `/api/custom-presets?category=*` with 401.
- Duplicate effect caused by React StrictMode mount behavior in dev.

Root cause:
- Edit page fetched custom presets before checking auth.
- Same project load effect could run more than once in dev.

### C. Browser reported "WebCodecs not supported" despite modern Edge UA

Symptoms:
- Modal blocked usage on `http://192.168.0.115:3000`.
- Console flooded with WebGL errors even while unsupported modal shown.

Root cause:
- Original support check relied only on strict `Compositor.isSupported()`.
- Insecure context (`http` on LAN IP, not localhost/https) can fail WebCodecs conditions.
- Unsupported branch still mounted rendering stack.

### D. Need to skip landing page and enter projects directly

Requirement:
- Accessing `/` should go straight to `/projects`.

## 3) Implemented changes

### 3.1 Session-aware local-first fallback for projects

File:
- `src/lib/storage/storage-service.ts`

Changes:
- Added local project adapter (`projectsAdapter`) using IndexedDB.
- Added local project CRUD helpers (`saveProjectLocal`, `loadProjectLocal`, etc.).
- Added auth session probe (`authClient.getSession`) with short TTL cache.
- If unauthenticated, skip remote project APIs and use local storage directly.
- If remote responds 401/403/5xx, automatically fallback to local storage.
- Keep local cache synced after successful remote reads/writes.

Result:
- Unauthenticated users can create/open/delete projects locally without hard failure.
- 401 network noise for `/api/projects` is avoided in normal unauth flow.

### 3.2 Reduce edit-page auth noise and duplicate load

File:
- `src/app/edit/[projectId]/page.tsx`

Changes:
- Added `loadedProjectRef` guard to avoid duplicate same-project load in dev strict mode.
- Before fetching custom presets, check session via `authClient.getSession`.
- If no session, skip presets fetch and continue normal project init.

Result:
- Project still loads.
- Fewer unnecessary 401 preset calls.

### 3.3 WebCodecs detection and unsupported path hardening

Files:
- `src/components/editor/editor.tsx`
- `src/components/editor/webcodecs-unsupported-modal.tsx`

Changes:
- Added explicit support state model:
  - secure/insecure context
  - missing required WebCodecs APIs
- Detection now checks:
  - secure context (`https` or localhost)
  - required APIs (`OffscreenCanvas`, `VideoEncoder`, etc.)
- `Compositor.isSupported()` retained as diagnostic warning only, not hard blocker when base APIs exist.
- If unsupported, editor rendering tree is not mounted (prevents WebGL error flood).
- Unsupported modal now includes reason/missing APIs and secure-context hint.
- Added `DialogDescription` to remove dialog accessibility warning.

Result:
- Clearer unsupported diagnosis.
- No unnecessary compositor initialization when unsupported.

### 3.4 Redirect root path to projects page

File:
- `src/app/(marketing)/page.tsx`

Changes:
- Replaced marketing home content with `redirect("/projects")`.

Result:
- Visiting `/` now lands directly on `/projects`.

## 4) Files modified in this session

- `src/lib/storage/storage-service.ts`
- `src/app/edit/[projectId]/page.tsx`
- `src/components/editor/editor.tsx`
- `src/components/editor/webcodecs-unsupported-modal.tsx`
- `src/app/(marketing)/page.tsx`

## 5) Validation performed

Executed repeatedly:
- `npm run build`

Observed outcome:
- Build succeeds after each functional fix.

Known non-blocking warnings still present:
- `@react-email/render` expects `prettier` package to be resolvable in project.
- Better Auth warns when `BETTER_AUTH_URL`/`BETTER_AUTH_SECRET` are not configured.

## 6) Follow-up suggestions (optional)

- Add missing auth env vars for stable auth behavior in all routes:
  - `BETTER_AUTH_URL`
  - `BETTER_AUTH_SECRET`
- If LAN access is required for editor runtime, run dev on `https` origin.
- Optionally add a small diagnostics badge in UI showing:
  - secure context state
  - WebCodecs API availability
  - current storage mode (remote/local)

## 7) Notes for future debugging

If project list/save unexpectedly reverts to remote and fails:
- Check current auth session state (`authClient.getSession`).
- Verify network origin and cookie scope.
- Confirm `storage-service` session cache TTL behavior around login/logout transitions.
