# @linioi/pi-fast-mode

[![npm version](https://img.shields.io/npm/v/%40linioi%2Fpi-fast-mode.svg)](https://www.npmjs.com/package/@linioi/pi-fast-mode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/RimuruW/pi-fast-mode/blob/main/LICENSE)

A pi extension that adds a protocol-aware `/fast` command with status indicator. It persists a local `enabled` flag in Pi's agent dir (`fast-mode.json`) and patches provider requests for supported targets:

- `openai-responses` → `service_tier: "priority"`
- `openai-codex-responses` → `service_tier: "priority"`
- `anthropic-messages` with `claude-opus-4-6` → `speed: "fast"` plus `anthropic-beta: fast-mode-2026-02-01`

## Install

```bash
# Via pi package manager
pi install npm:@linioi/pi-fast-mode

# Or from source
git clone https://github.com/RimuruW/pi-fast-mode.git
cd pi-fast-mode
pi install .
```

## Use

```
/fast          # toggle on ↔ off
/fast on       # enable fast mode
/fast off      # disable fast mode
/fast status   # show current state and supported APIs
```

## Status Indicator

| State      | Footer      | Meaning                                      |
| ---------- | ----------- | -------------------------------------------- |
| active     | ⚡ fast     | fast mode on, current model/API supports it  |
| unsupported| ⚡ n/a      | fast mode on, current model/API unsupported  |
| off        | _(hidden)_  | fast mode off                                |

## How It Works

When fast mode is enabled and the current model is supported, the extension applies the provider-specific fast-path patch:

```json
{ "service_tier": "priority" }
```

for OpenAI responses APIs, and

```json
{ "speed": "fast" }
```

plus the `anthropic-beta: fast-mode-2026-02-01` request header for Claude Opus 4.6 on `anthropic-messages`.

This keeps OpenAI support as-is while matching Claude Code's fast-mode shape for Anthropic. The flag is persisted across sessions.

## Project Structure

```
├── index.js           # Extension entry point
├── src/
│   └── logic.js       # Pure command parsing & payload injection
├── tests/
│   └── logic.test.mjs # Unit tests
├── package.json
└── README.md
```

No build step — pi loads JavaScript extensions directly.

## Development

```bash
npm test     # run tests
npm run check
npm run prepack  # runs check before publish
```

## License

[MIT](https://github.com/RimuruW/pi-fast-mode/blob/main/LICENSE)
