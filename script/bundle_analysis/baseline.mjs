#!/usr/bin/env node
/* eslint-disable no-console */
import { execFileSync } from "child_process";
import { resolve } from "path";
import { parseArgs } from "util";
import { findBaseline } from "./lib/baseline.mjs";

const { values: args } = parseArgs({
  options: { commit: { type: "string" }, out: { type: "string" } },
});
if (!args.commit || !args.out) {
  console.error(
    "Usage: node script/bundle_analysis/baseline.mjs --commit <sha> --out <dir>"
  );
  process.exit(1);
}

const commit = execFileSync("git", ["rev-parse", args.commit], {
  encoding: "utf8",
}).trim();
const result = findBaseline(commit, resolve(args.out), {
  log: (message) => console.error(message),
});
console.log(JSON.stringify(result));
