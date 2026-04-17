import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function createUiRecorder() {
  const notifications = [];
  const statuses = [];

  return {
    notifications,
    statuses,
    ui: {
      theme: {
        fg: (_color, value) => value,
      },
      notify: (message, level) => {
        notifications.push({ message, level });
      },
      setStatus: (key, value) => {
        statuses.push({ key, value });
      },
    },
  };
}

async function loadExtensionFixture(configText, model = {
  provider: "openai",
  id: "gpt-5",
  api: "openai-responses",
}) {
  const fixtureDir = mkdtempSync(join(tmpdir(), "pi-fast-mode-"));
  const agentDir = join(fixtureDir, "agent");
  const stubModuleDir = join(fixtureDir, "node_modules", "@mariozechner", "pi-coding-agent");

  mkdirSync(join(fixtureDir, "src"), { recursive: true });
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(stubModuleDir, { recursive: true });

  copyFileSync(new URL("../index.js", import.meta.url), join(fixtureDir, "index.js"));
  copyFileSync(new URL("../src/logic.js", import.meta.url), join(fixtureDir, "src", "logic.js"));

  writeFileSync(join(agentDir, "fast-mode.json"), configText, "utf8");
  writeFileSync(
    join(stubModuleDir, "package.json"),
    JSON.stringify({
      name: "@mariozechner/pi-coding-agent",
      type: "module",
      exports: "./index.js",
    }),
    "utf8",
  );
  writeFileSync(
    join(stubModuleDir, "index.js"),
    `export function getAgentDir() { return ${JSON.stringify(agentDir)}; }\n`,
    "utf8",
  );

  const { default: fastModeExtension } = await import(pathToFileURL(join(fixtureDir, "index.js")).href);
  const handlers = new Map();
  const commands = new Map();
  const pi = {
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    registerCommand(commandName, command) {
      commands.set(commandName, command);
    },
  };

  fastModeExtension(pi);

  const { notifications, statuses, ui } = createUiRecorder();
  const ctx = {
    model,
    ui,
  };

  return {
    agentDir,
    commands,
    ctx,
    handlers,
    notifications,
    statuses,
  };
}

test("before_provider_request keeps using the enabled state loaded at session start", async () => {
  const fixture = await loadExtensionFixture('{"enabled": true}\n');

  await fixture.handlers.get("session_start")({}, fixture.ctx);
  writeFileSync(join(fixture.agentDir, "fast-mode.json"), '{"enabled": false}\n', "utf8");

  const payload = { model: "gpt-5", stream: true };
  assert.deepEqual(
    fixture.handlers.get("before_provider_request")({ payload }, fixture.ctx),
    { model: "gpt-5", stream: true, service_tier: "priority" },
  );
});

test("session_start warns once when the persisted config cannot be parsed", async () => {
  const fixture = await loadExtensionFixture('{"enabled":');

  await fixture.handlers.get("session_start")({}, fixture.ctx);
  await fixture.handlers.get("session_start")({}, fixture.ctx);

  assert.equal(fixture.notifications.length, 1);
  assert.equal(fixture.notifications[0].level, "warning");
  assert.match(fixture.notifications[0].message, /Failed to read fast mode config/);
  assert.match(fixture.notifications[0].message, /fast-mode\.json/);
});

test("session_start enables Claude fast mode headers only for supported Anthropic models", async () => {
  const fixture = await loadExtensionFixture('{"enabled": true}\n', {
    provider: "anthropic",
    id: "claude-opus-4-6",
    api: "anthropic-messages",
  });

  await fixture.handlers.get("session_start")({}, fixture.ctx);

  assert.equal(fixture.ctx.model.headers["anthropic-beta"], "fast-mode-2026-02-01");
  assert.deepEqual(
    fixture.handlers.get("before_provider_request")({
      payload: { model: "claude-opus-4-6", stream: true },
    }, fixture.ctx),
    { model: "claude-opus-4-6", stream: true, speed: "fast" },
  );
});
