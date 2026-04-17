# Repository Guidelines

## Project Structure

```
├── index.js           # Extension entry point — command registration, config persistence, and request patching
├── src/
│   └── logic.js       # Pure command parsing, status state, and payload injection logic
├── tests/
│   └── logic.test.mjs # Unit tests for src/logic.js
├── package.json       # Package metadata, scripts, and peer dependencies
├── README.md          # User-facing documentation
├── AGENTS.md          # This file
└── CHANGELOG.md       # Release history
```

This is a **pi extension** (no build step). The single entry point `index.js` exports a default function that pi invokes to register the `/fast` command, persist state, and inject `service_tier: "priority"` into provider requests for supported APIs.

## Commands

| Command | Description |
|---|---|
| `npm test` | Run unit tests via Node native test runner (`--test`) |
| `npm run check` | Alias for `npm test` |
| `npm run prepack` | Runs `check` before publishing |

## Coding Style

- **Indentation**: 2 spaces.
- **Naming**: `UPPER_SNAKE_CASE` for exported constants (`FAST_ARGUMENTS`, `SERVICE_TIER_PRIORITY`), `camelCase` for exported functions and helpers.
- **No formatter/linter** configured — keep style consistent with existing code.
- **Error handling**: Let errors propagate; catch only at the extension boundary.
- **Tests**: Node.js native test runner (`node --test`), `*.test.mjs` in `tests/`.

## Commit & Pull Request Guidelines

- **Commit messages**: Imperative, scoped (e.g. `add bare /fast toggle`, `fix cross-session state drift`).
- **PRs**: Describe the change, link related issues, note any behavior changes.

## Security Notes

- `fast-mode.json` is stored in Pi's agent dir and is never committed.
- No credentials are handled by this extension.
