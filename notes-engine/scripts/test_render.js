const fs = require("fs");
const path = require("path");
const { validateUnifyNote } = require("../src/schema");
const { renderUnifyNote } = require("../src/renderer");

console.log("=== Testing Unify Engine Standalone (Zero-AI) Pipeline ===");

const samplePath = path.join(__dirname, "../samples/hand_authored_note.json");
const rawJson = fs.readFileSync(samplePath, "utf-8");
const noteData = JSON.parse(rawJson);

console.log(`Loaded sample note: ${noteData.course} Week ${noteData.week} - "${noteData.title}"`);

// Step 1: Validate Schema
const validation = validateUnifyNote(noteData);
if (!validation.valid) {
  console.error("❌ Schema Validation Failed:");
  validation.errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
console.log("✅ Schema Validation PASSED cleanly!");

// Step 2: Render to HTML
const renderedHtml = renderUnifyNote(noteData);
const outputPath = path.join(__dirname, "../samples/test_rendered.html");
fs.writeFileSync(outputPath, renderedHtml, "utf-8");

console.log(`✅ Note rendered successfully! Saved output to: ${outputPath}`);
console.log(`   Rendered file size: ${renderedHtml.length} bytes.`);
console.log("=== Standalone Engine Verification Complete ===");
