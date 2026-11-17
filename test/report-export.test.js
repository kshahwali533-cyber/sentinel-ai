import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

test("professional report CSV export downloads valid escaped data safely", async () => {
  const actions = fs.readFileSync("sentinel-actions.js", "utf8");
  let clickHandler;
  let createdBlob = null;
  let downloadName = "";

  class FakeElement {
    constructor(dataset = {}) {
      this.dataset = dataset;
      this.style = {};
      this.download = "";
      this.href = "";
    }
    closest() { return this; }
    click() { downloadName = this.download; }
    remove() {}
  }

  const reportData = {
    report: {
      website: "https://example.com",
      scanId: "scan-001",
      generatedAt: "2026-11-17T12:00:00.000Z",
      securityScore: 80,
      riskLevel: "Medium"
    },
    checks: [{
      name: "Injected formula",
      status: "WARNING",
      message: "=1+1, should be treated as text",
      fix: "Use a safe configuration",
      evidence: { source: "HTTP header", observed: "line one\nline two", expected: "present" }
    }]
  };

  const dataNode = { textContent: JSON.stringify(reportData) };
  const document = {
    addEventListener(type, handler) {
      if (type === "click") clickHandler = handler;
    },
    getElementById(id) {
      return id === "sentinelReportData" ? dataNode : null;
    },
    createElement() { return new FakeElement(); },
    body: { appendChild() {} }
  };
  const urlApi = {
    createObjectURL(blob) {
      createdBlob = blob;
      return "blob:sentinel-report";
    },
    revokeObjectURL() {}
  };
  const window = {
    alert(message) { throw new Error(message); },
    setTimeout(callback) { callback(); }
  };

  vm.runInNewContext(actions, {
    document,
    window,
    Element: FakeElement,
    Blob,
    URL: urlApi,
    console
  });

  clickHandler({ target: new FakeElement({ action: "export-security-report-csv" }) });

  assert.equal(downloadName, "sentinel-security-report.csv");
  assert.ok(createdBlob);
  const csv = await createdBlob.text();
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Website/);
  assert.match(csv, /https:\/\/example\.com/);
  assert.match(csv, /'=1\+1, should be treated as text/);
  assert.match(csv, /"line one line two"/);
  assert.ok(csv.includes("\r\n"));
});
