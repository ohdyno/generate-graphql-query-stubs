#!/usr/bin/env node
/**
 * Parses a GraphQL query file and outputs a JSON Schema of the response shape.
 * Uses the `graphql` package for AST parsing; infers scalar types from field names.
 *
 * Usage: node graphql_schema.js <query_file.graphql>
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

function selectionSetToSchema(selectionSet) {
  const properties = {};

  for (const selection of selectionSet.selections) {
    if (selection.kind !== "Field") continue; // skip fragments for now

    const name = selection.name.value;

    if (selection.selectionSet) {
      // Object or list of objects
      const childSchema = selectionSetToSchema(selection.selectionSet);
      properties[name] = isListField(name)
        ? { type: "array", items: childSchema }
        : childSchema;
    } else {
      // Scalar leaf
      properties[name] = { type: inferType(name) };
    }
  }

  return { type: "object", properties };
}

// ---------------------------------------------------------------------------
// 4. Entry point
// ---------------------------------------------------------------------------

function buildSchema(querySource) {
  const ast = parse(querySource);

  // Find the first OperationDefinition
  const operation = ast.definitions.find(
    (d) => d.kind === "OperationDefinition"
  );
  if (!operation) throw new Error("No operation definition found in query.");

  const dataSchema = selectionSetToSchema(operation.selectionSet);

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
      data: dataSchema,
    },
  };
}

const queryFile = process.argv[2];
if (!queryFile) {
  console.error("Usage: node graphql_schema.js <query_file.graphql>");
  process.exit(1);
}

const query = fs.readFileSync(path.resolve(queryFile), "utf8");
const schema = buildSchema(query);
console.log(JSON.stringify(schema, null, 2));
