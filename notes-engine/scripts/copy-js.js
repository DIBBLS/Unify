// Copies plain .js sources (schema.js, renderer.js) into dist/ so the tsc
// build output stays runnable on Render. Cross-platform (no shell cp).
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src");
const distDir = path.join(__dirname, "..", "dist", "src");

function copyJs(dir, rel) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      copyJs(path.join(dir, e.name), path.join(rel, e.name));
    } else if (e.name.endsWith(".js")) {
      const dest = path.join(distDir, rel, e.name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(dir, e.name), dest);
    }
  }
}

copyJs(srcDir, "");
console.log("copied src js -> dist/src");
