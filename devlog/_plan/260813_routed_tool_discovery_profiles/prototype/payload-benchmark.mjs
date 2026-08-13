import { Buffer } from "node:buffer";

const TOOL_COUNT = Number.parseInt(process.argv[2] ?? "250", 10);
if (!Number.isSafeInteger(TOOL_COUNT) || TOOL_COUNT < 1 || TOOL_COUNT > 10_000) {
  throw new TypeError("tool count must be an integer from 1 to 10000");
}

function tool(index) {
  const namespace = `mcp__service_${String(index % 17).padStart(2, "0")}`;
  const name = `${namespace}__operation_${String(index).padStart(4, "0")}`;
  return {
    type: "function",
    name,
    description: `Operate service resource ${index}. This synthetic description represents a realistic MCP routing hint and intentionally repeats domain terms for retrieval.`,
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        resource_id: { type: "string", description: "Stable resource identifier." },
        query: { type: "string", description: "User-provided search or mutation query." },
        options: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100 },
            include_archived: { type: "boolean" },
            fields: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["resource_id"],
    },
  };
}

const tools = Array.from({ length: TOOL_COUNT }, (_, index) => tool(index + 1));
const eagerExecDescription = JSON.stringify({
  exec: "Run JavaScript to call nested tools.",
  nested_tool_declarations: tools,
});
const allToolsIndex = JSON.stringify(tools.map(({ name, description }) => ({ name, description })));
const metaTools = JSON.stringify([
  {
    name: "ocx_tool_search",
    description: "Search the authorized MCP tool index by exact name, namespace, prefix, or terms.",
    parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" } }, required: ["query"] },
  },
  {
    name: "ocx_tool_describe",
    description: "Return bounded schemas for one to three exact qualified tool names.",
    parameters: { type: "object", properties: { names: { type: "array", maxItems: 3, items: { type: "string" } } }, required: ["names"] },
  },
  {
    name: "ocx_tool_call",
    description: "Call one exact qualified tool through the normal authorization and logging path.",
    parameters: { type: "object", properties: { name: { type: "string" }, arguments: { type: "object" } }, required: ["name", "arguments"] },
  },
]);

const bytes = value => Buffer.byteLength(value, "utf8");
const eagerBytes = bytes(eagerExecDescription);
const indexBytes = bytes(allToolsIndex);
const metaBytes = bytes(metaTools);

const result = {
  generatedAt: new Date().toISOString(),
  unit: "UTF-8 bytes",
  note: "Synthetic structural benchmark; it is not a tokenizer or a capture of a live Codex request.",
  toolCount: TOOL_COUNT,
  modes: {
    eagerFullSchemas: eagerBytes,
    codeModeNameDescriptionIndex: indexBytes,
    threeMetaTools: metaBytes,
  },
  ratios: {
    eagerToCodeModeIndex: Number((eagerBytes / indexBytes).toFixed(3)),
    eagerToMetaTools: Number((eagerBytes / metaBytes).toFixed(3)),
    codeModeIndexToMetaTools: Number((indexBytes / metaBytes).toFixed(3)),
  },
  perToolBytes: {
    eagerFullSchemas: Number((eagerBytes / TOOL_COUNT).toFixed(2)),
    codeModeNameDescriptionIndex: Number((indexBytes / TOOL_COUNT).toFixed(2)),
  },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
