# Agentic Guidelines

## Running Bun Commands
- Always invoke bun via `mise exec -- bun <args>` (e.g. `mise exec -- bun test`)
- Never call `bun` directly, as it is not on the PATH

## When Committing Changes Using Git
- Structure the commit message using conventional commit style
- Include the why or overall goal of the changes in the commit message
- Refrain from including details that can be discovered by reading the commit diff
