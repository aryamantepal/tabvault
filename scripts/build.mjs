import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const isWatch = process.argv.includes("--watch");
const distDir = path.resolve("dist");

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyStaticAssets() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy public/ contents to dist/
  const publicDir = path.resolve("public");
  if (fs.existsSync(publicDir)) {
    copyDirRecursive(publicDir, distDir);
  }

  // Copy src HTML files to dist/
  for (const file of ["popup.html", "options.html"]) {
    const srcPath = path.resolve("src", file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(distDir, file));
    }
  }
}

const buildOptions = {
  entryPoints: [
    { in: "src/background.ts", out: "background" },
    { in: "src/popup.ts", out: "popup" },
    { in: "src/options.ts", out: "options" },
  ],
  bundle: true,
  outdir: distDir,
  target: "es2022",
  format: "esm",
  sourcemap: process.env.NODE_ENV !== "production",
  minify: process.env.NODE_ENV === "production",
  logLevel: "info",
};

copyStaticAssets();

if (isWatch) {
  const ctx = await esbuild.context({
    ...buildOptions,
    plugins: [
      {
        name: "copy-assets-plugin",
        setup(build) {
          build.onEnd(() => {
            copyStaticAssets();
          });
        },
      },
    ],
  });
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  copyStaticAssets();
  console.log("Build completed successfully.");
}

