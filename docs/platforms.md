Platforms
=========

Platforms abstract SQL dialect differences and database behavior differences
between vendors.

In most code, you use `Connection` and `QueryBuilder` directly. When you need
vendor-aware SQL generation, quoting, or type mapping logic, access the
platform from the connection.

Getting the Platform
--------------------

```ts
const platform = conn.getDatabasePlatform();
```

`Connection` resolves the platform in this order:

1. `params.platform` when it is an `AbstractPlatform` instance
2. `driver.getDatabasePlatform()` when provided by the active driver
3. Driver-name fallback (`mysql2` -> `MySQLPlatform`, `mssql` -> `SQLServerPlatform`)

If none of these applies, Datazen throws a DBAL exception.

Available Platform Classes
--------------------------

Currently implemented in this port:

- `MySQLPlatform`
- `SQLServerPlatform`
- `OraclePlatform`
- `DB2Platform`
- `AbstractMySQLPlatform` (base class)
- `AbstractPlatform` (base class)

Driver defaults:

- `mysql2` driver uses `MySQLPlatform`
- `mssql` driver uses `SQLServerPlatform`

Unlike Doctrine DBAL, version-specific platform subclasses and automatic server
version-based platform switching are not implemented yet.

What Platforms Are Responsible For
----------------------------------

Platforms encapsulate vendor behavior such as:

- SQL declaration strings for data types
- limit/offset SQL rewriting (`modifyLimitQuery()`)
- identifier and literal quoting helpers
- SQL expression helpers (string, date, math, trim, etc.)
- boolean conversion semantics (`convertBooleansToDatabaseValue()`, `convertFromBoolean()`)
- database type to Datazen type mapping

This keeps SQL generation and type translation portable across drivers.

Type Mapping Hooks
------------------

Platforms expose mapping hooks used by the types subsystem:

- `registerDatazenTypeMapping(dbType, datazenType)`
- `hasDatazenTypeMappingFor(dbType)`
- `getDatazenTypeMapping(dbType)`

These are the Datazen equivalent of Doctrine's DB-type mapping extension points.

Customizing the Platform
------------------------

Option 1: pass a custom platform directly in connection params.

```ts
import { DriverManager, MySQLPlatform } from "@devscast/datazen";

class CustomMySQLPlatform extends MySQLPlatform {
  // override methods as needed
}

const conn = DriverManager.getConnection({
  driver: "mysql2",
  pool,
  platform: new CustomMySQLPlatform(),
});
```

Option 2: override platform through driver middleware.

```ts
import {
  type Driver,
  type DriverConnection,
  type DriverMiddleware,
  ParameterBindingStyle,
  DriverManager,
  Configuration,
  SQLServerPlatform,
} from "@devscast/datazen";

class CustomSQLServerPlatform extends SQLServerPlatform {}

class PlatformOverridingDriver implements Driver {
  constructor(private readonly inner: Driver) {}

  public get name(): string {
    return this.inner.name;
  }

  public get bindingStyle(): ParameterBindingStyle {
    return this.inner.bindingStyle;
  }

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    return this.inner.connect(params);
  }

  public getExceptionConverter() {
    return this.inner.getExceptionConverter();
  }

  public getDatabasePlatform(): CustomSQLServerPlatform {
    return new CustomSQLServerPlatform();
  }
}

class PlatformMiddleware implements DriverMiddleware {
  public wrap(driver: Driver): Driver {
    return new PlatformOverridingDriver(driver);
  }
}

const configuration = new Configuration().addMiddleware(new PlatformMiddleware());
const conn = DriverManager.getConnection({ driver: "mssql", pool }, configuration);
```

Practical Note
--------------

A custom platform is useful when you need vendor-specific SQL optimizations,
custom function expressions, or adjusted type mapping behavior while keeping the
same public DBAL API.

Not Implemented
---------------

The schema module is out of scope currently, so schema-manager-driven platform
features from Doctrine docs are not part of this port yet.
