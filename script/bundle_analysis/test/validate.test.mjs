import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../lib/analyze.mjs";
import { validateReport } from "../lib/validate.mjs";
import { baseApp, makeDist } from "./helpers.mjs";

test("accepts what the analyzer writes", async () => {
  const report = await analyze({
    baseDir: makeDist(baseApp()),
    headDir: makeDist(baseApp()),
  });
  const roundTripped = JSON.parse(JSON.stringify(report));

  assert.deepEqual(
    JSON.parse(JSON.stringify(validateReport(roundTripped))),
    roundTripped
  );
});

test("rejects wrong types and unknown schemas", async () => {
  const report = JSON.parse(
    JSON.stringify(
      await analyze({
        baseDir: makeDist(baseApp()),
        headDir: makeDist(baseApp()),
      })
    )
  );

  assert.throws(() => validateReport({ ...report, schema: 2 }), /schema/);
  assert.throws(
    () =>
      validateReport({
        ...report,
        initialLoad: { ...report.initialLoad, head: "1" },
      }),
    /initialLoad.head must be a number/
  );
  report.bundles[0].kind = "<script>";
  assert.throws(() => validateReport(report), /kind must be one of/);
});

test("drops unknown fields", async () => {
  const report = JSON.parse(
    JSON.stringify(
      await analyze({
        baseDir: makeDist(baseApp()),
        headDir: makeDist(baseApp()),
      })
    )
  );
  report.extra = "x";
  report.bundles[0] = {
    ...report.bundles[0],
    ...JSON.parse('{"__proto__": {"polluted": true}}'),
  };

  const result = validateReport(report);

  assert.equal(result.extra, undefined);
  assert.equal(Object.getPrototypeOf(result.bundles[0]), null);
  assert.equal({}.polluted, undefined);
});

test("a no-JS-changes report needs nothing else", () => {
  assert.deepEqual(
    { ...validateReport({ schema: 1, noJsChanges: true }) },
    { schema: 1, noJsChanges: true }
  );
});
