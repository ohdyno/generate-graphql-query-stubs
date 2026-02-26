# GraphQL Query Stub Generator

A small utility that turns a GraphQL query file into realistic stub data — useful for testing, prototyping, or building UI without a live API.

The pipeline has two subcommands:

1. **`schema`** — parses a `.graphql` query and emits a JSON Schema describing the response shape, inferring scalar types from field names.
2. **`stub`** — takes a JSON Schema and generates a stub object filled with plausible values.

The two subcommands are designed to be piped together.

## Install

```sh
go install github.com/ohdyno/generate-graphql-query-stubs/cmd/generate-graphql-query-stubs@latest
```

This places `generate-graphql-query-stubs` in `$GOPATH/bin`.

## Prerequisites (for development)

- [mise](https://mise.jdx.dev/) with `go` configured (see `mise.toml`)

## Install dependencies

```sh
mise exec -- go mod download
```

## Generate a JSON Schema from a GraphQL query

```sh
mise exec -- go run ./cmd/generate-graphql-query-stubs schema query.graphql
```

Or pipe a query via stdin:

```sh
cat query.graphql | mise exec -- go run ./cmd/generate-graphql-query-stubs schema
```

Pass an overrides file to force specific field types:

```sh
mise exec -- go run ./cmd/generate-graphql-query-stubs schema query.graphql --overrides overrides.json
```

Overrides file format (dot-path keys):

```json
{
  "data.pokemon_v2_pokemon.items.name": "string",
  "data.pokemon_v2_pokemon.items.base_experience": "integer"
}
```

## Generate a stub from a JSON Schema

```sh
mise exec -- go run ./cmd/generate-graphql-query-stubs stub schema.json
```

Or pipe directly from the schema subcommand:

```sh
mise exec -- go run ./cmd/generate-graphql-query-stubs schema query.graphql | mise exec -- go run ./cmd/generate-graphql-query-stubs stub
```

## Build binary

```sh
mise exec -- go build ./cmd/...
```

## Run tests

```sh
mise exec -- go test ./...
```

## Contributing

**Running commands:** Always invoke go via `mise exec -- go <args>` to ensure the correct Go version is used. Never call `go` directly.

**Commit messages:** Follow [conventional commits](https://www.conventionalcommits.org/) style. Keep messages succinct — the diff covers the details. Use the body only when the *why* isn't obvious from the diff.
