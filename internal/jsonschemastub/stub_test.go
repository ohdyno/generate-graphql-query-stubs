package jsonschemastub

import (
	"math"
	"regexp"
	"testing"
)

func TestGenerate(t *testing.T) {
	t.Run("returns nil for nil input", func(t *testing.T) {
		if Generate(nil) != nil {
			t.Error("expected nil")
		}
	})

	t.Run("returns nil for unknown type", func(t *testing.T) {
		if Generate(map[string]any{"type": "unknown"}) != nil {
			t.Error("expected nil")
		}
	})

	t.Run("returns nil for type=null", func(t *testing.T) {
		if Generate(map[string]any{"type": "null"}) != nil {
			t.Error("expected nil")
		}
	})

	t.Run("picks from enum when present at top level", func(t *testing.T) {
		schema := map[string]any{"enum": []any{"a", "b", "c"}}
		valid := map[string]bool{"a": true, "b": true, "c": true}
		for i := 0; i < 20; i++ {
			got, ok := Generate(schema).(string)
			if !ok || !valid[got] {
				t.Errorf("unexpected value: %v", Generate(schema))
			}
		}
	})

	t.Run("handles union types, ignoring null", func(t *testing.T) {
		for i := 0; i < 20; i++ {
			val := Generate(map[string]any{"type": []any{"string", "null"}})
			if _, ok := val.(string); !ok {
				t.Errorf("expected string, got %T", val)
			}
		}
	})

	t.Run("string", func(t *testing.T) {
		t.Run("returns fixed date string for format=date", func(t *testing.T) {
			if got := Generate(map[string]any{"type": "string", "format": "date"}); got != "2024-01-01" {
				t.Errorf("got %v", got)
			}
		})

		t.Run("returns fixed datetime string for format=date-time", func(t *testing.T) {
			if got := Generate(map[string]any{"type": "string", "format": "date-time"}); got != "2024-01-01T00:00:00Z" {
				t.Errorf("got %v", got)
			}
		})

		t.Run("returns email-shaped string for format=email", func(t *testing.T) {
			val, _ := Generate(map[string]any{"type": "string", "format": "email"}).(string)
			if !regexp.MustCompile(`^[a-z]+@example\.com$`).MatchString(val) {
				t.Errorf("unexpected email: %s", val)
			}
		})

		t.Run("returns URI-shaped string for format=uri", func(t *testing.T) {
			val, _ := Generate(map[string]any{"type": "string", "format": "uri"}).(string)
			if !regexp.MustCompile(`^https://example\.com/`).MatchString(val) {
				t.Errorf("unexpected uri: %s", val)
			}
		})

		t.Run("returns slug-shaped string for plain schema", func(t *testing.T) {
			val, _ := Generate(map[string]any{"type": "string"}).(string)
			if !regexp.MustCompile(`^[a-z]+-[a-z]+$`).MatchString(val) {
				t.Errorf("unexpected string: %s", val)
			}
		})
	})

	t.Run("integer", func(t *testing.T) {
		t.Run("returns an integer", func(t *testing.T) {
			val := Generate(map[string]any{"type": "integer"})
			if _, ok := val.(int); !ok {
				t.Errorf("expected int, got %T", val)
			}
		})

		t.Run("respects minimum and maximum", func(t *testing.T) {
			for i := 0; i < 50; i++ {
				val := Generate(map[string]any{"type": "integer", "minimum": float64(10), "maximum": float64(20)}).(int)
				if val < 10 || val > 20 {
					t.Errorf("out of range: %d", val)
				}
			}
		})

		t.Run("defaults to range [1, 255]", func(t *testing.T) {
			for i := 0; i < 50; i++ {
				val := Generate(map[string]any{"type": "integer"}).(int)
				if val < 1 || val > 255 {
					t.Errorf("out of range: %d", val)
				}
			}
		})
	})

	t.Run("number", func(t *testing.T) {
		t.Run("returns a finite number", func(t *testing.T) {
			val := Generate(map[string]any{"type": "number"}).(float64)
			if math.IsInf(val, 0) || math.IsNaN(val) {
				t.Errorf("expected finite number, got %v", val)
			}
		})

		t.Run("respects minimum and maximum", func(t *testing.T) {
			for i := 0; i < 50; i++ {
				val := Generate(map[string]any{"type": "number", "minimum": 5.0, "maximum": 6.0}).(float64)
				if val < 5.0 || val > 6.0 {
					t.Errorf("out of range: %v", val)
				}
			}
		})

		t.Run("defaults to range [0.1, 2.0]", func(t *testing.T) {
			for i := 0; i < 50; i++ {
				val := Generate(map[string]any{"type": "number"}).(float64)
				if val < 0.1 || val > 2.0 {
					t.Errorf("out of range: %v", val)
				}
			}
		})
	})

	t.Run("boolean", func(t *testing.T) {
		t.Run("returns a boolean", func(t *testing.T) {
			val := Generate(map[string]any{"type": "boolean"})
			if _, ok := val.(bool); !ok {
				t.Errorf("expected bool, got %T", val)
			}
		})
	})

	t.Run("array", func(t *testing.T) {
		t.Run("returns an array", func(t *testing.T) {
			val := Generate(map[string]any{"type": "array", "items": map[string]any{"type": "string"}})
			if _, ok := val.([]any); !ok {
				t.Errorf("expected []any, got %T", val)
			}
		})

		t.Run("generates items matching the items schema", func(t *testing.T) {
			val := Generate(map[string]any{
				"type":     "array",
				"items":    map[string]any{"type": "integer"},
				"minItems": float64(5),
				"maxItems": float64(5),
			}).([]any)
			if len(val) != 5 {
				t.Errorf("expected 5 items, got %d", len(val))
			}
			for _, item := range val {
				if _, ok := item.(int); !ok {
					t.Errorf("expected int item, got %T", item)
				}
			}
		})

		t.Run("respects minItems and maxItems", func(t *testing.T) {
			for i := 0; i < 30; i++ {
				val := Generate(map[string]any{
					"type":     "array",
					"items":    map[string]any{"type": "string"},
					"minItems": float64(2),
					"maxItems": float64(4),
				}).([]any)
				if len(val) < 2 || len(val) > 4 {
					t.Errorf("length %d out of [2,4]", len(val))
				}
			}
		})

		t.Run("defaults to between 1 and 3 items", func(t *testing.T) {
			for i := 0; i < 30; i++ {
				val := Generate(map[string]any{"type": "array", "items": map[string]any{"type": "boolean"}}).([]any)
				if len(val) < 1 || len(val) > 3 {
					t.Errorf("length %d out of [1,3]", len(val))
				}
			}
		})
	})

	t.Run("object", func(t *testing.T) {
		t.Run("returns an object with all properties populated", func(t *testing.T) {
			schema := map[string]any{
				"type": "object",
				"properties": map[string]any{
					"name":   map[string]any{"type": "string"},
					"count":  map[string]any{"type": "integer"},
					"active": map[string]any{"type": "boolean"},
				},
			}
			result := Generate(schema).(map[string]any)
			if _, ok := result["name"].(string); !ok {
				t.Errorf("name: expected string, got %T", result["name"])
			}
			if _, ok := result["count"].(int); !ok {
				t.Errorf("count: expected int, got %T", result["count"])
			}
			if _, ok := result["active"].(bool); !ok {
				t.Errorf("active: expected bool, got %T", result["active"])
			}
		})

		t.Run("returns an empty object when no properties defined", func(t *testing.T) {
			result := Generate(map[string]any{"type": "object"}).(map[string]any)
			if len(result) != 0 {
				t.Errorf("expected empty map, got %v", result)
			}
		})

		t.Run("handles deeply nested schemas", func(t *testing.T) {
			schema := map[string]any{
				"type": "object",
				"properties": map[string]any{
					"users": map[string]any{
						"type": "array",
						"items": map[string]any{
							"type": "object",
							"properties": map[string]any{
								"name":  map[string]any{"type": "string"},
								"score": map[string]any{"type": "integer"},
							},
						},
					},
				},
			}
			result := Generate(schema).(map[string]any)
			users, ok := result["users"].([]any)
			if !ok {
				t.Fatalf("users: expected []any, got %T", result["users"])
			}
			for _, u := range users {
				user := u.(map[string]any)
				if _, ok := user["name"].(string); !ok {
					t.Errorf("user.name: expected string, got %T", user["name"])
				}
				if _, ok := user["score"].(int); !ok {
					t.Errorf("user.score: expected int, got %T", user["score"])
				}
			}
		})
	})
}
