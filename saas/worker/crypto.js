// Envelope encryption for per-organization secrets (AI keys, telephony
// credentials) using AES-256-GCM via the Workers Web Crypto API.
//
// Why this exists: an organization's own API key is the client's money. It is
// stored encrypted, decrypted only inside the Worker for the duration of one
// provider call, and never returned to any UI — the cabinet sees `keyHint()`
// and nothing else.
//
// The master key lives in a single Worker secret, ORG_SECRET_KEY: 32 random
// bytes, base64. Generate one with:
//   openssl rand -base64 32
//   npx wrangler secret put ORG_SECRET_KEY

const ALGO = "AES-GCM";
const IV_BYTES = 12; // 96-bit nonce, the size AES-GCM is specified for
const VERSION = "v1";

function b64encode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64decode(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importMasterKey(masterKeyB64) {
  if (!masterKeyB64) throw new Error("org_secret_key_missing");
  const raw = b64decode(masterKeyB64);
  if (raw.length !== 32) throw new Error("org_secret_key_must_be_32_bytes");
  return crypto.subtle.importKey("raw", raw, ALGO, false, ["encrypt", "decrypt"]);
}

// Returns "v1.<iv-b64>.<ciphertext-b64>" — self-describing so the format can
// be rotated later without guessing what an existing row holds.
export async function encryptSecret(plaintext, masterKeyB64) {
  const key = await importMasterKey(masterKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);
  return [VERSION, b64encode(iv), b64encode(new Uint8Array(cipher))].join(".");
}

export async function decryptSecret(envelope, masterKeyB64) {
  const [version, ivB64, cipherB64] = String(envelope || "").split(".");
  if (version !== VERSION || !ivB64 || !cipherB64) {
    throw new Error("ciphertext_unreadable");
  }
  const key = await importMasterKey(masterKeyB64);
  const plain = await crypto.subtle.decrypt(
    { name: ALGO, iv: b64decode(ivB64) },
    key,
    b64decode(cipherB64)
  );
  return new TextDecoder().decode(plain);
}

// The only representation of a key that may reach a browser. Four trailing
// characters is enough for a human to tell two keys apart and useless to a
// thief.
export function keyHint(plaintext) {
  const value = String(plaintext || "");
  return value.length <= 4 ? "…" : `…${value.slice(-4)}`;
}
