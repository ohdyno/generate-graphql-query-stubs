# GraphQL Query Stub Generator

A small utility that turns a GraphQL query file into realistic mock data — useful for testing, prototyping, or building UI without a live API.

The pipeline has two steps:

1. **`graphql_schema.js`** — parses a `.graphql` query and emits a JSON Schema describing the response shape, inferring scalar types from field names.
2. **`json_schema_mock.js`** — takes a JSON Schema and generates a mock object filled with plausible values.

The two scripts are designed to be piped together.

## Prerequisites

- [mise](https://mise.jdx.dev/) with `bun` configured (see `mise.toml`)

## Install dependencies

```sh
mise exec -- bun install
```

## Generate a JSON Schema from a GraphQL query

```sh
mise exec -- bun src/graphql_schema.js tests/fixtures/pokemon_stats.graphql
```

Pass an overrides file to force specific field types:

```sh
mise exec -- bun src/graphql_schema.js query.graphql --overrides overrides.json
```

Overrides file format (dot-path keys):

```json
{
  "data.pokemon_v2_pokemon.items.name": "string",
  "data.pokemon_v2_pokemon.items.base_experience": "integer"
}
```

## Generate mock data from a JSON Schema

```sh
mise exec -- bun src/json_schema_mock.js schema.json
```

Or pipe directly from the schema generator:

```sh
mise exec -- bun src/graphql_schema.js query.graphql | mise exec -- bun src/json_schema_mock.js
```

## Run tests

```sh
mise exec -- bun test
```

## Contributing

**Running commands:** Always invoke bun via `mise exec -- bun <args>` to ensure the correct bun version is used. Never call `bun` directly.

**Commit messages:** Follow [conventional commits](https://www.conventionalcommits.org/) style. Include the *why* or overall goal of the change in the message body — skip details that are already visible in the diff.
