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
const suspiciousFiles = new Set();
const legacyModelFiles = new Set();
const scanRoots = [
  path.join(root, "src"),
  path.join(root, "src-tauri", "src"),
  path.join(root, "dist"),
  path.join(root, "src-tauri", "target"),
];
const secretPatterns = [
  /(?:^|[^A-Z0-9_])DEEPSEEK_API_KEY(?:[^A-Z0-9_]|$)/i,
  /Authorization\s*[:=]\s*["'`]?\s*Bearer\b/i,
  /\bsk-[A-Za-z0-9]{16,}\b/,
];
const legacyModelPattern = /\bdeepseek-(?:chat|reasoner)\b/i;

function scanDirectory(scanRoot) {
  if (!fs.existsSync(scanRoot)) {
    return;
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
    const relative = path.relative(root, current);
    if (
      privateKeyMarkers.some((marker) => content.includes(marker)) ||
      secretPatterns.some((pattern) => pattern.test(content))
    ) {
      suspiciousFiles.add(relative);
    }
    if (legacyModelPattern.test(content)) {
      legacyModelFiles.add(relative);
    }
  }
}

for (const scanRoot of scanRoots) {
  scanDirectory(scanRoot);
}

if (suspiciousFiles.size > 0) {
  throw new Error(
    "Secret-like material was found in source or release artifacts:\n" +
      [...suspiciousFiles].map((file) => `- ${file}`).join("\n"),
  );
}

if (legacyModelFiles.size > 0) {
  throw new Error(
    "Retired DeepSeek model identifiers were found in runtime or release files:\n" +
      [...legacyModelFiles].map((file) => `- ${file}`).join("\n"),
  );
}

console.log(
  "Release safety checks OK: no tracked or bundled secret material, auth header, or retired model identifier.",
);
