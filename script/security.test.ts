import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { errorHandler } from "../server/errors";
import { hashPassword, verifyPassword, isPasswordHash } from "../server/password";
import { insertUserSchema, updatePurchaseOrderSchema } from "../shared/schema";

const SECRET = "Sup3r-Secret-Passw0rd";

async function withServer(app: express.Express, fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function captureConsole() {
  const lines: string[] = [];
  const originals = { log: console.log, error: console.error, warn: console.warn };
  for (const key of ["log", "error", "warn"] as const) {
    console[key] = (...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a, Object.getOwnPropertyNames(a ?? {})))).join(" "));
    };
  }
  return {
    lines,
    restore: () => Object.assign(console, originals),
  };
}

test("malformed credential bodies are neither logged nor echoed", async () => {
  const app = express();
  app.use(express.json());
  app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  const captured = captureConsole();
  try {
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: `{"email":"a@b.c","password":"${SECRET}"`, // truncated JSON
      });
      const text = await res.text();
      assert.equal(res.status, 400);
      assert.ok(!text.includes(SECRET), "response must not echo the password");
    });
  } finally {
    captured.restore();
  }
  assert.ok(!captured.lines.join("\n").includes(SECRET), "logs must not contain the password");
});

test("server errors carrying request data are logged without their message", async () => {
  const app = express();
  app.get("/boom", () => {
    throw new Error(`Failed query: insert into users params: ${SECRET}`);
  });
  app.use(errorHandler);

  const captured = captureConsole();
  try {
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/boom`);
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { message: "Internal Server Error" });
    });
  } finally {
    captured.restore();
  }
  const output = captured.lines.join("\n");
  assert.ok(output.includes("Internal Server Error"));
  assert.ok(!output.includes(SECRET));
});

test("passwords are hashed and verified in constant form", async () => {
  const hash = await hashPassword(SECRET);
  assert.ok(isPasswordHash(hash));
  assert.ok(!hash.includes(SECRET));
  assert.equal(await verifyPassword(SECRET, hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  // Legacy plaintext values never authenticate.
  assert.equal(await verifyPassword(SECRET, SECRET), false);
  assert.equal(await verifyPassword(SECRET, null), false);
});

test("input schemas allow-list fields and reject unknown roles", () => {
  assert.deepEqual(insertUserSchema.parse({ name: "X", id: 7, isAdmin: true }), { name: "X" });
  assert.equal(insertUserSchema.safeParse({ name: "X", role: "Superuser" }).success, false);
  assert.equal(insertUserSchema.safeParse({ name: "X", password: "short" }).success, false);
  assert.deepEqual(updatePurchaseOrderSchema.parse({ id: "PO-X", status: "Draft" }), { status: "Draft" });
});
