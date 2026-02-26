package graphqlschema

import (
	"errors"
	"regexp"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

var (
	intRE   = regexp.MustCompile(`(?i)_id$|^id$|_stat$|effort|experience|height|weight|count|level|order|floor|generation|accuracy|power|pp|priority|damage|speed|attack|defense|^hp$|age|quantity|amount|total|size|rank|score|index|position|duration`)
	boolRE  = regexp.MustCompile(`(?i)^is_|^has_|^can_|^show_|^enable`)
	floatRE = regexp.MustCompile(`(?i)rate|ratio|factor|chance|multiplier|percent|latitude|longitude`)
	listRE  = regexp.MustCompile(`s$|types$|stats$|abilities$|moves$|items$|forms$|results$|edges$|nodes$`)
)

func inferType(fieldName string) string {
	if boolRE.MatchString(fieldName) {
		return "boolean"
	}
	if floatRE.MatchString(fieldName) {
		return "number"
	}
	if intRE.MatchString(fieldName) {
		return "integer"
	}
	return "string"
}

func isListField(fieldName string) bool {
	return listRE.MatchString(fieldName)
}

func selectionSetToSchema(selectionSet ast.SelectionSet, overrides map[string]string, currentPath string) map[string]any {
	properties := map[string]any{}

	for _, sel := range selectionSet {
		field, ok := sel.(*ast.Field)
		if !ok {
			continue // skip fragments
		}

		name := field.Name
		fieldPath := currentPath + "." + name

		if len(field.SelectionSet) > 0 {
			childPath := fieldPath
			if isListField(name) {
				childPath = fieldPath + ".items"
			}
			childSchema := selectionSetToSchema(field.SelectionSet, overrides, childPath)
			if isListField(name) {
				properties[name] = map[string]any{"type": "array", "items": childSchema}
			} else {
				properties[name] = childSchema
			}
		} else {
			t := inferType(name)
			if overriddenType, ok := overrides[fieldPath]; ok {
				t = overriddenType
			}
			properties[name] = map[string]any{"type": t}
		}
	}

	return map[string]any{"type": "object", "properties": properties}
}

// BuildSchema parses a GraphQL query string and returns a JSON Schema as a nested map.
// The overrides parameter maps dot-path field paths to JSON Schema type strings.
func BuildSchema(querySource string, overrides map[string]string) (map[string]any, error) {
	if overrides == nil {
		overrides = map[string]string{}
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: querySource})
	if err != nil {
		return nil, err
	}

	if len(doc.Operations) == 0 {
		return nil, errors.New("no operation definition found in query")
	}

	operation := doc.Operations[0]
	dataSchema := selectionSetToSchema(operation.SelectionSet, overrides, "data")

	return map[string]any{
		"$schema": "http://json-schema.org/draft-07/schema#",
		"type":    "object",
		"properties": map[string]any{
			"data": dataSchema,
		},
	}, nil
}
