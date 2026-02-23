# @devscast/datazen

# Unreleased
- Breaking: made `Driver.getDatabasePlatform(versionProvider)` driver-owned and required, removed `Connection` driver-name platform fallbacks, added Doctrine-style `StaticServerVersionProvider` selection from `serverVersion` / `primary.serverVersion`, introduced semver-based MySQL/MariaDB versioned platform resolution (`MySQL80/84`, `MariaDB1052/1060/1010/110700`), and now throw `InvalidPlatformVersion` for malformed platform version strings.
- Added `pg` and `sqlite3` driver adapters (connections, exception converters, driver-manager registration, and driver barrel exports) with best-effort Doctrine-style PostgreSQL/SQLite platform classes and DSN scheme aliases (`postgres*` -> `pg`, `sqlite` -> `sqlite3`).
- Added package subpath namespace exports so consumers can import grouped APIs from:
  - `@devscast/datazen/driver`
  - `@devscast/datazen/exception`
  - `@devscast/datazen/logging`
  - `@devscast/datazen/platforms`
  - `@devscast/datazen/portability`
  - `@devscast/datazen/query`
  - `@devscast/datazen/schema`
  - `@devscast/datazen/sql`
  - `@devscast/datazen/tools`
  - `@devscast/datazen/types`
- Added namespace barrel entry points for `driver`, `query`, `sql`, and `tools`.
- Updated build configuration to emit multi-entry bundles/types for subpath exports.
- Added coverage test for namespace barrels and `package.json` subpath export declarations.
- Breaking: reduced root `@devscast/datazen` exports to modules backed by files directly under `src/`; grouped APIs now require subpath imports (for example `@devscast/datazen/query`, `@devscast/datazen/types`, `@devscast/datazen/platforms`).
- Documentation: corrected outdated schema/keyword-list status notes and added a living parity matrix guide (`docs/parity-matrix.md`).

# 1.0.2 - Schema Foundation Parity
- Ported a Doctrine-inspired schema foundation under `src/schema/*`:
  - schema assets: `AbstractAsset`, `Identifier`, `Column`, `Index`, `ForeignKeyConstraint`, `Table`, `Sequence`, `View`, `Schema`, `SchemaConfig`
  - schema management: `AbstractSchemaManager`, `MySQLSchemaManager`, `SQLServerSchemaManager`, `OracleSchemaManager`, `DB2SchemaManager`
  - schema-manager factories: `SchemaManagerFactory`, `DefaultSchemaManagerFactory`
- Added best-effort file-by-file Schema namespace parity with Doctrine reference layout:
  - created missing files/sub-namespaces under `src/schema/*` (`collections`, `default-expression`, `exception`, `foreign-key-constraint`, `index`, `introspection`, `metadata`, `name`)
  - added `src/schema/module.ts` as a stable schema-module export surface
  - exposed schema module namespace from top-level API as `SchemaModule`
- Added parity scaffolding and practical implementations for schema diffing/building APIs:
  - `Comparator`, `ComparatorConfig`, `ColumnDiff`, `TableDiff`, `SchemaDiff`
  - editor builders (`ColumnEditor`, `TableEditor`, `IndexEditor`, `ForeignKeyConstraintEditor`, `PrimaryKeyConstraintEditor`, `UniqueConstraintEditor`, `SequenceEditor`, `ViewEditor`)
  - constraint and table-configuration objects (`PrimaryKeyConstraint`, `UniqueConstraint`, `TableConfiguration`)
- Added `Connection.createSchemaManager()` and `Configuration` support for:
  - `schemaManagerFactory` override injection
  - `schemaAssetsFilter` hook (default pass-through)
- Ported Doctrine keyword-list support in `src/platforms/keywords/*`, including MySQL/MariaDB versioned lists and PostgreSQL/SQLite keyword classes.
- Extended platform integration to expose:
  - `getReservedKeywordsList()`
  - dialect-specific schema manager creation via `createSchemaManager(connection)`
- Added coverage tests:
  - `src/__tests__/platforms/keywords.test.ts`
  - `src/__tests__/schema/schema-assets.test.ts`
  - `src/__tests__/schema/schema-manager.test.ts`
  - `src/__tests__/schema/schema-comparator-editor.test.ts`
  - `src/__tests__/schema/schema-file-parity.test.ts`
- Expanded Doctrine parity coverage for schema exceptions in `src/__tests__/schema/schema-exception-parity.test.ts`:
  - added message assertions for previously untested schema exception factories (`IncomparableNames`, `IndexNameInvalid`, `InvalidIdentifier`, `InvalidName`, `InvalidTableName`, `NotImplemented`, `UniqueConstraintDoesNotExist`, `UnsupportedName`)
  - added full `InvalidState` factory message coverage and additional `InvalidTableModification` factory/cause assertions
- Ported additional Doctrine schema internals beyond scaffolding:
  - `src/schema/index/indexed-column.ts` now validates and exposes indexed-column metadata (name + optional positive length)
  - `src/schema/name/*` and `src/schema/name/parser/*` now implement Doctrine-style name value objects, identifier folding, and SQL-like parser behavior
  - `src/schema/metadata/*` row classes now carry Doctrine-style metadata DTO state/getters
  - `src/schema/introspection/metadata-processor/*` now combine metadata rows into schema editors/objects (indexes, PK/FK constraints, sequences, views)
  - added editor compatibility helpers used by metadata processors (`IndexEditor`, `ForeignKeyConstraintEditor`, `PrimaryKeyConstraintEditor`, `SequenceEditor`, `ViewEditor`)
- Added schema parity behavior tests in `src/__tests__/schema/schema-name-introspection-parity.test.ts` covering:
  - name objects/parsers (`GenericName`, `Identifier`, `UnqualifiedName`, `OptionallyQualifiedName`, parser registry)
  - `IndexedColumn`
  - metadata rows and metadata processors

# 1.0.1 - Convenience DML Parity
- Added phase 1 TypeScript-friendly typed row propagation:
  - `Result<TRow>` now carries a default row shape for associative fetch methods.
  - `Connection.executeQuery<T>()` and `Connection.executeQueryObject<T>()` now return `Result<T>`.
  - `Connection` fetch helpers now expose generic return types (`fetchAssociative<T>()`, `fetchAllAssociative<T>()`, etc.).
  - `Statement.executeQuery<T>()` and `QueryBuilder.executeQuery<T>()` now propagate typed row results.
- Added typed-row coverage tests:
  - `src/__tests__/connection/connection-typed-fetch.test.ts`
  - `src/__tests__/result/result.test.ts`
- Implemented Doctrine-style convenience data manipulation methods on `Connection`:
  - `insert(table, data, types?)`
  - `update(table, data, criteria, types?)`
  - `delete(table, criteria, types?)`
- Added Doctrine-parity-focused tests for the new convenience methods in `src/__tests__/connection/connection-data-manipulation.test.ts`, including keyed type maps, null criteria handling, and named-binding compilation paths.
- Aligned convenience DML tests with Doctrine `tests/ConnectionTest.php` parity patterns:
  - empty insert
  - update with different data/criteria columns
  - update with shared column in data and criteria
  - update/delete with `IS NULL` criteria
- Updated documentation to reflect implementation status in `docs/data-retrieval-and-manipulation.md` and `docs/security.md`.

# 1.0.0 - Initial Stable Release
- Added QueryBuilder documentation (`docs/query-builder.md`) aligned with the current ported API and feature set.
- Added portability documentation (`docs/portability.md`) describing middleware flags, configuration, and portability boundaries.
- Added types documentation (`docs/types.md`) covering the DataZen type registry, built-in types, platform type mapping hooks, custom type registration, and current Node-specific behavior.
- Added platform documentation (`docs/platforms.md`) covering platform resolution, implemented platform classes, customization patterns, and current parity limits versus Doctrine's version-specific platform matrix.
- Added security documentation (`docs/security.md`) covering SQL injection boundaries, safe/unsafe APIs, prepared statement usage, parameter typing guidance, and current Datazen-specific limitations.
- Added transaction documentation (`docs/transactions.md`) covering demarcation, transactional closures, nested savepoint behavior, rollback-only state, transaction-related exceptions, and current unimplemented parity points (connection isolation API, retryable markers, lock wait timeout-specific exception).
- Implemented Doctrine-style auto-commit mode controls with `Configuration#setAutoCommit()/getAutoCommit()` and `Connection#setAutoCommit()/isAutoCommit()`, including automatic transaction start on connect and outer transaction restart behavior when auto-commit is disabled.
- Added known vendor issues documentation (`docs/known-vendor-issues.md`) with current Datazen runtime caveats for MySQL and SQL Server plus platform-only notes for Oracle/Db2 and unsupported-vendor scope notes.
- Added database extension guide (`docs/supporting-other-databases.md`) documenting how to implement custom drivers/platforms in Datazen, including registration paths, test expectations, and current schema-module scope limits.
- Added introduction documentation (`docs/introduction.md`) describing Datazen's DBAL scope, runtime-supported vendors, platform coverage, and a quick start example.
- Rewrote `README.md` with current project scope, runtime/platform support matrix, installation and quick-start examples, architecture summary, and a complete documentation index linking all guides in `docs/`.

# 0.0.1 - Initital Beta Release
- Initial release of Datazen TypeScript, a lightweight database abstraction layer inspired by Doctrine DBAL original PHP implementation.
- Provides a unified API for building SQL queries, managing connections, and handling exceptions across multiple database drivers (MySQL, PostgreSQL, SQL Server).
- Added Doctrine-style logging middleware (`src/logging/*`) with connection parameter redaction, query/statement logging, and transaction lifecycle logging via pluggable logger implementations (console-compatible by default).
- Added Doctrine-style portability middleware (`src/portability/*`) with configurable empty-string/null conversion, right-trim normalization, and column-case normalization plus Oracle-specific flag optimization.
- Added Doctrine-inspired `DsnParser` (`src/tools/dsn-parser.ts`) for parsing DSN URLs into connection params with scheme mapping, sqlite path handling, and malformed DSN exceptions.
- Replaced `ParameterCompiler` with Doctrine-style `ExpandArrayParameters` (`src/expand-array-parameters.ts`) and moved query compilation flow into `Connection`, including SQL Server named-binding conversion.
- Added and updated docs for architecture, configuration, and data retrieval/manipulation to reflect current DataZen DBAL parity and current non-implemented scope.
