package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/ohdyno/generate-graphql-query-stubs/internal/graphqlschema"
	"github.com/ohdyno/generate-graphql-query-stubs/internal/jsonschemastub"
	"github.com/spf13/cobra"
)

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

var rootCmd = &cobra.Command{
	Use:   "generate-graphql-query-stubs",
	Short: "Generate stub data from GraphQL queries",
}

var overridesFile string

var schemaCmd = &cobra.Command{
	Use:   "schema [query.graphql]",
	Short: "Generate a JSON Schema from a GraphQL query",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runSchema,
}

var stubCmd = &cobra.Command{
	Use:   "stub [schema.json]",
	Short: "Generate stub data from a JSON Schema",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runStub,
}

func init() {
	schemaCmd.Flags().StringVar(&overridesFile, "overrides", "", "path to overrides JSON file")
	rootCmd.AddCommand(schemaCmd, stubCmd)
}

func runSchema(_ *cobra.Command, args []string) error {
	overrides := map[string]string{}
	if overridesFile != "" {
		data, err := os.ReadFile(filepath.Clean(overridesFile))
		if err != nil {
			return fmt.Errorf("reading overrides: %w", err)
		}
		if err := json.Unmarshal(data, &overrides); err != nil {
			return fmt.Errorf("parsing overrides: %w", err)
		}
	}

	var query []byte
	var err error
	if len(args) > 0 {
		query, err = os.ReadFile(filepath.Clean(args[0]))
	} else {
		query, err = io.ReadAll(os.Stdin)
	}
	if err != nil {
		return err
	}

	schema, err := graphqlschema.BuildSchema(string(query), overrides)
	if err != nil {
		return err
	}

	out, _ := json.MarshalIndent(schema, "", "  ")
	fmt.Println(string(out))
	return nil
}

func runStub(_ *cobra.Command, args []string) error {
	var input []byte
	var err error
	if len(args) > 0 {
		input, err = os.ReadFile(filepath.Clean(args[0]))
	} else {
		input, err = io.ReadAll(os.Stdin)
	}
	if err != nil {
		return err
	}

	var schema map[string]any
	if err := json.Unmarshal(input, &schema); err != nil {
		return fmt.Errorf("parsing JSON schema: %w", err)
	}

	result := jsonschemastub.Generate(schema)
	out, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(out))
	return nil
}
