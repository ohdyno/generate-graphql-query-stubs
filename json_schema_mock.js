#!/usr/bin/env node
/**
 * Takes a JSON Schema (from a file or stdin) and returns an object
 * filled with mock values matching the schema.
 *
 * Usage:
 *   node json_schema_mock.js <schema_file.json>
 *   node graphql_schema.js query.graphql | node json_schema_mock.js
 */

const fs = require("fs");

// ---------------------------------------------------------------------------
// 1. Value generators
// ---------------------------------------------------------------------------

const WORDS = [
  "azure", "blaze", "cedar", "dusk", "ember", "frost", "gale", "haze",
  "iris", "jade", "kite", "lark", "mist", "nova", "onyx", "pine",
  "quill", "rune", "sage", "thorn", "umber", "vale", "wren", "zeal",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

function generateString(schema) {
  if (schema.enum) return pick(schema.enum);
  if (schema.format === "date") return "2024-01-01";
  if (schema.format === "date-time") return "2024-01-01T00:00:00Z";
  if (schema.format === "email") return `${pick(WORDS)}@example.com`;
  if (schema.format === "uri") return `https://example.com/${pick(WORDS)}`;
  return `${pick(WORDS)}-${pick(WORDS)}`;
}

function generateInteger(schema) {
  const min = schema.minimum ?? 1;
  const max = schema.maximum ?? 255;
  return randInt(min, max);
}

function generateNumber(schema) {
  const min = schema.minimum ?? 0.1;
  const max = schema.maximum ?? 2.0;
  return randFloat(min, max);
}

function generateArray(schema) {
  const itemSchema = schema.items ?? {};
  const min = schema.minItems ?? 1;
  const max = schema.maxItems ?? 3;
  const length = randInt(min, max);
  return Array.from({ length }, () => generate(itemSchema));
}

function generateObject(schema) {
  const result = {};
  const properties = schema.properties ?? {};
  for (const [key, propSchema] of Object.entries(properties)) {
    result[key] = generate(propSchema);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 2. Main generator — dispatches by type
// ---------------------------------------------------------------------------

function generate(schema) {
  if (!schema || typeof schema !== "object") return null;

  if (schema.enum) return pick(schema.enum);

  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null") ?? schema.type[0]
    : schema.type;

  switch (type) {
    case "object":  return generateObject(schema);
    case "array":   return generateArray(schema);
    case "string":  return generateString(schema);
    case "integer": return generateInteger(schema);
    case "number":  return generateNumber(schema);
    case "boolean": return Math.random() < 0.5;
    case "null":    return null;
    default:        return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Entry point — read from file or stdin
// ---------------------------------------------------------------------------

function run(input) {
  const schema = JSON.parse(input);
  const result = generate(schema);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[2]) {
  run(fs.readFileSync(process.argv[2], "utf8"));
} else {
  // Read from stdin (e.g. piped from graphql_schema.js)
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => run(input));
}
