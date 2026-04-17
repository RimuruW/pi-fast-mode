import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import {
  getFastArgumentCompletions,
  getFastModeRequestPatchSummary,
  getFastStatusState,
  parseFastCommand,
  patchModelHeaders,
  patchProviderPayload,
} from "./src/logic.js";

const CONFIG_PATH = join(getAgentDir(), "fast-mode.json");
const STATUS_KEY = "fast-mode";
const DEFAULT_CONFIG = { enabled: false };

function readPersistedConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return { config: { ...DEFAULT_CONFIG }, warning: null };
  }

  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return {
      config: {
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CONFIG.enabled,
      },
      warning: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      config: { ...DEFAULT_CONFIG },
      warning: `Failed to read fast mode config at ${CONFIG_PATH}: ${message}`,
    };
  }
}

function saveConfig(config) {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function cloneHeaders(headers) {
  return headers ? { ...headers } : undefined;
}

function currentModelSummary(ctx) {
  if (!ctx.model) {
    return {
      providerModel: "(no model selected)",
      api: "unknown",
    };
  }

  return {
    providerModel: `${ctx.model.provider}/${ctx.model.id}`,
    api: ctx.model.api,
  };
}

function getFastModeOptions(model, enabled) {
  return {
    enabled,
    api: model?.api,
    modelId: model?.id,
  };
}

function getModelsToSync(ctx) {
  if (ctx.modelRegistry && typeof ctx.modelRegistry.getAll === "function") {
    return ctx.modelRegistry.getAll();
  }
  return ctx.model ? [ctx.model] : [];
}

function syncModelHeaders(ctx, enabled, baseHeadersByModel) {
  for (const model of getModelsToSync(ctx)) {
    if (!baseHeadersByModel.has(model)) {
      baseHeadersByModel.set(model, cloneHeaders(model.headers));
    }

    const baseHeaders = baseHeadersByModel.get(model);
    model.headers = patchModelHeaders(baseHeaders, getFastModeOptions(model, enabled));
  }
}

function refreshStatus(ctx, enabled) {
  const theme = ctx.ui.theme;
  const status = getFastStatusState(getFastModeOptions(ctx.model, enabled));

  if (status.kind === "off") {
    ctx.ui.setStatus(STATUS_KEY, undefined);
    return;
  }

  if (status.kind === "active") {
    ctx.ui.setStatus(
      STATUS_KEY,
      theme.fg("accent", "⚡") + theme.fg("dim", " fast"),
    );
    return;
  }

  ctx.ui.setStatus(
    STATUS_KEY,
    theme.fg("warning", "⚡") + theme.fg("dim", " n/a"),
  );
}

function statusMessage(ctx, enabled) {
  const model = currentModelSummary(ctx);
  const options = getFastModeOptions(ctx.model, enabled);
  const status = getFastStatusState(options);

  if (status.kind === "off") {
    return [
      "Fast mode is off.",
      `Current model: ${model.providerModel}`,
      `API: ${model.api}`,
    ].join("\n");
  }

  if (status.kind === "active") {
    return [
      "Fast mode is on.",
      `Current model: ${model.providerModel}`,
      `API: ${model.api}`,
      `Request patch: ${getFastModeRequestPatchSummary(options)}`,
    ].join("\n");
  }

  return [
    "Fast mode is on, but the current model/API does not support the required request patch.",
    `Current model: ${model.providerModel}`,
    `API: ${model.api}`,
    "Request patch: inactive",
  ].join("\n");
}

export default function fastModeExtension(pi) {
  let enabled = DEFAULT_CONFIG.enabled;
  let lastConfigWarning = null;
  const baseHeadersByModel = new WeakMap();

  pi.on("session_start", async (_event, ctx) => {
    const { config, warning } = readPersistedConfig();
    enabled = config.enabled;
    syncModelHeaders(ctx, enabled, baseHeadersByModel);
    refreshStatus(ctx, enabled);

    if (warning !== null && warning !== lastConfigWarning) {
      lastConfigWarning = warning;
      ctx.ui.notify(warning, "warning");
      return;
    }

    if (warning === null) {
      lastConfigWarning = null;
    }
  });

  pi.on("model_select", async (_event, ctx) => {
    syncModelHeaders(ctx, enabled, baseHeadersByModel);
    refreshStatus(ctx, enabled);
  });

  pi.on("before_provider_request", (event, ctx) => {
    const nextPayload = patchProviderPayload(event.payload, getFastModeOptions(ctx.model, enabled));
    if (nextPayload !== event.payload) {
      return nextPayload;
    }
  });

  pi.registerCommand("fast", {
    description: "Manage fast mode: /fast toggles; args: on, off, status",
    getArgumentCompletions: getFastArgumentCompletions,
    handler: async (args, ctx) => {
      const command = parseFastCommand(args);
      if (command === null) {
        ctx.ui.notify("Usage: /fast [on|off|status]", "warning");
        return;
      }

      if (command === "status") {
        ctx.ui.notify(statusMessage(ctx, enabled), "info");
        return;
      }

      const nextConfig = {
        enabled: command === "toggle" ? !enabled : command === "on",
      };
      saveConfig(nextConfig);
      enabled = nextConfig.enabled;
      lastConfigWarning = null;
      syncModelHeaders(ctx, enabled, baseHeadersByModel);
      refreshStatus(ctx, nextConfig.enabled);
      ctx.ui.notify(statusMessage(ctx, nextConfig.enabled), "info");
    },
  });
}
