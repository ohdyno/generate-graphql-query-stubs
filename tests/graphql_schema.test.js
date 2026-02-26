const { describe, it, expect } = require("bun:test");
const { buildSchema, inferType, isListField } = require("../src/graphql_schema");

// ---------------------------------------------------------------------------
// inferType
// ---------------------------------------------------------------------------

describe("inferType", () => {
  it("returns 'boolean' for is_ prefix", () => {
    expect(inferType("is_hidden")).toBe("boolean");
    expect(inferType("is_active")).toBe("boolean");
  });

  it("returns 'boolean' for has_ prefix", () => {
    expect(inferType("has_ability")).toBe("boolean");
  });

  it("returns 'number' for float-like field names", () => {
    expect(inferType("success_rate")).toBe("number");
    expect(inferType("damage_ratio")).toBe("number");
  });

  it("returns 'integer' for numeric field names", () => {
    expect(inferType("base_stat")).toBe("integer");
    expect(inferType("effort")).toBe("integer");
    expect(inferType("base_experience")).toBe("integer");
    expect(inferType("height")).toBe("integer");
    expect(inferType("weight")).toBe("integer");
    expect(inferType("id")).toBe("integer");
    expect(inferType("user_id")).toBe("integer");
  });

  it("returns 'string' for unrecognised field names", () => {
    expect(inferType("name")).toBe("string");
    expect(inferType("description")).toBe("string");
    expect(inferType("slug")).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// isListField
// ---------------------------------------------------------------------------

describe("isListField", () => {
  it("returns true for plural-suffixed field names", () => {
    expect(isListField("pokemon_v2_pokemonstats")).toBe(true);
    expect(isListField("pokemon_v2_pokemontypes")).toBe(true);
    expect(isListField("pokemon_v2_pokemonabilities")).toBe(true);
    expect(isListField("moves")).toBe(true);
    expect(isListField("edges")).toBe(true);
    expect(isListField("nodes")).toBe(true);
  });

  it("returns false for singular field names", () => {
    expect(isListField("pokemon_v2_stat")).toBe(false);
    expect(isListField("pokemon_v2_type")).toBe(false);
    expect(isListField("name")).toBe(false);
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
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.type).toBe("object");
    expect(schema.properties.data).toBeTruthy();
  });

  it("produces object properties for nested fields", () => {
    const schema = buildSchema(SIMPLE_QUERY);
    const pokemon = schema.properties.data.properties.pokemon;
    expect(pokemon.type).toBe("object");
    expect(pokemon.properties.name.type).toBe("string");
    expect(pokemon.properties.weight.type).toBe("integer");
  });

  it("throws when the query has no operation definition", () => {
    // A fragment-only document parses successfully but has no OperationDefinition
    expect(() => buildSchema("fragment Foo on Bar { name }")).toThrow(/No operation definition found/);
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
    expect(pokemons.type).toBe("array");

    const stats = pokemons.items.properties.pokemon_v2_pokemonstats;
    expect(stats.type).toBe("array");
    expect(stats.items.properties.base_stat.type).toBe("integer");
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
    expect(pokemon.type).toBe("object");
    expect(pokemon.properties.name.type).toBe("string");
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
    expect(props.name.type).toBe("string");
    expect(props.base_experience.type).toBe("integer");
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
    expect(props.name.type).toBe("string");
    expect(props.base_experience.type).toBe("integer");
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
    expect(schema.properties.data.properties.thing.properties.is_hidden.type).toBe("string");
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
    expect(props.name.type).toBe("string");
  });

  // -------------------------------------------------------------------------
  // Full pokemon query
  // -------------------------------------------------------------------------

  it("correctly handles the full pokemon_stats query", () => {
    const fs = require("fs");
    const query = fs.readFileSync("tests/fixtures/pokemon_stats.graphql", "utf8");
    const schema = buildSchema(query);

    // pokemon_v2_pokemon ends in 'n' — heuristic treats it as an object
    const pokemon = schema.properties.data.properties.pokemon_v2_pokemon;
    expect(pokemon.type).toBe("object");

    const props = pokemon.properties;
    expect(props.name.type).toBe("string");
    expect(props.base_experience.type).toBe("integer");
    expect(props.height.type).toBe("integer");
    expect(props.weight.type).toBe("integer");

    // Nested plural fields are correctly detected as arrays
    const stats = props.pokemon_v2_pokemonstats;
    expect(stats.type).toBe("array");
    expect(stats.items.properties.base_stat.type).toBe("integer");
    expect(stats.items.properties.effort.type).toBe("integer");

    const abilities = props.pokemon_v2_pokemonabilities;
    expect(abilities.type).toBe("array");
    expect(abilities.items.properties.is_hidden.type).toBe("boolean");
  });
});
