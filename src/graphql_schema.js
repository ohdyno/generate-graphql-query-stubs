#!/usr/bin/env bun
/**
 * Parses a GraphQL query file and outputs a JSON Schema of the response shape.
 * Uses the `graphql` package for AST parsing; infers scalar types from field names.
 *
 * Usage:
 *   bun graphql_schema.js <query_file.graphql>
 *   bun graphql_schema.js <query_file.graphql> --overrides <overrides.json>
 *
 * Overrides file format (dot-path keys map to JSON Schema type strings):
 *   {
 *     "data.pokemon_v2_pokemon.items.name": "string",
 *     "data.pokemon_v2_pokemon.items.base_experience": "integer"
 *   }
 */

const { parse } = require("graphql");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// 1. Type inference from field names
// ---------------------------------------------------------------------------

const INT_RE =
  /_id$|^id$|_stat$|effort|experience|height|weight|count|level|order|floor|generation|accuracy|power|pp|priority|damage|speed|attack|defense|^hp$|age|quantity|amount|total|size|rank|score|index|position|duration/i;
const BOOL_RE = /^is_|^has_|^can_|^show_|^enable/i;
const FLOAT_RE = /rate|ratio|factor|chance|multiplier|percent|latitude|longitude/i;

function inferType(fieldName) {
  if (BOOL_RE.test(fieldName)) return "boolean";
  if (FLOAT_RE.test(fieldName)) return "number";
  if (INT_RE.test(fieldName)) return "integer";
  return "string";
}

// ---------------------------------------------------------------------------
// 2. List field heuristic
// ---------------------------------------------------------------------------

function isListField(fieldName) {
  return /s$|types$|stats$|abilities$|moves$|items$|forms$|results$|edges$|nodes$/.test(fieldName);
}

// ---------------------------------------------------------------------------
// 3. AST walker — builds a JSON Schema from a SelectionSet node
// ---------------------------------------------------------------------------

function selectionSetToSchema(selectionSet, overrides, currentPath) {
  const properties = {};

  for (const selection of selectionSet.selections) {
    if (selection.kind !== "Field") continue; // skip fragments for now

    const name = selection.name.value;
    const fieldPath = `${currentPath}.${name}`;

    if (selection.selectionSet) {
      // Object or list of objects — descend, using ".items" in path for arrays
      const childPath = isListField(name) ? `${fieldPath}.items` : fieldPath;
      const childSchema = selectionSetToSchema(selection.selectionSet, overrides, childPath);
      properties[name] = isListField(name)
        ? { type: "array", items: childSchema }
        : childSchema;
    } else {
      // Scalar leaf — check overrides first, then fall back to inference
      const overriddenType = overrides[fieldPath];
      properties[name] = { type: overriddenType ?? inferType(name) };
    }
  }

  return { type: "object", properties };
}

// ---------------------------------------------------------------------------
// 4. Entry point
// ---------------------------------------------------------------------------

function buildSchema(querySource, overrides = {}) {
  const ast = parse(querySource);

  // Find the first OperationDefinition
  const operation = ast.definitions.find(
    (d) => d.kind === "OperationDefinition"
  );
  if (!operation) throw new Error("No operation definition found in query.");

  const dataSchema = selectionSetToSchema(operation.selectionSet, overrides, "data");

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
      data: dataSchema,
    },
  };
}

module.exports = { buildSchema };

if (require.main === module) {
  const args = process.argv.slice(2);
  const queryFile = args[0];
  if (!queryFile) {
    console.error("Usage: bun graphql_schema.js <query_file.graphql> [--overrides <overrides.json>]");
    process.exit(1);
  }

  const overridesIdx = args.indexOf("--overrides");
  const overrides = overridesIdx !== -1
    ? JSON.parse(fs.readFileSync(path.resolve(args[overridesIdx + 1]), "utf8"))
    : {};

  const query = fs.readFileSync(path.resolve(queryFile), "utf8");
  const schema = buildSchema(query, overrides);
  console.log(JSON.stringify(schema, null, 2));
}
