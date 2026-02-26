package graphqlschema

import (
	"os"
	"regexp"
	"testing"
)

func inferredType(t *testing.T, fieldName string) string {
	t.Helper()
	schema, err := BuildSchema("query Q { thing { "+fieldName+" } }", nil)
	if err != nil {
		t.Fatalf("BuildSchema error: %v", err)
	}
	data := schema["properties"].(map[string]any)["data"].(map[string]any)
	thing := data["properties"].(map[string]any)["thing"].(map[string]any)
	return thing["properties"].(map[string]any)[fieldName].(map[string]any)["type"].(string)
}

func TestBuildSchema(t *testing.T) {
	t.Run("wraps output in a JSON Schema envelope", func(t *testing.T) {
		schema, err := BuildSchema("query GetPokemon { pokemon { name } }", nil)
		if err != nil {
			t.Fatal(err)
		}
		if got := schema["$schema"]; got != "http://json-schema.org/draft-07/schema#" {
			t.Errorf("$schema: got %q", got)
		}
		if got := schema["type"]; got != "object" {
			t.Errorf("type: got %q", got)
		}
		if schema["properties"].(map[string]any)["data"] == nil {
			t.Error("expected data property")
		}
	})

	t.Run("throws when the query has no operation definition", func(t *testing.T) {
		_, err := BuildSchema("fragment Foo on Bar { name }", nil)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !regexp.MustCompile(`no operation definition found`).MatchString(err.Error()) {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("type inference", func(t *testing.T) {
		t.Run("infers boolean for is_, has_, can_ prefixes", func(t *testing.T) {
			for _, field := range []string{"is_hidden", "is_active", "has_ability"} {
				if got := inferredType(t, field); got != "boolean" {
					t.Errorf("field %s: got %q, want %q", field, got, "boolean")
				}
			}
		})

		t.Run("infers number for float-like field names", func(t *testing.T) {
			for _, field := range []string{"success_rate", "damage_ratio"} {
				if got := inferredType(t, field); got != "number" {
					t.Errorf("field %s: got %q, want %q", field, got, "number")
				}
			}
		})

		t.Run("infers integer for numeric field names", func(t *testing.T) {
			for _, field := range []string{"base_stat", "effort", "base_experience", "height", "weight", "id", "user_id"} {
				if got := inferredType(t, field); got != "integer" {
					t.Errorf("field %s: got %q, want %q", field, got, "integer")
				}
			}
		})

		t.Run("infers string for unrecognised field names", func(t *testing.T) {
			for _, field := range []string{"name", "description", "slug"} {
				if got := inferredType(t, field); got != "string" {
					t.Errorf("field %s: got %q, want %q", field, got, "string")
				}
			}
		})
	})

	t.Run("list detection", func(t *testing.T) {
		t.Run("treats plural-suffixed object fields as arrays", func(t *testing.T) {
			query := `query Q {
				pokemon_v2_pokemonstats { name }
				pokemon_v2_pokemontypes { name }
				pokemon_v2_pokemonabilities { name }
				moves { name }
				edges { name }
				nodes { name }
			}`
			schema, err := BuildSchema(query, nil)
			if err != nil {
				t.Fatal(err)
			}
			props := schema["properties"].(map[string]any)["data"].(map[string]any)["properties"].(map[string]any)
			for _, field := range []string{"pokemon_v2_pokemonstats", "pokemon_v2_pokemontypes", "pokemon_v2_pokemonabilities", "moves", "edges", "nodes"} {
				got := props[field].(map[string]any)["type"].(string)
				if got != "array" {
					t.Errorf("field %s: got %q, want %q", field, got, "array")
				}
			}
		})

		t.Run("treats singular object fields as objects, not arrays", func(t *testing.T) {
			query := `query Q {
				pokemon_v2_stat { name }
				pokemon_v2_type { name }
				pokemon_v2_pokemon { name }
			}`
			schema, err := BuildSchema(query, nil)
			if err != nil {
				t.Fatal(err)
			}
			props := schema["properties"].(map[string]any)["data"].(map[string]any)["properties"].(map[string]any)
			for _, field := range []string{"pokemon_v2_stat", "pokemon_v2_type", "pokemon_v2_pokemon"} {
				got := props[field].(map[string]any)["type"].(string)
				if got != "object" {
					t.Errorf("field %s: got %q, want %q", field, got, "object")
				}
			}
		})

		t.Run("wraps plural-suffixed fields as array with items containing nested properties", func(t *testing.T) {
			query := `query Q {
				pokemons {
					pokemon_v2_pokemonstats {
						base_stat
					}
				}
			}`
			schema, err := BuildSchema(query, nil)
			if err != nil {
				t.Fatal(err)
			}
			dataProps := schema["properties"].(map[string]any)["data"].(map[string]any)["properties"].(map[string]any)
			pokemons := dataProps["pokemons"].(map[string]any)
			if pokemons["type"] != "array" {
				t.Errorf("pokemons type: got %q, want array", pokemons["type"])
			}
			items := pokemons["items"].(map[string]any)
			stats := items["properties"].(map[string]any)["pokemon_v2_pokemonstats"].(map[string]any)
			if stats["type"] != "array" {
				t.Errorf("pokemon_v2_pokemonstats type: got %q, want array", stats["type"])
			}
			statItems := stats["items"].(map[string]any)
			baseStat := statItems["properties"].(map[string]any)["base_stat"].(map[string]any)
			if baseStat["type"] != "integer" {
				t.Errorf("base_stat type: got %q, want integer", baseStat["type"])
			}
		})
	})

	t.Run("overrides", func(t *testing.T) {
		t.Run("applies overrides to leaf field types on list fields", func(t *testing.T) {
			query := `query Q {
				pokemons {
					name
					base_experience
				}
			}`
			overrides := map[string]string{
				"data.pokemons.items.name":            "string",
				"data.pokemons.items.base_experience": "integer",
			}
			schema, err := BuildSchema(query, overrides)
			if err != nil {
				t.Fatal(err)
			}
			dataProps := schema["properties"].(map[string]any)["data"].(map[string]any)["properties"].(map[string]any)
			items := dataProps["pokemons"].(map[string]any)["items"].(map[string]any)["properties"].(map[string]any)
			if items["name"].(map[string]any)["type"] != "string" {
				t.Errorf("name type: got %v", items["name"].(map[string]any)["type"])
			}
			if items["base_experience"].(map[string]any)["type"] != "integer" {
				t.Errorf("base_experience type: got %v", items["base_experience"].(map[string]any)["type"])
			}
		})

		t.Run("applies overrides to leaf field types on object fields", func(t *testing.T) {
			query := `query Q {
				pokemon_v2_pokemon {
					name
					base_experience
				}
			}`
			overrides := map[string]string{
				"data.pokemon_v2_pokemon.name":            "string",
				"data.pokemon_v2_pokemon.base_experience": "integer",
			}
			schema, err := BuildSchema(query, overrides)
			if err != nil {
				t.Fatal(err)
			}
			props := schema["properties"].(map[string]any)["data"].(map[string]any)["properties"].(map[string]any)["pokemon_v2_pokemon"].(map[string]any)["properties"].(map[string]any)
			if props["name"].(map[string]any)["type"] != "string" {
				t.Errorf("name type: got %v", props["name"].(map[string]any)["type"])
			}
			if props["base_experience"].(map[string]any)["type"] != "integer" {
				t.Errorf("base_experience type: got %v", props["base_experience"].(map[string]any)["type"])
			}
		})

		t.Run("override takes precedence over inferred type", func(t *testing.T) {
			query := `query Q { thing { is_hidden } }`
			overrides := map[string]string{"data.thing.is_hidden": "string"}
			schema, err := BuildSchema(query, overrides)
			if err != nil {
				t.Fatal(err)
			}
			props := schema["properties"].(map[string]any)["data"].(map[string]any)["properties"].(map[string]any)["thing"].(map[string]any)["properties"].(map[string]any)
			if props["is_hidden"].(map[string]any)["type"] != "string" {
				t.Errorf("is_hidden type: got %v", props["is_hidden"].(map[string]any)["type"])
			}
		})

		t.Run("falls back to inferred type when field is not in overrides", func(t *testing.T) {
			query := `query Q { thing { is_hidden name } }`
			overrides := map[string]string{"data.thing.is_hidden": "string"}
			schema, err := BuildSchema(query, overrides)
			if err != nil {
				t.Fatal(err)
			}
			props := schema["properties"].(map[string]any)["data"].(map[string]any)["properties"].(map[string]any)["thing"].(map[string]any)["properties"].(map[string]any)
			if props["name"].(map[string]any)["type"] != "string" {
				t.Errorf("name type: got %v", props["name"].(map[string]any)["type"])
			}
		})
	})

	t.Run("correctly handles the full pokemon_stats query", func(t *testing.T) {
		query, err := os.ReadFile("testdata/pokemon_stats.graphql")
		if err != nil {
			t.Fatalf("reading fixture: %v", err)
		}
		schema, err := BuildSchema(string(query), nil)
		if err != nil {
			t.Fatal(err)
		}

		dataProps := schema["properties"].(map[string]any)["data"].(map[string]any)["properties"].(map[string]any)
		pokemon := dataProps["pokemon_v2_pokemon"].(map[string]any)
		if pokemon["type"] != "object" {
			t.Errorf("pokemon_v2_pokemon type: got %q, want object", pokemon["type"])
		}

		props := pokemon["properties"].(map[string]any)
		for field, want := range map[string]string{
			"name":            "string",
			"base_experience": "integer",
			"height":          "integer",
			"weight":          "integer",
		} {
			if props[field].(map[string]any)["type"] != want {
				t.Errorf("%s type: got %v, want %s", field, props[field].(map[string]any)["type"], want)
			}
		}

		stats := props["pokemon_v2_pokemonstats"].(map[string]any)
		if stats["type"] != "array" {
			t.Errorf("pokemon_v2_pokemonstats type: got %v, want array", stats["type"])
		}
		statItems := stats["items"].(map[string]any)["properties"].(map[string]any)
		if statItems["base_stat"].(map[string]any)["type"] != "integer" {
			t.Errorf("base_stat type: got %v", statItems["base_stat"].(map[string]any)["type"])
		}
		if statItems["effort"].(map[string]any)["type"] != "integer" {
			t.Errorf("effort type: got %v", statItems["effort"].(map[string]any)["type"])
		}

		abilities := props["pokemon_v2_pokemonabilities"].(map[string]any)
		if abilities["type"] != "array" {
			t.Errorf("pokemon_v2_pokemonabilities type: got %v, want array", abilities["type"])
		}
		abilityItems := abilities["items"].(map[string]any)["properties"].(map[string]any)
		if abilityItems["is_hidden"].(map[string]any)["type"] != "boolean" {
			t.Errorf("is_hidden type: got %v, want boolean", abilityItems["is_hidden"].(map[string]any)["type"])
		}
	})
}
