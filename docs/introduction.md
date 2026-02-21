Introduction
============

Datazen is a TypeScript database abstraction layer inspired by Doctrine DBAL.
It provides a portable, object-oriented API for query execution, parameter
binding, transactions, type conversion, and SQL dialect abstraction.

Like Doctrine DBAL, Datazen separates wrapper APIs from concrete drivers through
interfaces, so you can use built-in adapters or implement custom drivers.

Supported Vendors
-----------------

Runtime drivers currently shipped:

- MySQL (via `mysql2`)
- Microsoft SQL Server (via `mssql`)

Platform abstractions currently shipped:

- MySQL
- SQL Server
- Oracle (platform-only)
- Db2 (platform-only)

For runtime caveats and scope notes, see `docs/known-vendor-issues.md`.

DBAL-first, ORM-independent
---------------------------

Datazen is a DBAL library and can be used independently from any ORM. It is
built for SQL-first usage and integrates with low-level Node drivers.

Current scope includes:

- `Connection`, `Statement`, `Result` abstractions
- QueryBuilder and SQL parser support
- Type conversion subsystem
- Driver middleware (logging, portability)
- DSN parsing

Current non-goal:

- Doctrine-style Schema module (schema manager/tooling) is not implemented yet.

Getting Started
---------------

Install package and runtime driver dependency:

```bash
bun add @devscast/datazen mysql2
```

Example connection:

```ts
import mysql from "mysql2/promise";
import { DriverManager } from "@devscast/datazen";

const pool = mysql.createPool({
  database: "mydb",
  host: "localhost",
  password: "secret",
  user: "user",
});

const conn = DriverManager.getConnection({
  driver: "mysql2",
  pool,
});
```

From there, use `executeQuery()`, `executeStatement()`, and `createQueryBuilder()`
to build and run SQL through a portable DBAL API.
