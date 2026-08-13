#!/usr/bin/env node
import fs from "node:fs";

const [path, selector] = process.argv.slice(2);
if (!path || !selector) {
  console.error("usage: inspect-generated-catalog.mjs <catalog.json> <slug>");
  process.exit(2);
}
const parsed = JSON.parse(fs.readFileSync(path, "utf8"));
const row = parsed.models?.find(model => model?.slug === selector);
if (!row) {
  console.error(`model not found: ${selector}`);
  process.exit(1);
}
const output = {
  slug: row.slug,
  tool_mode: row.tool_mode,
  supports_search_tool: row.supports_search_tool,
  web_search_tool_type: row.web_search_tool_type,
  supports_parallel_tool_calls: row.supports_parallel_tool_calls,
  context_window: row.context_window,
};
console.log(JSON.stringify(output, null, 2));
