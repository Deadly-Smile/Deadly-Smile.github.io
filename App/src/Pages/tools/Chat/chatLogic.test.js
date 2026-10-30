// Plain Node script: node src/Pages/tools/Chat/chatLogic.test.js
import { parseMac, formatMac, peerIdFor, macFromPeerId, macFromBytes, randomName, cleanName } from "./identity.js";
import { generateKeys, exportPublicKey, macFromPublicKey, randomNonce, signChallenge, verifyChallenge } from "./auth.js";
import { storedMessage, incomingText, buildPeerList, upsertMessage, groupMessages, displayName } from "./history.js";

let failed = 0;
function check(name, cond) {
  if (!cond) { failed++; console.error("FAIL:", name); }
  else console.log("ok:", name);
}

// ── identity ────────────────────────────────────────────────────────────────
check("parse colon form", parseMac("A4:3F:9C:12:7E:D0") === "a43f9c127ed0");
check("parse dash form", parseMac("a4-3f-9c-12-7e-d0") === "a43f9c127ed0");
check("parse peer id", parseMac("dsc-a43f9c127ed0") === "a43f9c127ed0");
check("reject short", parseMac("a43f9c12") === null);
check("reject non-hex", parseMac("zz3f9c127ed0") === null);
check("format", formatMac("a43f9c127ed0") === "A4:3F:9C:12:7E:D0");
check("peer id round trip", macFromPeerId(peerIdFor("a43f9c127ed0")) === "a43f9c127ed0");
check("foreign peer id rejected", macFromPeerId("AB12CD") === null);
const m = macFromBytes([0xff, 1, 2, 3, 4, 5, 6, 7]);
check("locally administered, unicast", m === "fe0102030405");
check("random name shape", /^[A-Z][a-z]+-[A-Z][a-z]+$/.test(randomName()));
check("clean name trims and caps", cleanName("  a   b  ") === "a b" && cleanName("x".repeat(50)).length === 32);
check("clean name rejects non-string", cleanName(42) === "");

// ── auth ────────────────────────────────────────────────────────────────────
const alice = await generateKeys();
const bob = await generateKeys();
const alicePub = await exportPublicKey(alice.publicKey);
const bobPub = await exportPublicKey(bob.publicKey);
const aliceMac = await macFromPublicKey(alicePub);
const bobMac = await macFromPublicKey(bobPub);
check("mac from key is valid", parseMac(aliceMac) === aliceMac);
check("mac from key is stable", (await macFromPublicKey(alicePub)) === aliceMac);
check("different keys, different macs", aliceMac !== bobMac);

const nonce = randomNonce();
const sig = await signChallenge(alice.privateKey, nonce, aliceMac, bobMac);
check("valid signature verifies", await verifyChallenge(alicePub, sig, nonce, aliceMac, bobMac));
check("wrong key fails", !(await verifyChallenge(bobPub, sig, nonce, aliceMac, bobMac)));
check("wrong nonce fails", !(await verifyChallenge(alicePub, sig, randomNonce(), aliceMac, bobMac)));
check("replay to other verifier fails", !(await verifyChallenge(alicePub, sig, nonce, aliceMac, "020000000000")));
check("garbage signature fails", !(await verifyChallenge(alicePub, "AAAA", nonce, aliceMac, bobMac)));
check("garbage key fails", !(await verifyChallenge("not-base64!", sig, nonce, aliceMac, bobMac)));

// ── history ─────────────────────────────────────────────────────────────────
const file = storedMessage({ peer: "p", id: "1", from: "me", type: "file", name: "a.pdf", mime: "application/pdf", size: 9, data: new ArrayBuffer(9), progress: 0.5, ts: 1, status: "sent" });
check("stored file drops blob and progress", !("data" in file) && !("progress" in file) && file.name === "a.pdf");
check("stored text keeps text", storedMessage({ peer: "p", id: "2", from: "me", type: "text", text: "hi", ts: 1, status: "queued" }).text === "hi");

check("incoming text ok", incomingText({ id: "x", text: "hey" }, "p", 5)?.ts === 5);
check("incoming text rejects missing id", incomingText({ text: "hey" }, "p", 5) === null);
check("incoming text rejects non-string", incomingText({ id: "x", text: {} }, "p", 5) === null);
check("incoming text caps length", incomingText({ id: "x", text: "a".repeat(20000) }, "p", 5).text.length === 10000);

const A = "020000000001", B = "020000000002", C = "020000000003", ME = "020000000009";
const list = buildPeerList({
  myMac: ME,
  contacts: [
    { mac: A, name: "Alice", lastMessageAt: 10, unread: 0 },
    { mac: B, name: "Bob", nickname: "Bobby", lastMessageAt: 5, unread: 2 },
  ],
  nearby: [{ mac: C, name: "Carol" }, { mac: ME, name: "me" }],
  online: [{ mac: A, name: "Alice" }],
  links: {},
});
check("self excluded", !list.some(r => r.mac === ME));
check("nearby stranger listed", list.find(r => r.mac === C)?.label === "Carol");
check("online sorted first", list[0].online && list[1].online && !list[2].online);
check("nickname wins", list.find(r => r.mac === B).label === "Bobby");
check("unread carried", list.find(r => r.mac === B).unread === 2);
check("nearby flag", list.find(r => r.mac === C).nearby && !list.find(r => r.mac === A).nearby);
const linked = buildPeerList({ myMac: ME, contacts: [{ mac: B, name: "Bob" }], links: { [B]: "ready" } });
check("ready link means online", linked[0].online);
check("fallback display name", displayName(null, A) === "Device 00:01");

let msgs = upsertMessage([], { id: "a", ts: 2 });
msgs = upsertMessage(msgs, { id: "b", ts: 1 });
check("upsert keeps ts order", msgs.map(x => x.id).join() === "b,a");
msgs = upsertMessage(msgs, { id: "a", status: "delivered" });
check("upsert merges", msgs.length === 2 && msgs[1].status === "delivered" && msgs[1].ts === 2);

const g = groupMessages([
  { id: "1", from: "me", ts: new Date(2026, 0, 1, 10).getTime() },
  { id: "2", from: "me", ts: new Date(2026, 0, 1, 11).getTime() },
  { id: "3", from: "them", ts: new Date(2026, 0, 2, 9).getTime() },
]);
check("group avatar", g[0].showAvatar && !g[1].showAvatar && g[2].showAvatar);
check("group date", g[0].showDate && !g[1].showDate && g[2].showDate);

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
