const fs = require("fs");
const path = require("path");

async function runApiVerification() {
  console.log("=== Verifying Unify Engine Express Endpoints ===");

  // 1. Test /api/sample
  const sampleRes = await fetch("http://localhost:3000/api/sample");
  if (!sampleRes.ok) throw new Error(`GET /api/sample failed: ${sampleRes.status}`);
  const sampleData = await sampleRes.json();
  console.log(`✅ GET /api/sample OK! Course: ${sampleData.course}, Week: ${sampleData.week}`);

  // 2. Test /api/validate
  const valRes = await fetch("http://localhost:3000/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sampleData)
  });
  const valData = await valRes.json();
  if (!valData.valid) throw new Error(`POST /api/validate failed: ${JSON.stringify(valData.errors)}`);
  console.log("✅ POST /api/validate OK! Validation passed.");

  // 3. Test /api/render
  const renderRes = await fetch("http://localhost:3000/api/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sampleData)
  });
  const html = await renderRes.text();
  if (!html.includes("<!DOCTYPE html>") || !html.includes("Unify Learn")) {
    throw new Error("POST /api/render failed to produce valid HTML");
  }
  console.log(`✅ POST /api/render OK! HTML length: ${html.length} bytes.`);

  // 4. Test /api/save
  const saveRes = await fetch("http://localhost:3000/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sampleData)
  });
  const saveData = await saveRes.json();
  if (!saveData.success) throw new Error(`POST /api/save failed: ${saveData.error}`);
  console.log(`✅ POST /api/save OK! File saved: ${saveData.filename}`);

  console.log("=== All API Endpoints Verified Successfully! ===");
}

runApiVerification().catch(err => {
  console.error("❌ API Verification Error:", err);
  process.exit(1);
});
