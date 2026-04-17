import test from "node:test";
import assert from "node:assert/strict";

import {
  FAST_ARGUMENTS,
  SERVICE_TIER_PRIORITY,
  getFastArgumentCompletions,
  getFastStatusState,
  isFastModeApi,
  parseFastCommand,
  patchProviderPayload,
} from "../src/logic.js";

test("FAST_ARGUMENTS exposes the supported slash command arguments", () => {
  assert.deepEqual(FAST_ARGUMENTS, ["on", "off", "status"]);
});

test("getFastArgumentCompletions returns all arguments for an empty prefix", () => {
  assert.deepEqual(getFastArgumentCompletions(""), [
    { value: "on", label: "on" },
    { value: "off", label: "off" },
    { value: "status", label: "status" },
  ]);
});

test("getFastArgumentCompletions filters by prefix and stops after the first argument", () => {
  assert.deepEqual(getFastArgumentCompletions("o"), [
    { value: "on", label: "on" },
    { value: "off", label: "off" },
  ]);
  assert.equal(getFastArgumentCompletions("on "), null);
});

test("parseFastCommand normalizes valid arguments", () => {
  assert.equal(parseFastCommand(""), "toggle");
  assert.equal(parseFastCommand("   "), "toggle");
  assert.equal(parseFastCommand(" on "), "on");
  assert.equal(parseFastCommand("OFF"), "off");
  assert.equal(parseFastCommand("status"), "status");
});

test("parseFastCommand rejects unsupported arguments", () => {
  assert.equal(parseFastCommand("toggle"), null);
  assert.equal(parseFastCommand("toggle status"), null);
  assert.equal(parseFastCommand("on now"), null);
});

test("isFastModeApi accepts only responses-style APIs", () => {
  assert.equal(isFastModeApi("openai-responses"), true);
  assert.equal(isFastModeApi("azure-openai-responses"), false);
  assert.equal(isFastModeApi("openai-codex-responses"), true);
  assert.equal(isFastModeApi("anthropic-messages"), false);
  assert.equal(isFastModeApi(undefined), false);
});

test("patchProviderPayload injects priority service tier for supported OpenAI APIs", () => {
  const payload = { model: "gpt-5", stream: true };
  assert.deepEqual(
    patchProviderPayload(payload, { enabled: true, api: "openai-responses" }),
    { model: "gpt-5", stream: true, service_tier: SERVICE_TIER_PRIORITY },
  );
});

test("patchProviderPayload enables Claude fast mode for supported Anthropic models", () => {
  const payload = { model: "claude-opus-4-6", stream: true };
  assert.deepEqual(
    patchProviderPayload(payload, {
      enabled: true,
      api: "anthropic-messages",
      modelId: "claude-opus-4-6",
    }),
    { model: "claude-opus-4-6", stream: true, speed: "fast" },
  );
});

test("patchProviderPayload leaves payload unchanged when fast mode is disabled or unsupported", () => {
  const payload = { model: "gpt-5", stream: true };
  assert.equal(
    patchProviderPayload(payload, { enabled: false, api: "openai-responses" }),
    payload,
  );
  assert.equal(
    patchProviderPayload(payload, {
      enabled: true,
      api: "anthropic-messages",
      modelId: "claude-opus-4-7",
    }),
    payload,
  );
  assert.equal(
    patchProviderPayload(payload, {
      enabled: true,
      api: "anthropic-messages",
      modelId: "claude-sonnet-4-6",
    }),
    payload,
  );
});

test("patchProviderPayload ignores non-object payloads", () => {
  assert.equal(patchProviderPayload("raw", { enabled: true, api: "openai-responses" }), "raw");
  assert.equal(patchProviderPayload(null, { enabled: true, api: "openai-responses" }), null);
});

test("getFastStatusState describes enabled and unsupported states", () => {
  assert.deepEqual(getFastStatusState({ enabled: false, api: "openai-responses" }), {
    kind: "off",
    active: false,
    label: "Fast off",
  });
  assert.deepEqual(getFastStatusState({ enabled: true, api: "openai-responses" }), {
    kind: "active",
    active: true,
    label: "Fast on",
  });
  assert.deepEqual(
    getFastStatusState({
      enabled: true,
      api: "anthropic-messages",
      modelId: "claude-opus-4-6",
    }),
    {
      kind: "active",
      active: true,
      label: "Fast on",
    },
  );
  assert.deepEqual(
    getFastStatusState({
      enabled: true,
      api: "anthropic-messages",
      modelId: "claude-opus-4-7",
    }),
    {
      kind: "unsupported",
      active: false,
      label: "Fast n/a",
    },
  );
  assert.deepEqual(
    getFastStatusState({
      enabled: true,
      api: "anthropic-messages",
      modelId: "claude-sonnet-4-6",
    }),
    {
      kind: "unsupported",
      active: false,
      label: "Fast n/a",
    },
  );
});
