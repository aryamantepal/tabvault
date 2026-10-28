import * as fs from "node:fs";
import * as path from "node:path";
import archiver from "archiver";

const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
const zipName = `tabvault-v${pkg.version}.zip`;
const outputPath = path.resolve(zipName);
const distDir = path.resolve("dist");

if (!fs.existsSync(distDir)) {
  console.error("dist/ directory does not exist. Run 'npm run build' first.");
  process.exit(1);
}

const output = fs.createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`Packaged ${archive.pointer()} total bytes to ${zipName}`);
});

archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
await archive.finalize();

