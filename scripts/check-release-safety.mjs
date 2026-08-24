import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const versionCheck = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "check-version.mjs")],
  { cwd: root, encoding: "utf8" },
);
if (versionCheck.status !== 0) {
  process.stdout.write(versionCheck.stdout ?? "");
  process.stderr.write(versionCheck.stderr ?? "");
  process.exit(versionCheck.status ?? 1);
}
process.stdout.write(versionCheck.stdout ?? "");

const trackedFiles = execFileSync("git", ["ls-files"], {
  cwd: root,
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);
const privateFilenamePattern =
  /(^|\/)([^/]*(?:private|secret|signing)[^/]*\.(?:key|pem)|[^/]+\.key)$/i;
const trackedPrivateFiles = trackedFiles.filter((file) =>
  privateFilenamePattern.test(file),
);

if (trackedPrivateFiles.length > 0) {
  throw new Error(
    "Private signing material is tracked by Git:\n" +
      trackedPrivateFiles.map((file) => `- ${file}`).join("\n"),
  );
}

const privateKeyMarkers = [
  "BEGIN PRIVATE KEY",
  "BEGIN RSA PRIVATE KEY",
  "BEGIN OPENSSH PRIVATE KEY",
  "BEGIN EC PRIVATE KEY",
];
const suspiciousFiles = [];
const scanRoots = [path.join(root, "dist")];
for (const scanRoot of scanRoots) {
  if (!fs.existsSync(scanRoot)) {
    continue;
  }
  const stack = [scanRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      stack.push(
        ...fs.readdirSync(current).map((entry) => path.join(current, entry)),
      );
      continue;
    }
    if (stat.size > 2_000_000) {
      continue;
    }
    const content = fs.readFileSync(current, "utf8");
    if (privateKeyMarkers.some((marker) => content.includes(marker))) {
      suspiciousFiles.push(path.relative(root, current));
    }
  }
}

if (suspiciousFiles.length > 0) {
  throw new Error(
    "Private key material was found in the frontend bundle:\n" +
      suspiciousFiles.map((file) => `- ${file}`).join("\n"),
  );
}

console.log("Release safety checks OK: no tracked or bundled private key material.");
