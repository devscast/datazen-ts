import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { CommitFailedRollbackOnly } from "../../exception/commit-failed-rollback-only";
import { DriverException } from "../../exception/driver-exception";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/ConnectionTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;

  beforeEach(async () => {
    connection = functional.connection();
  });

  it("throws when committing a rollback-only transaction", async () => {
    await connection.beginTransaction();
    connection.setRollbackOnly();

    await expect(connection.commit()).rejects.toThrow(CommitFailedRollbackOnly);
  });

  it("supports nested transaction behavior with savepoints (adapted subset)", async ({ skip }) => {
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }
    await createConnectionTestTable(functional, connection);

    await connection.beginTransaction();
    expect(connection.getTransactionNestingLevel()).toBe(1);

    try {
      await connection.beginTransaction();
      expect(connection.getTransactionNestingLevel()).toBe(2);

      await connection.insert("connection_test", { id: 1 });
      throw new Error("expected unique constraint violation");
    } catch (error) {
      expect(error).toBeInstanceOf(UniqueConstraintViolationException);
      await connection.rollBack();
      expect(connection.getTransactionNestingLevel()).toBe(1);
    }

    await connection.commit();
    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("supports nested transaction behavior with savepoints after deeper nesting", async ({
    skip,
  }) => {
    if (!connection.getDatabasePlatform().supportsSavepoints()) {
      skip();
    }
    await createConnectionTestTable(functional, connection);

    await connection.beginTransaction();
    expect(connection.getTransactionNestingLevel()).toBe(1);

    try {
      await connection.beginTransaction();
      expect(connection.getTransactionNestingLevel()).toBe(2);
      await connection.beginTransaction();
      expect(connection.getTransactionNestingLevel()).toBe(3);

      await connection.commit();
      expect(connection.getTransactionNestingLevel()).toBe(2);

      await connection.insert("connection_test", { id: 1 });
      throw new Error("expected unique constraint violation");
    } catch (error) {
      expect(error).toBeInstanceOf(UniqueConstraintViolationException);
      await connection.rollBack();
      expect(connection.getTransactionNestingLevel()).toBe(1);
    }

    expect(connection.isRollbackOnly()).toBe(false);
    await connection.commit();
    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("marks transactions inactive after connection.close()", async () => {
    await connection.beginTransaction();
    await connection.close();

    expect(connection.isTransactionActive()).toBe(false);
  });

  it("rolls back and resets nesting level after a failed transactional insert", async () => {
    await createConnectionTestTable(functional, connection);

    try {
      await connection.beginTransaction();
      expect(connection.getTransactionNestingLevel()).toBe(1);

      await connection.insert("connection_test", { id: 1 });
      throw new Error("expected unique constraint violation");
    } catch (error) {
      expect(error).toBeInstanceOf(UniqueConstraintViolationException);
      expect(connection.getTransactionNestingLevel()).toBe(1);
      await connection.rollBack();
      expect(connection.getTransactionNestingLevel()).toBe(0);
    }
  });

  it("commits a simple transaction and resets nesting level", async () => {
    await createConnectionTestTable(functional, connection);

    await connection.beginTransaction();
    expect(connection.getTransactionNestingLevel()).toBe(1);
    await connection.insert("connection_test", { id: 2 });
    await connection.commit();

    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("transactional() rolls back on unique constraint violations", async () => {
    await createConnectionTestTable(functional, connection);

    await expect(
      connection.transactional(async (tx) => {
        await tx.insert("connection_test", { id: 1 });
      }),
    ).rejects.toThrow(UniqueConstraintViolationException);

    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("transactional() rolls back on thrown errors", async () => {
    await expect(
      connection.transactional(async (tx) => {
        await tx.executeQuery(tx.getDatabasePlatform().getDummySelectSQL());
        throw new Error("Ooops!");
      }),
    ).rejects.toThrow("Ooops!");

    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("transactional() returns callback values", async () => {
    await createConnectionTestTable(functional, connection);

    const result = await connection.transactional(async (tx) =>
      tx.insert("connection_test", { id: 2 }),
    );

    expect(result).toBe(1);
    expect(connection.getTransactionNestingLevel()).toBe(0);
  });

  it("transactional() returns scalar values", async () => {
    const result = await connection.transactional(async () => 42);

    expect(result).toBe(42);
  });

  it("throws on invalid SQL in executeStatement()", async () => {
    await expect(connection.executeStatement("foo")).rejects.toThrow(DriverException);
  });

  it("throws on invalid SQL in executeQuery()", async () => {
    await expect(connection.executeQuery("foo")).rejects.toThrow(DriverException);
  });

  it("throws on invalid SQL in prepare().executeStatement()", async () => {
    const statement = await connection.prepare("foo");

    await expect(statement.executeStatement()).rejects.toThrow(DriverException);
  });

  it.skip("resets transaction nesting level after reconnecting a file-backed SQLite connection", async () => {
    // Doctrine creates a fresh params-based file-backed SQLite connection.
    // The current functional harness uses a generic env-selected native client factory.
  });

  it.skip("connects without an explicit database name", async () => {
    // Doctrine exercises params-based DriverManager bootstrapping. This harness injects native clients/pools.
  });

  it.skip("determines platform when connecting to a non-existent database", async () => {
    // Doctrine params-based platform bootstrapping scenario is not exercised by the injected client/pool harness.
  });

  it.skip("persistent connection semantics", async () => {
    // PDO/native persistent connection attributes are PHP-native and out of scope for the Node sqlite3 adapter.
  });

  it.skip("savepoint methods throw when platform does not support savepoints", async () => {
    // SQLite supports savepoints in this harness; Doctrine covers this on non-savepoint platforms.
  });
});

async function createConnectionTestTable(
  functional: ReturnType<typeof useFunctionalTestCase>,
  connection: Connection,
): Promise<void> {
  await functional.dropAndCreateTable(
    Table.editor()
      .setUnquotedName("connection_test")
      .setColumns(Column.editor().setUnquotedName("id").setTypeName("integer").create())
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create(),
  );
  await connection.insert("connection_test", { id: 1 });
}
