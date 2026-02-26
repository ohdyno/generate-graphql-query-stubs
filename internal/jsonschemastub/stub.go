package jsonschemastub

import (
	"fmt"
	"math/rand"
	"strconv"
)

var words = []string{
	"azure", "blaze", "cedar", "dusk", "ember", "frost", "gale", "haze",
	"iris", "jade", "kite", "lark", "mist", "nova", "onyx", "pine",
	"quill", "rune", "sage", "thorn", "umber", "vale", "wren", "zeal",
}

func pick(arr []string) string {
	return arr[rand.Intn(len(arr))]
}

func randInt(min, max int) int {
	return rand.Intn(max-min+1) + min
}

func randFloat(min, max float64) float64 {
	v := rand.Float64()*(max-min) + min
	f, _ := strconv.ParseFloat(fmt.Sprintf("%.2f", v), 64)
	return f
}

func generateString(schema map[string]any) string {
	if enum, ok := schema["enum"].([]any); ok {
		return enum[rand.Intn(len(enum))].(string)
	}
	if format, ok := schema["format"].(string); ok {
		switch format {
		case "date":
			return "2024-01-01"
		case "date-time":
			return "2024-01-01T00:00:00Z"
		case "email":
			return pick(words) + "@example.com"
		case "uri":
			return "https://example.com/" + pick(words)
		}
	}
	return pick(words) + "-" + pick(words)
}

func generateInteger(schema map[string]any) int {
	min := 1
	max := 255
	if v, ok := schema["minimum"].(float64); ok {
		min = int(v)
	}
	if v, ok := schema["maximum"].(float64); ok {
		max = int(v)
	}
	return randInt(min, max)
}

func generateNumber(schema map[string]any) float64 {
	min := 0.1
	max := 2.0
	if v, ok := schema["minimum"].(float64); ok {
		min = v
	}
	if v, ok := schema["maximum"].(float64); ok {
		max = v
	}
	return randFloat(min, max)
}

func generateArray(schema map[string]any) []any {
	itemSchema := map[string]any{}
	if items, ok := schema["items"].(map[string]any); ok {
		itemSchema = items
	}

	minItems := 1
	maxItems := 3
	if v, ok := schema["minItems"].(float64); ok {
		minItems = int(v)
	}
	if v, ok := schema["maxItems"].(float64); ok {
		maxItems = int(v)
	}

	length := randInt(minItems, maxItems)
	result := make([]any, length)
	for i := range result {
		result[i] = Generate(itemSchema)
	}
	return result
}

func generateObject(schema map[string]any) map[string]any {
	result := map[string]any{}
	properties, ok := schema["properties"].(map[string]any)
	if !ok {
		return result
	}
	for key, propSchema := range properties {
		if ps, ok := propSchema.(map[string]any); ok {
			result[key] = Generate(ps)
		}
	}
	return result
}

// Generate produces a mock value matching the given JSON Schema.
func Generate(schema map[string]any) any {
	if schema == nil {
		return nil
	}

	if enum, ok := schema["enum"].([]any); ok {
		return enum[rand.Intn(len(enum))]
	}

	var t string
	switch v := schema["type"].(type) {
	case string:
		t = v
	case []any:
		for _, item := range v {
			if s, ok := item.(string); ok && s != "null" {
				t = s
				break
			}
		}
		if t == "" && len(v) > 0 {
			t, _ = v[0].(string)
		}
	}

	switch t {
	case "object":
		return generateObject(schema)
	case "array":
		return generateArray(schema)
	case "string":
		return generateString(schema)
	case "integer":
		return generateInteger(schema)
	case "number":
		return generateNumber(schema)
	case "boolean":
		return rand.Float64() < 0.5
	case "null":
		return nil
	default:
		return nil
	}
}
