# Doctrine DBAL Parity Map (Best Effort)

This project keeps namespace/folder parity with Doctrine DBAL where possible, while still fitting TypeScript and Node driver constraints.

## Rules

- Keep one class/interface per file.
- Keep folder structure aligned with Doctrine namespaces whenever that namespace exists in this port.
- Use Node-specific names only where Doctrine has no equivalent (for example `driver/mysql2`, `driver/mssql`).
- Prefer adding Doctrine-like aliases/shims instead of breaking existing imports.
- Awlays add tests for new features and to cover any gaps in existing test coverage.
- Validate against Doctrine's test suite where possible, and add any missing tests to this project as needed.
- PHP should be refered as "Node" in code and documentation
- Doctrine should be refered as "Datazen" in code and documentation
- Run "bun run format" and "bun run test" before submitting any changes to ensure code quality and test coverage.
- When in doubt, follow Doctrine's implementation and naming conventions as closely as possible, while still adhering to TypeScript best practices and Node idioms.
- When a task is a refactoring, breaking changes are allowed, even full rewrites, refactorings, and reorgs.
- Try to keep 1:1 parity with Doctrine's classes and interfaces as much as possible, but don't be afraid to deviate a bit when it makes sense for TypeScript or Node.
- OCI8,PDO, MySQLI are native to PHP and have no direct equivalent in Node so ignore any references to those in Doctrine.
- mysql2, mssql, pgsql, sqlite3 are node drivers that have some similarities to PDO drivers but are not direct ports, so treat them as their own unique implementations and only borrow concepts and patterns from Doctrine where it makes sense.
- use "./" imports for internal modules to avoid relative import hell and make it easier to refactor and reorganize code without breaking imports.
- Once validated add a summary of your changes in CHANGELOG.md

## Intentional TS/Node Deviations

- `src/driver/mysql2/*` and `src/driver/mssql/*` are Node-driver adapters, not PDO driver ports.
- Filenames are kebab-case for TypeScript consistency, but map 1:1 to Doctrine classes where implemented.
