import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.JOBBER_OPERATION_SOURCE || "/tmp/jobber_bundle_mining/operation-names.json";
const outDir = path.resolve(process.cwd(), "src/generated");
const docsDir = path.resolve(process.cwd(), "docs");

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const normalized = source
  .map((item) => ({
    name: item.name,
    files: item.files.map((file) => ({
      url: file.url,
      filename: file.filename,
    })),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

const tsBody = `export type OperationInventoryItem = {
  name: string;
  files: Array<{ url: string; filename: string }>;
};

export const OPERATION_INDEX: OperationInventoryItem[] = ${JSON.stringify(normalized, null, 2)};\n`;

fs.writeFileSync(path.join(outDir, "operation-index.ts"), tsBody);

const lines = [
  "# Operation Inventory",
  "",
  `Generated from sanitized Jobber bundle mining.`,
  "",
  `Count: ${normalized.length}`,
  "",
  "| Operation | Sources |",
  "| --- | --- |",
  ...normalized.map((item) => `| \`${item.name}\` | ${item.files.map((file) => `\`${file.filename}\``).join(", ")} |`),
  "",
];

fs.writeFileSync(path.join(docsDir, "OPERATION_INDEX.md"), `${lines.join("\n")}\n`);
