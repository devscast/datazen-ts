Configuration
=============

Getting a Connection
--------------------

Use `DriverManager` to create a `Connection`.

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

`DriverManager.getConnection()` returns a wrapper `Connection` instance.

Using a DSN
-----------------

You can parse a DSN first, then pass the result to `DriverManager`.

```ts
import mysql from "mysql2/promise";
import { DriverManager, DsnParser } from "@devscast/datazen";

const parser = new DsnParser();
const params = parser.parse("mysql2://user:secret@localhost/mydb?charset=utf8mb4");

const pool = mysql.createPool({
  database: String(params.dbname),
  host: String(params.host),
  password: String(params.password),
  port: Number(params.port ?? 3306),
  user: String(params.user),
});

const conn = DriverManager.getConnection({
  ...params,
  driver: "mysql2",
  pool,
});
```

Important: built-in drivers need an already-created low-level client (`pool`,
`connection`, or `client`). DSN parsing does not create a driver client.

Driver
------

You can configure the driver in one of three ways:

- `driver`: Built-in driver name.
- `driverClass`: Custom driver class constructor.
- `driverInstance`: Pre-instantiated custom driver object.

Built-in drivers currently available:

- `mysql2`
- `mssql`

There is no `wrapperClass` option in this port.

Connection Parameters
---------------------

Core manager-level params:

- `driver?: "mysql2" | "mssql"`
- `driverClass?: new () => Driver`
- `driverInstance?: Driver`
- `platform?: AbstractPlatform` (optional platform override)

MySQL2 Driver Params
--------------------

At least one is required:

- `pool`
- `connection`
- `client`

Optional ownership flags:

- `ownsPool?: boolean`
- `ownsClient?: boolean`

MSSQL Driver Params
-------------------

At least one is required:

- `pool`
- `connection`
- `client`

Optional ownership flags:

- `ownsPool?: boolean`
- `ownsClient?: boolean`

Notes:

- Keys like `host`, `port`, `user`, `password`, `dbname` can be present (for
  example from DSN parsing), but built-in drivers execute through the provided
  pool/client object.
- Query parameters parsed from DSN are merged into params as strings.

Connecting using a URL (DSN)
----------------------------

`DsnParser` supports:

- Standard URL decomposition into `driver`, `host`, `port`, `user`, `password`, `dbname`
- URL decoding of credentials/path/query
- Scheme normalization (`pdo-mysql` -> `pdo_mysql`)
- Scheme mapping to built-in driver names or custom `driverClass`
- SQLite path/memory parsing (`path` / `memory`)

Examples:

```ts
import { DsnParser } from "@devscast/datazen";

const parser = new DsnParser({
  custom: CustomDriver, // driverClass mapping
  pdo_mysql: "mysql2",  // alias mapping
});

parser.parse("pdo-mysql://user:secret@localhost/mydb");
parser.parse("custom://user:secret@localhost/mydb");
```

Malformed DSNs throw `MalformedDsnException`.

Middlewares
-----------

Use `Configuration` to attach middlewares before connection creation.

```ts
import {
  ColumnCase,
  Configuration,
  DriverManager,
  LoggingMiddleware,
  PortabilityConnection,
  PortabilityMiddleware,
} from "@devscast/datazen";

const configuration = new Configuration()
  .addMiddleware(new LoggingMiddleware())
  .addMiddleware(
    new PortabilityMiddleware(
      PortabilityConnection.PORTABILITY_RTRIM | PortabilityConnection.PORTABILITY_FIX_CASE,
      ColumnCase.LOWER,
    ),
  );

const conn = DriverManager.getConnection({ driver: "mssql", pool }, configuration);
```

Supported built-in middlewares:

- Logging (`src/logging/*`)
- Portability (`src/portability/*`)

Auto-commit Default
-------------------

`Configuration` can set the default connection auto-commit mode:

```ts
import { Configuration, DriverManager } from "@devscast/datazen";

const configuration = new Configuration({ autoCommit: false });
const conn = DriverManager.getConnection({ driver: "mysql2", pool }, configuration);
```

When `autoCommit` is `false`, connecting opens a transaction immediately, and
committing/rolling back the outermost transaction starts a new one.

Platform Selection
------------------

Platform resolution order:

1. `params.platform` when provided
2. Driver-provided platform (`mysql2` -> `MySQLPlatform`, `mssql` -> `SQLServerPlatform`)
3. Driver-name fallback in `Connection`

Unlike Doctrine, version-specific automatic platform detection is not implemented
in this port.

Not Implemented
---------------

- Schema module / schema manager configuration
- Doctrine-style wrapper class replacement (`wrapperClass`)
