import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

test("professional report Print / Save as PDF action opens the browser print dialog", () => {
  const actions = fs.readFileSync("sentinel-actions.js", "utf8");
  let clickHandler;
  let printCalls = 0;

  class FakeElement {
    constructor(dataset = {}) {
      this.dataset = dataset;
    }
    closest() { return this; }
  }

  const document = {
    addEventListener(type, handler) {
      if (type === "click") clickHandler = handler;
    }
  };
  const window = {
    print() { printCalls += 1; }
  };

  vm.runInNewContext(actions, {
    document,
    window,
    Element: FakeElement,
    console
  });

  assert.equal(typeof clickHandler, "function");
  clickHandler({ target: new FakeElement({ action: "print-report" }) });
  assert.equal(printCalls, 1);
});
