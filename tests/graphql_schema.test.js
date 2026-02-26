const { describe, it, expect } = require("bun:test");
const { buildSchema } = require("../src/graphql_schema");

// Returns the inferred schema type for a single scalar field nested inside a
// singular (non-list) parent object, exercising type inference end-to-end.
function inferredType(fieldName) {
  const schema = buildSchema(`query Q { thing { ${fieldName} } }`);
  return schema.properties.data.properties.thing.properties[fieldName].type;
}

describe("buildSchema", () => {
  it("wraps output in a JSON Schema envelope", () => {
    const schema = buildSchema(`query GetPokemon { pokemon { name } }`);
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.type).toBe("object");
    expect(schema.properties.data).toBeTruthy();
  });

  it("throws when the query has no operation definition", () => {
    expect(() => buildSchema("fragment Foo on Bar { name }")).toThrow(/No operation definition found/);
  });

  // -------------------------------------------------------------------------
  // Type inference
  // -------------------------------------------------------------------------

  describe("type inference", () => {
    it("infers 'boolean' for is_, has_, can_ prefixes", () => {
      expect(inferredType("is_hidden")).toBe("boolean");
      expect(inferredType("is_active")).toBe("boolean");
      expect(inferredType("has_ability")).toBe("boolean");
    });

    it("infers 'number' for float-like field names", () => {
      expect(inferredType("success_rate")).toBe("number");
      expect(inferredType("damage_ratio")).toBe("number");
    });

    it("infers 'integer' for numeric field names", () => {
      expect(inferredType("base_stat")).toBe("integer");
      expect(inferredType("effort")).toBe("integer");
      expect(inferredType("base_experience")).toBe("integer");
      expect(inferredType("height")).toBe("integer");
      expect(inferredType("weight")).toBe("integer");
      expect(inferredType("id")).toBe("integer");
      expect(inferredType("user_id")).toBe("integer");
    });

    it("infers 'string' for unrecognised field names", () => {
      expect(inferredType("name")).toBe("string");
      expect(inferredType("description")).toBe("string");
      expect(inferredType("slug")).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // List detection
  // -------------------------------------------------------------------------

  describe("list detection", () => {
    it("treats plural-suffixed object fields as arrays", () => {
      const query = `
        query Q {
          pokemon_v2_pokemonstats { name }
          pokemon_v2_pokemontypes { name }
          pokemon_v2_pokemonabilities { name }
          moves { name }
          edges { name }
          nodes { name }
        }
      `;
      const data = buildSchema(query).properties.data.properties;
      expect(data.pokemon_v2_pokemonstats.type).toBe("array");
      expect(data.pokemon_v2_pokemontypes.type).toBe("array");
      expect(data.pokemon_v2_pokemonabilities.type).toBe("array");
      expect(data.moves.type).toBe("array");
      expect(data.edges.type).toBe("array");
      expect(data.nodes.type).toBe("array");
    });

    it("treats singular object fields as objects, not arrays", () => {
      const query = `
        query Q {
          pokemon_v2_stat { name }
          pokemon_v2_type { name }
          pokemon_v2_pokemon { name }
        }
      `;
      const data = buildSchema(query).properties.data.properties;
      expect(data.pokemon_v2_stat.type).toBe("object");
      expect(data.pokemon_v2_type.type).toBe("object");
      expect(data.pokemon_v2_pokemon.type).toBe("object");
    });

    it("wraps plural-suffixed fields as array with items containing nested properties", () => {
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
  });

  // -------------------------------------------------------------------------
  // Overrides
  // -------------------------------------------------------------------------

  describe("overrides", () => {
    it("applies overrides to leaf field types on list fields", () => {
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
