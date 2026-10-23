const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { trustedSender } = require("../../desktop/app/host-management.cjs");

test("privileged IPC requires the exact local window and its main frame", () =>
{
  const file = "/private/tmp/Host mit Umlauten ä/management.html";
  const mainFrame = { url: pathToFileURL(file).href };
  const contents = { mainFrame, isDestroyed: () => false };
  assert.equal(trustedSender({ sender: contents, senderFrame: mainFrame }, contents, file), true);
  assert.equal(trustedSender({ sender: {}, senderFrame: mainFrame }, contents, file), false);
  assert.equal(trustedSender({ sender: contents, senderFrame: { url: mainFrame.url } }, contents, file), false);
  mainFrame.url = "http://127.0.0.1:3210/management.html";
  assert.equal(trustedSender({ sender: contents, senderFrame: mainFrame }, contents, file), false);
  mainFrame.url = pathToFileURL("/private/tmp/other.html").href;
  assert.equal(trustedSender({ sender: contents, senderFrame: mainFrame }, contents, file), false);
});
