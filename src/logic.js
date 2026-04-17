export const FAST_ARGUMENTS = ["on", "off", "status"];
export const FAST_MODE_APIS = new Set([
  "openai-responses",
  "openai-codex-responses",
]);
export const FAST_MODE_CLAUDE_API = "anthropic-messages";
export const FAST_MODE_CLAUDE_MODEL_PREFIXES = [
  "claude-opus-4-6",
];
export const SERVICE_TIER_PRIORITY = "priority";
export const ANTHROPIC_FAST_MODE_BETA_HEADER = "anthropic-beta";
export const ANTHROPIC_FAST_MODE_BETA = "fast-mode-2026-02-01";
export const ANTHROPIC_FAST_MODE_SPEED = "fast";

function toCompletionItems(values) {
  return values.map((value) => ({ value, label: value }));
}

function splitHeaderValues(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

export function getFastArgumentCompletions(prefix) {
  const normalized = prefix.trimStart().toLowerCase();
  if (normalized.includes(" ")) {
    return null;
  }

  const matches = FAST_ARGUMENTS.filter((value) => value.startsWith(normalized));
  if (matches.length === 0) {
    return null;
  }

  return toCompletionItems(matches);
}

export function parseFastCommand(args) {
  const normalized = args.trim().toLowerCase();
  if (!normalized) {
    return "toggle";
  }
  if (normalized.includes(" ")) {
    return null;
  }
  return FAST_ARGUMENTS.includes(normalized) ? normalized : null;
}

export function isFastModeApi(api) {
  return typeof api === "string" && FAST_MODE_APIS.has(api);
}

export function isClaudeFastModeModel(modelId) {
  if (typeof modelId !== "string") {
    return false;
  }

  const normalized = modelId.toLowerCase();
  return FAST_MODE_CLAUDE_MODEL_PREFIXES.some((prefix) => normalized.includes(prefix));
}

export function isClaudeFastModeTarget(options) {
  return options.api === FAST_MODE_CLAUDE_API && isClaudeFastModeModel(options.modelId);
}

export function isFastModeSupportedTarget(options) {
  return isFastModeApi(options.api) || isClaudeFastModeTarget(options);
}

export function getFastModeRequestPatchSummary(options) {
  if (isFastModeApi(options.api)) {
    return `service_tier=${SERVICE_TIER_PRIORITY}`;
  }

  if (isClaudeFastModeTarget(options)) {
    return `speed=${ANTHROPIC_FAST_MODE_SPEED}; ${ANTHROPIC_FAST_MODE_BETA_HEADER}=${ANTHROPIC_FAST_MODE_BETA}`;
  }

  return null;
}

export function patchProviderPayload(payload, options) {
  if (!options.enabled) {
    return payload;
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return payload;
  }
  if (isFastModeApi(options.api)) {
    return { ...payload, service_tier: SERVICE_TIER_PRIORITY };
  }
  if (isClaudeFastModeTarget(options)) {
    return { ...payload, speed: ANTHROPIC_FAST_MODE_SPEED };
  }
  return payload;
}

export function patchModelHeaders(headers, options) {
  if (!isClaudeFastModeTarget(options)) {
    return headers;
  }

  const nextHeaders = headers ? { ...headers } : {};
  const betas = splitHeaderValues(nextHeaders[ANTHROPIC_FAST_MODE_BETA_HEADER]);
  const nextBetas = options.enabled
    ? unique([...betas, ANTHROPIC_FAST_MODE_BETA])
    : betas.filter((beta) => beta !== ANTHROPIC_FAST_MODE_BETA);

  if (nextBetas.length === 0) {
    delete nextHeaders[ANTHROPIC_FAST_MODE_BETA_HEADER];
  } else {
    nextHeaders[ANTHROPIC_FAST_MODE_BETA_HEADER] = nextBetas.join(",");
  }

  return Object.keys(nextHeaders).length === 0 ? undefined : nextHeaders;
}

export function getFastStatusState(options) {
  if (!options.enabled) {
    return {
      kind: "off",
      active: false,
      label: "Fast off",
    };
  }
  if (isFastModeSupportedTarget(options)) {
    return {
      kind: "active",
      active: true,
      label: "Fast on",
    };
  }
  return {
    kind: "unsupported",
    active: false,
    label: "Fast n/a",
  };
}
