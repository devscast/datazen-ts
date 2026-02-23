Parity Matrix (Best Effort)
===========================

This document tracks high-level parity between DataZen and Doctrine DBAL.
It is intentionally pragmatic: it highlights what is implemented, partially
ported, or still missing in this TypeScript/Node port.

Legend
------

- Implemented: usable and covered in the port (may still differ in API shape for TS/Node)
- Partial: core support exists, but Doctrine breadth/behavior parity is incomplete
- Missing: not implemented in the port yet

Top-Level Parity
----------------

| Area | Status | Notes |
| --- | --- | --- |
| Connection / Statement / Result | Partial | Core runtime APIs are implemented; some Doctrine transaction APIs and behaviors remain missing. |
| DriverManager | Partial | Built-in resolution exists, but driver matrix is much smaller than Doctrine. |
| Driver abstraction | Partial | TS/Node async contract differs intentionally from Doctrine's low-level driver interfaces. |
| Query Builder | Partial | Core builder and execution APIs implemented; Doctrine result cache integration is missing. |
| SQL Parser / SQL Builders | Partial | Parameter parser and SQL builder support exist; parity breadth is still evolving. |
| Platforms | Partial | MySQL, SQL Server, Oracle, Db2 platforms exist; version-specific platform variants/detection are incomplete. |
| Types | Partial | Strong runtime type system and registry support; parity breadth and schema-driven flows continue to evolve. |
| Schema | Partial | Significant schema module support exists (assets, managers, comparator/editors, metadata/introspection scaffolding), but full Doctrine parity is still in progress. |
| Logging middleware | Implemented | Doctrine-inspired middleware pattern ported for Node driver wrapping. |
| Portability middleware | Implemented | Result portability normalization and optimization flags are available. |
| Tools (DSN parser) | Implemented | `DsnParser` exists and is documented/test-covered. |
| Cache subsystem | Missing | Doctrine cache/result-cache integration surfaces are not ported yet. |

Doctrine Areas With Strong Coverage (Current)
---------------------------------------------

- Driver middleware (`logging`, `portability`)
- SQL parameter parsing and array/list expansion flow
- QueryBuilder core operations and execution helpers
- Platform SQL helpers and vendor keyword list access
- Types registry and built-in type conversions
- Schema foundations (assets, diffs, editors, schema managers, metadata/introspection helpers)

Known Major Gaps vs Doctrine DBAL
---------------------------------

- Wider driver support (Doctrine supports many more drivers/vendors than the current `mysql2` + `mssql` runtime adapters)
- Version-specific platform subclass selection and automatic server-version detection
- QueryBuilder result cache integration (`enableResultCache()`-style API)
- Connection transaction isolation getter/setter parity
- Retryable exception marker semantics / lock-wait-timeout-specific exception parity
- Doctrine cache namespace/subsystem parity

Intentional TS/Node Deviations
------------------------------

- Async driver contracts returning `Promise` values
- Node-driver adapters (`mysql2`, `mssql`) instead of PDO-style drivers
- Package subpath exports for grouped APIs:
  - `@devscast/datazen/driver`
  - `@devscast/datazen/platforms`
  - `@devscast/datazen/query`
  - `@devscast/datazen/schema`
  - `@devscast/datazen/sql`
  - `@devscast/datazen/tools`
  - `@devscast/datazen/types`
- Root package exports intentionally limited to top-level `src/*.ts` modules

Notes
-----

- This is a living document and should be updated when new parity features land.
- For contributor-oriented implementation details and source paths, see `docs/supporting-other-databases.md`.
