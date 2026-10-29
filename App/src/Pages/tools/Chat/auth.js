// Per-device ECDSA keys and the connect-time handshake signatures.
// Uses only WebCrypto (globalThis.crypto.subtle), so it also runs under Node
// for chatLogic.test.js.
//
// Handshake (Chat.jsx): on open, both sides send { hello, pubKey, nonce }.
// Each checks macFromPublicKey(pubKey) equals the MAC in the PeerJS id it is
// talking to (and, for a known contact, that the key hasn't changed), then
// signs the other side's nonce. A link is trusted only once the peer's
// signature over *our* nonce verifies — so holding a PeerJS id isn't enough
// to impersonate a device; you need its private key.

import { macFromBytes } from "./identity.js";

const KEY_ALG = { name: "ECDSA", namedCurve: "P-256" };
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" };

function toBase64(buf) {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// The private key is non-extractable; IndexedDB can still store the CryptoKey.
export function generateKeys() {
  return crypto.subtle.generateKey(KEY_ALG, false, ["sign", "verify"]);
}

export async function exportPublicKey(publicKey) {
  return toBase64(await crypto.subtle.exportKey("spki", publicKey));
}

export async function macFromPublicKey(pubKeyB64) {
  const digest = await crypto.subtle.digest("SHA-256", fromBase64(pubKeyB64));
  return macFromBytes(new Uint8Array(digest));
}

export function randomNonce() {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

// Binds the signature to both ends so it can't be replayed to another device.
const challenge = (nonce, signerMac, verifierMac) =>
  new TextEncoder().encode(`p2pchat-auth:${nonce}:${signerMac}:${verifierMac}`);

export async function signChallenge(privateKey, nonce, signerMac, verifierMac) {
  return toBase64(await crypto.subtle.sign(SIGN_ALG, privateKey, challenge(nonce, signerMac, verifierMac)));
}

export async function verifyChallenge(pubKeyB64, signatureB64, nonce, signerMac, verifierMac) {
  try {
    const key = await crypto.subtle.importKey("spki", fromBase64(pubKeyB64), KEY_ALG, false, ["verify"]);
    return await crypto.subtle.verify(SIGN_ALG, key, fromBase64(signatureB64), challenge(nonce, signerMac, verifierMac));
  } catch {
    return false;
  }
}
