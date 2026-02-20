Architecture
============

DataZen keeps the same global architecture idea as Doctrine DBAL: a driver layer
at the bottom and a stable wrapper layer at the top.

This port is TypeScript/Node-first, async, and intentionally excludes the
Schema module for now.

Layers
------

The runtime is organized into two layers:

- Driver layer (vendor-specific adapters)
- Wrapper layer (portable API used by applications)

Wrapper layer
-------------

The main application-facing components are:

- `Connection` (`src/connection.ts`)
- `Statement` (`src/statement.ts`)
- `Result` (`src/result.ts`)

`Connection` orchestrates parameter expansion/compilation, transaction control,
type conversion, exception conversion, and delegates execution to the active
driver connection.

Driver layer
------------

The driver abstraction is centered around:

- `Driver` (`src/driver.ts`)
- `DriverConnection` (`src/driver.ts`)

Concrete adapters:

- MySQL2: `src/driver/mysql2/*`
- MSSQL: `src/driver/mssql/*`

Doctrine has separate low-level `Driver\Statement` and `Driver\Result`
interfaces. In this Node port, the low-level contract is simplified to
`executeQuery()` / `executeStatement()` on `DriverConnection` and normalized
result payloads (`DriverQueryResult`, `DriverExecutionResult`), because this
maps better to Node driver APIs.

Driver Manager
--------------

`DriverManager` (`src/driver-manager.ts`) is responsible for:

1. Resolving a driver from params (`driver`, `driverClass`, `driverInstance`)
2. Applying configured middleware in order
3. Returning a wrapper `Connection`

Middlewares
-----------

Middleware decorates the driver stack through `DriverMiddleware`:

- Logging middleware: `src/logging/*`
- Portability middleware: `src/portability/*`

The middleware pipeline is configured via `Configuration` (`src/configuration.ts`).

Parameter Expansion and SQL Parsing
-----------------------------------

Array/list parameter expansion follows Doctrine’s model:

- `ExpandArrayParameters` (`src/expand-array-parameters.ts`)
- SQL parser + visitor (`src/sql/parser.ts`, `src/sql/parser/visitor.ts`)

`Connection` uses this flow to transform SQL and parameters before execution.
For named-binding drivers (MSSQL), positional placeholders are rewritten into
driver-appropriate named placeholders.

Platforms
---------

Platforms provide dialect capabilities and feature flags through
`AbstractPlatform` (`src/platforms/abstract-platform.ts`) and concrete
implementations (`mysql`, `sql-server`, `oracle`, `db2`).

They are used for SQL dialect behaviors, quoting, date/time and expression
helpers, and type mapping metadata.

Types
-----

The types subsystem (`src/types/*`) provides runtime conversion between Node
values and database representations, inspired by Doctrine DBAL Types.

`Connection` integrates this layer when binding and reading typed values.

Query Layer
-----------

The query API (`src/query/*`) includes a Doctrine-inspired QueryBuilder and
related expression/query objects. Query generation and execution remain
separated: generated SQL is executed through `Connection`.

Exceptions
----------

Exceptions are normalized in `src/exception/*`. Driver-specific errors are
translated through per-driver exception converters:

- `src/driver/api/mysql/exception-converter.ts`
- `src/driver/api/sqlsrv/exception-converter.ts`

Tools
-----

Implemented tooling currently includes:

- `DsnParser` (`src/tools/dsn-parser.ts`)

Not Implemented
---------------

The Doctrine DBAL Schema subsystem is not ported in this project yet.
That includes schema introspection, schema manager operations, and schema
tooling/migrations-related APIs.
