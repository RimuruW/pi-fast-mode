# Changelog

## [0.1.0] — 2026-04-17

### Features

- add `/fast` command that toggles on/off
- add `/fast on`, `/fast off`, `/fast status`
- inject `service_tier: "priority"` into provider requests for `openai-responses` and `openai-codex-responses` APIs
- show footer indicator (⚡ fast / ⚡ n/a / hidden)
- persist enabled state to Pi's agent dir as `fast-mode.json`

### Bug Fixes

- fix cross-session state drift: reload config before status display, toggle, and request injection so external changes are reflected immediately

### Refactor

- move pure logic (`parseFastCommand`, `patchProviderPayload`, `getFastStatusState`) to `src/logic.js` for testability
- remove in-memory config cache; file is now the single source of truth

### Other

- add AGENTS.md and CHANGELOG.md
- add MIT license
- add unit tests for all exported functions in `src/logic.js`
