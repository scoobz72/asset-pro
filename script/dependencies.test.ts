import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { zodResolver } from "@hookform/resolvers/zod";
import { fromZodError } from "zod-validation-error";
import {
  insertUserSchema,
  insertAssetSchema,
  insertJobSchema,
  insertSupplierSchema,
} from "../shared/schema";

test("insert validation excludes generated IDs and preserves defaults", () => {
  assert.deepEqual(insertUserSchema.parse({ name: "Test", id: 99 }), { name: "Test" });
  assert.equal(insertUserSchema.safeParse({}).success, false);
  assert.equal(insertUserSchema.safeParse({ name: 123 }).success, false);
  assert.deepEqual(insertAssetSchema.parse({ id: "test", name: "Test" }), {
    id: "test", name: "Test",
  });
  assert.equal(insertJobSchema.safeParse({ id: "test", title: "Test" }).success, true);
  assert.equal(insertSupplierSchema.safeParse({
    id: "test", name: "Test", categories: ["parts"],
  }).success, true);
  assert.equal(insertSupplierSchema.safeParse({
    id: "test", name: "Test", categories: [42],
  }).success, false);
});

test("Drizzle escapes embedded identifier delimiters", () => {
  const query = new PgDialect().sqlToQuery(sql`select ${sql.identifier('name"; DROP TABLE users;--')}`);
  assert.equal(query.sql, 'select "name""; DROP TABLE users;--"');
  assert.deepEqual(query.params, []);
});

test("validation adapters support the upgraded Zod schemas", async () => {
  const resolver = zodResolver(insertUserSchema);
  const options = { fields: {}, shouldUseNativeValidation: false };
  const valid = await resolver({ name: "Test" }, undefined, options);
  assert.deepEqual(valid.errors, {});
  assert.deepEqual(valid.values, { name: "Test" });
  const invalid = await resolver({ name: 42 } as never, undefined, options);
  assert.ok(invalid.errors.name);
  const result = insertUserSchema.safeParse({});
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(fromZodError(result.error).message, /name/);
  }
});
