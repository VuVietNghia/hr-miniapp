# CLAUDE.md

## Agent Room Instruction

- **Agent Room ID:** `agent-room-6a56f0dcd2c982c4543db09c` — bot's home room ID. If a **Cross Room Instruction** block exists ABOVE this block, that block takes precedence for the active session (cross-room mode); use this Agent Room block only as fallback / persona reference.
- **[PRIORITY] Documents go in `AgentFiles/`.** Prefer reading and writing documents, notes, and persistent agent-owned content under `AgentFiles/`. This folder is shared with every cross-room session, so anything you put there is visible from any room the agent is invited to.
- **[CRITICAL] `AgentFiles/` is directly inside your current working directory (the project root).** Resolve every path relative to cwd. When a tool requires an absolute path, derive it from your shell working directory — `$(pwd)/AgentFiles/...`. NEVER hardcode or guess a `.../data/projects/...` path, and NEVER use the Room ID as a folder name: writing to a guessed `room-<id>` path silently creates a stray directory that is invisible to the room and never synced.
- Unless specifically instructed otherwise, all generated `code` libraries & files, .env, or executables must be located in a folder named `AgentFiles/scripts`.
- **Do not** run sync commands, upload files manually, call the proxy API, or try to push/pull MinIO yourself. File sync is handled automatically by background hooks — your only job is to put files in the right place.
- Protected — never modify: `.claude/`, `tmp/`, `node_modules/`, `.git/`, `.markdown/`, `Shared-Folders/Read-Only/` (the sync worker manages those).

### Shared Folders

Shared folders mirror cross-room file shares. They appear under `Shared-Folders/` once a share is set up:
- `Shared-Folders/Read-Only/...` — read only. Do not create, edit, or delete here.
- `Shared-Folders/Writable/<folderName>/<file>` — writable shared files go here. Never write directly under `Writable/` root, only inside a named share folder.
- If `Shared-Folders/` (or the specific share folder) does not exist locally, treat it as not configured — do not auto-create it. Continue work in regular project paths instead.
- When asked which folders/files are shared, list what's under `Shared-Folders/Read-Only/` and `Shared-Folders/Writable/`. Only answer "no shared folders" if both are empty.

### Skills

Before starting a task, check for relevant skill files:
- **Global skills:** `~/.claude/skills/` (docx, pdf, pptx, xlsx, frontend-design, etc.)
- **Local project skills:** `./.claude/skills/`
- **Scheduling / automation skills:** this room owns an agent, and the agent's scheduling/trigger scripts live in `.claude/skills/agent-scheduler/`. Read its `SKILL.md` for what cron/webhook/event-listener operations are available.
- **Self-edit skill:** you can edit your own profile (name, username, bio, purpose, personality, instructions, knowledge) and rotate your own bot token via `.claude/skills/agent-bot-edit/bot.js`. Read its `SKILL.md` before invoking. Always confirm with the user before mutating.

### Agent Rules

- Stay in character at all times — the room's `IDENTITY.md` defines who this agent is.
- Be helpful, accurate, and concise.
- If unsure, say so honestly. Respect user privacy.
- **[CRITICAL]** When creating anything related to schedules, cron jobs, recurring tasks, reminders, webhooks, event listeners, or timed automations, you **MUST** use `node .claude/skills/agent-scheduler/trigger.js <subcommand>` (subcommands: `list`, `add`, `update`, `remove`, `run`, `explain`). Do **NOT** use built-in Claude Code scheduling (`CronCreate`, `/schedule`) or any other scheduling mechanism — those bypass the room's trigger system and the user will not see or be able to manage what you scheduled.

