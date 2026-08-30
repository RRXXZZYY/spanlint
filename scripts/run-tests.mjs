import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const testDirectory = resolve("dist/test");
const testFiles = readdirSync(testDirectory)
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => resolve(testDirectory, name));

if (testFiles.length === 0) {
  process.stderr.write("No compiled test files found in dist/test.\n");
  process.exitCode = 2;
} else {
  const nodeArguments = ["--test"];
  if (process.argv.includes("--coverage")) {
    nodeArguments.push("--experimental-test-coverage");
  }
  nodeArguments.push(...testFiles);

  const result = spawnSync(process.execPath, nodeArguments, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
