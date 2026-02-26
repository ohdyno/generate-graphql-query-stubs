const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildSchema, inferType, isListField } = require("./graphql_schema");

// ---------------------------------------------------------------------------
// inferType
// ---------------------------------------------------------------------------

describe("inferType", () => {
  it("returns 'boolean' for is_ prefix", () => {
    assert.equal(inferType("is_hidden"), "boolean");
    assert.equal(inferType("is_active"), "boolean");
  });

  it("returns 'boolean' for has_ prefix", () => {
    assert.equal(inferType("has_ability"), "boolean");
  });

  it("returns 'number' for float-like field names", () => {
    assert.equal(inferType("success_rate"), "number");
    assert.equal(inferType("damage_ratio"), "number");
  });

  it("returns 'integer' for numeric field names", () => {
    assert.equal(inferType("base_stat"), "integer");
    assert.equal(inferType("effort"), "integer");
    assert.equal(inferType("base_experience"), "integer");
    assert.equal(inferType("height"), "integer");
    assert.equal(inferType("weight"), "integer");
    assert.equal(inferType("id"), "integer");
    assert.equal(inferType("user_id"), "integer");
  });

  it("returns 'string' for unrecognised field names", () => {
    assert.equal(inferType("name"), "string");
    assert.equal(inferType("description"), "string");
    assert.equal(inferType("slug"), "string");
  });
});

// ---------------------------------------------------------------------------
// isListField
// ---------------------------------------------------------------------------

describe("isListField", () => {
  it("returns true for plural-suffixed field names", () => {
    assert.equal(isListField("pokemon_v2_pokemonstats"), true);
    assert.equal(isListField("pokemon_v2_pokemontypes"), true);
    assert.equal(isListField("pokemon_v2_pokemonabilities"), true);
    assert.equal(isListField("moves"), true);
    assert.equal(isListField("edges"), true);
    assert.equal(isListField("nodes"), true);
  });

  it("returns false for singular field names", () => {
    assert.equal(isListField("pokemon_v2_stat"), false);
    assert.equal(isListField("pokemon_v2_type"), false);
    assert.equal(isListField("name"), false);
  });
});

// ---------------------------------------------------------------------------
// buildSchema — top-level structure
// ---------------------------------------------------------------------------

describe("buildSchema", () => {
  const SIMPLE_QUERY = `
    query GetPokemon {
      pokemon {
        name
        weight
      }
    }
  `;

  it("wraps output in a JSON Schema envelope", () => {
    const schema = buildSchema(SIMPLE_QUERY);
    assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
    assert.equal(schema.type, "object");
    assert.ok(schema.properties.data);
  });

  it("produces object properties for nested fields", () => {
    const schema = buildSchema(SIMPLE_QUERY);
    const pokemon = schema.properties.data.properties.pokemon;
    assert.equal(pokemon.type, "object");
    assert.equal(pokemon.properties.name.type, "string");
    assert.equal(pokemon.properties.weight.type, "integer");
  });

  it("throws when the query has no operation definition", () => {
    // A fragment-only document parses successfully but has no OperationDefinition
    assert.throws(
      () => buildSchema("fragment Foo on Bar { name }"),
      /No operation definition found/
    );
  });

  // -------------------------------------------------------------------------
  // List fields
  // -------------------------------------------------------------------------

  it("wraps plural-suffixed fields as array with items", () => {
    // Field names ending in 's' (or known suffixes) are treated as lists
    const query = `
      query Q {
        pokemons {
          pokemon_v2_pokemonstats {
            base_stat
          }
        }
      }
    `;
    const schema = buildSchema(query);
    const pokemons = schema.properties.data.properties.pokemons;
    assert.equal(pokemons.type, "array");

    const stats = pokemons.items.properties.pokemon_v2_pokemonstats;
    assert.equal(stats.type, "array");
    assert.equal(stats.items.properties.base_stat.type, "integer");
  });

  it("treats non-plural fields as objects, not arrays", () => {
    // pokemon_v2_pokemon ends in 'n', so the heuristic returns object
    const query = `
      query Q {
        pokemon_v2_pokemon {
          name
        }
      }
    `;
    const schema = buildSchema(query);
    const pokemon = schema.properties.data.properties.pokemon_v2_pokemon;
    assert.equal(pokemon.type, "object");
    assert.equal(pokemon.properties.name.type, "string");
  });

  // -------------------------------------------------------------------------
  // Overrides
  // -------------------------------------------------------------------------

  it("applies overrides to leaf field types on list fields", () => {
    // Use a plural field name so the list heuristic kicks in
    const query = `
      query Q {
        pokemons {
          name
          base_experience
        }
      }
    `;
    const overrides = {
      "data.pokemons.items.name": "string",
      "data.pokemons.items.base_experience": "integer",
    };
    const schema = buildSchema(query, overrides);
    const props = schema.properties.data.properties.pokemons.items.properties;
    assert.equal(props.name.type, "string");
    assert.equal(props.base_experience.type, "integer");
  });

  it("applies overrides to leaf field types on object fields", () => {
    const query = `
      query Q {
        pokemon_v2_pokemon {
          name
          base_experience
        }
      }
    `;
    const overrides = {
      "data.pokemon_v2_pokemon.name": "string",
      "data.pokemon_v2_pokemon.base_experience": "integer",
    };
    const schema = buildSchema(query, overrides);
    const props = schema.properties.data.properties.pokemon_v2_pokemon.properties;
    assert.equal(props.name.type, "string");
    assert.equal(props.base_experience.type, "integer");
  });

  it("override takes precedence over inferred type", () => {
    const query = `
      query Q {
        thing {
          is_hidden
        }
      }
    `;
    // is_hidden would normally infer as boolean; override to string
    const overrides = { "data.thing.is_hidden": "string" };
    const schema = buildSchema(query, overrides);
    assert.equal(schema.properties.data.properties.thing.properties.is_hidden.type, "string");
  });

  it("falls back to inferred type when field is not in overrides", () => {
    const query = `
      query Q {
        thing {
          is_hidden
          name
        }
      }
    `;
    const overrides = { "data.thing.is_hidden": "string" };
    const schema = buildSchema(query, overrides);
    const props = schema.properties.data.properties.thing.properties;
    // name not in overrides — should fall back to inferred "string"
    assert.equal(props.name.type, "string");
  });

  // -------------------------------------------------------------------------
  // Full pokemon query
  // -------------------------------------------------------------------------

  it("correctly handles the full pokemon_stats query", () => {
    const fs = require("fs");
    const query = fs.readFileSync("pokemon_stats.graphql", "utf8");
    const schema = buildSchema(query);

    // pokemon_v2_pokemon ends in 'n' — heuristic treats it as an object
    const pokemon = schema.properties.data.properties.pokemon_v2_pokemon;
    assert.equal(pokemon.type, "object");

    const props = pokemon.properties;
    assert.equal(props.name.type, "string");
    assert.equal(props.base_experience.type, "integer");
    assert.equal(props.height.type, "integer");
    assert.equal(props.weight.type, "integer");

    // Nested plural fields are correctly detected as arrays
    const stats = props.pokemon_v2_pokemonstats;
    assert.equal(stats.type, "array");
    assert.equal(stats.items.properties.base_stat.type, "integer");
    assert.equal(stats.items.properties.effort.type, "integer");

    const abilities = props.pokemon_v2_pokemonabilities;
    assert.equal(abilities.type, "array");
    assert.equal(abilities.items.properties.is_hidden.type, "boolean");
  });
});
