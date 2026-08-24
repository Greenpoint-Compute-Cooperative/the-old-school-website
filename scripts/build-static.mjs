import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist");
if (!output.startsWith(`${root}${sep}`)) throw new Error("Unsafe output path");

await rm(output, { recursive: true, force: true });
await mkdir(join(output, "public"), { recursive: true });

for (const file of ["index.html", "app.js", "analytics.js", "catalog.js", "styles.css", "manifest.webmanifest", "robots.txt", "sitemap.xml"]) {
  await copyFile(join(root, file), join(output, file));
}

await cp(join(root, "public", "assets"), join(output, "public", "assets"), { recursive: true });
await mkdir(join(output, ".well-known"), { recursive: true });
await copyFile(join(root, "public", ".well-known", "security.txt"), join(output, ".well-known", "security.txt"));
console.log("Static storefront built in dist/.");
