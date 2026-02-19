# Doctrine DBAL Parity Map (Best Effort)

This project keeps namespace/folder parity with Doctrine DBAL where possible, while still fitting TypeScript and Node driver constraints.

## Rules

- Keep one class/interface per file.
- Keep folder structure aligned with Doctrine namespaces whenever that namespace exists in this port.
- Use Node-specific names only where Doctrine has no equivalent (for example `driver/mysql2`, `driver/mssql`).
- Prefer adding Doctrine-like aliases/shims instead of breaking existing imports.
- Awlays add tests for new features and to cover any gaps in existing test coverage.
- Validate against Doctrine's test suite where possible, and add any missing tests to this project as needed.
- Run "bun run format" and "bun run test" before submitting any changes to ensure code quality and test coverage.
- Once validated add a summary of your changes in CHANGELOG.md

## Current Namespace Parity

- `src/connection.ts` <-> `Doctrine\DBAL\Connection`
- `src/driver-manager.ts` <-> `Doctrine\DBAL\DriverManager`
- `src/result.ts` <-> `Doctrine\DBAL\Result`
- `src/statement.ts` <-> `Doctrine\DBAL\Statement`
- `src/query/*` <-> `Doctrine\DBAL\Query\*`
- `src/platforms/*` <-> `Doctrine\DBAL\Platforms\*`
- `src/platforms/exception/*` <-> `Doctrine\DBAL\Platforms\Exception\*`
- `src/sql/parser.ts` <-> `Doctrine\DBAL\SQL\Parser`
- `src/sql/parser/visitor.ts` <-> `Doctrine\DBAL\SQL\Parser\Visitor`
- `src/sql/parser/exception.ts` <-> `Doctrine\DBAL\SQL\Parser\Exception`
- `src/sql/parser/exception/regular-expression-error.ts` <-> `Doctrine\DBAL\SQL\Parser\Exception\RegularExpressionError`
- `src/driver/api/exception-converter.ts` <-> `Doctrine\DBAL\Driver\API\ExceptionConverter`
- `src/driver/api/mysql/exception-converter.ts` <-> `Doctrine\DBAL\Driver\API\MySQL\ExceptionConverter`
- `src/driver/api/sqlsrv/exception-converter.ts` <-> `Doctrine\DBAL\Driver\API\SQLSrv\ExceptionConverter`
- `src/types/*` <-> `Doctrine\DBAL\Types\*`
- `src/types/exception/*` <-> `Doctrine\DBAL\Types\Exception\*`

## Test Namespace Parity (Best Effort)

- `src/__tests__/connection/*` <-> `Doctrine\DBAL\Tests\Connection\*`
- `src/__tests__/driver/*` <-> `Doctrine\DBAL\Tests\Driver\*`
- `src/__tests__/parameter/*` <-> `Doctrine\DBAL\Tests\ArrayParameters\*` + execution parameter coverage
- `src/__tests__/platforms/*` <-> `Doctrine\DBAL\Tests\Platforms\*`
- `src/__tests__/query/*` <-> `Doctrine\DBAL\Tests\Query\*`
- `src/__tests__/result/*` <-> `Doctrine\DBAL\Tests\Result\*`
- `src/__tests__/sql/*` <-> `Doctrine\DBAL\Tests\SQL\Parser\*`
- `src/__tests__/statement/*` <-> `Doctrine\DBAL\Tests\Statement\*`
- `src/__tests__/types/*` <-> `Doctrine\DBAL\Tests\Types\*`

## Intentional TS/Node Deviations

- `src/driver/mysql2/*` and `src/driver/mssql/*` are Node-driver adapters, not PDO driver ports.
- Filenames are kebab-case for TypeScript consistency, but map 1:1 to Doctrine classes where implemented.
