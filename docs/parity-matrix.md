Doctrine/Datazen Parity Notes
=============================

This guide helps translate Datazen/Doctrine DBAL documentation and examples to
the Datazen TypeScript/Node port.

Core rule: async I/O boundary
-----------------------------

Doctrine (PHP) examples are typically synchronous at the call site. Datazen is
Node-first, so database I/O methods are `async` and must be awaited.

In general:

- `Connection`, `Statement`, and `QueryBuilder` execution APIs are async
- transaction lifecycle methods are async
- `Result` fetch/iterate APIs are sync after the `Result` is created

Common method mapping (Doctrine-style example -> Datazen port usage)
--------------------------------------------------------------------

- `Connection#prepare(...)` -> `const stmt = await conn.prepare(...)`
- `Connection#executeQuery(...)` -> `const result = await conn.executeQuery(...)`
- `Connection#executeStatement(...)` -> `const count = await conn.executeStatement(...)`
- `Connection#fetch*()` helpers -> `await conn.fetch*()`
- `Statement#executeQuery()` -> `const result = await stmt.executeQuery()`
- `Statement#executeStatement()` -> `await stmt.executeStatement()`
- `QueryBuilder#executeQuery()` / `#executeStatement()` -> `await ...`
- `QueryBuilder#fetch*()` helpers -> `await qb.fetch*()`
- `Connection#beginTransaction()` / `commit()` / `rollBack()` -> `await ...`
- `Connection#transactional(fn)` -> `await conn.transactional(async (tx) => { ... })`
- `Connection#connect()` / `close()` / `lastInsertId()` / `quote()` -> `await ...`

Result consumption (sync after execute)
---------------------------------------

Once you have a `Result`, fetch and iterator methods are synchronous in Datazen:

- `result.fetchAssociative()`
- `result.fetchAllAssociative()`
- `result.iterateAssociative()`
- `result.rowCount()`
- `result.free()`

Example:

```ts
const result = await conn.executeQuery("SELECT * FROM users");

let row = result.fetchAssociative();
while (row !== false) {
  console.log(row);
  row = result.fetchAssociative();
}
```

Iterator parity notes
---------------------

- `Connection#iterate*()` methods are async generators (`for await ... of`)
- `Result#iterate*()` methods are sync generators (`for ... of`)

Example:

```ts
for await (const row of conn.iterateAssociative("SELECT * FROM users")) {
  console.log(row);
}
```

Other common port differences
-----------------------------

- No PHP by-reference `bindParam()` equivalent; use `bindValue()`
- Built-in runtime adapters are Node drivers (`mysql2`, `mssql`, `pg`, `sqlite3`)
- Some Datazen/Doctrine APIs are best-effort aliases/shims for parity; behavior may
  remain Node-oriented where driver/runtime constraints differ
