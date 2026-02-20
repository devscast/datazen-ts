# @devscast/datazen

# 0.0.1 - Initital Beta Release
- Initial release of Datazen TypeScript, a lightweight database abstraction layer inspired by Doctrine DBAL original PHP implementation.
- Provides a unified API for building SQL queries, managing connections, and handling exceptions across multiple database drivers (MySQL, PostgreSQL, SQL Server).
- Added Doctrine-style logging middleware (`src/logging/*`) with connection parameter redaction, query/statement logging, and transaction lifecycle logging via pluggable logger implementations (console-compatible by default).
- Added Doctrine-style portability middleware (`src/portability/*`) with configurable empty-string/null conversion, right-trim normalization, and column-case normalization plus Oracle-specific flag optimization.
- Added Doctrine-inspired `DsnParser` (`src/tools/dsn-parser.ts`) for parsing DSN URLs into connection params with scheme mapping, sqlite path handling, and malformed DSN exceptions.
- Replaced `ParameterCompiler` with Doctrine-style `ExpandArrayParameters` (`src/expand-array-parameters.ts`) and moved query compilation flow into `Connection`, including SQL Server named-binding conversion.
- Added and updated docs for architecture, configuration, and data retrieval/manipulation to reflect current DataZen DBAL parity and current non-implemented scope.
- Added QueryBuilder documentation (`docs/query-builder.md`) aligned with the current ported API and feature set.
- Added portability documentation (`docs/portability.md`) describing middleware flags, configuration, and portability boundaries.
- Added types documentation (`docs/types.md`) covering the DataZen type registry, built-in types, platform type mapping hooks, custom type registration, and current Node-specific behavior.
- Added platform documentation (`docs/platforms.md`) covering platform resolution, implemented platform classes, customization patterns, and current parity limits versus Doctrine's version-specific platform matrix.
