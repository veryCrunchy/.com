#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dir, "../.env");

  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);

  if (index === -1 || index === process.argv.length - 1) {
    return fallback;
  }

  return process.argv[index + 1];
}

loadEnv();

const BASE = process.env.NUXT_PUBLIC_DIRECTUS_URL?.replace(/\/$/, "");
const TOKEN = process.env.DIRECTUS_TOKEN;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

if (!BASE || !TOKEN) {
  console.error("❌  Missing NUXT_PUBLIC_DIRECTUS_URL or DIRECTUS_TOKEN in .env");
  process.exit(1);
}

const prefix = String(readArg("--prefix", "")).trim().toUpperCase();
const count = Number(readArg("--count", "50"));
const dryRun = process.argv.includes("--dry-run");

if (prefix && !/^[A-Z0-9-]{1,12}$/.test(prefix)) {
  console.error("❌  Prefix must be 1-12 uppercase letters, numbers, or dashes.");
  process.exit(1);
}

if (!Number.isInteger(count) || count <= 0) {
  console.error("❌  --count must be a positive integer.");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();

  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

function randomFromAlphabet(length, alphabet) {
  const maxByte = Math.floor(256 / alphabet.length) * alphabet.length;
  let result = "";

  while (result.length < length) {
    const bytes = randomBytes(length * 2);

    for (const value of bytes) {
      if (value >= maxByte) continue;
      result += alphabet[value % alphabet.length];
      if (result.length === length) break;
    }
  }

  return result;
}

function formatCodeBody(body) {
  return `${body.slice(0, 5)}-${body.slice(5)}`;
}

function createCode() {
  const body = formatCodeBody(randomFromAlphabet(10, CODE_ALPHABET));
  return prefix ? `${prefix}-${body}` : body;
}

function createGalleryToken() {
  return randomFromAlphabet(24, TOKEN_ALPHABET);
}

const codes = new Set();
while (codes.size < count) {
  codes.add(createCode());
}

console.log(`\nPreparing ${codes.size} secure codes:\n`);
for (const code of codes) {
  console.log(`  ${code}`);
}

if (dryRun) {
  console.log("\nDry run only. No Directus records were created.\n");
  process.exit(0);
}

let created = 0;
let skipped = 0;

for (const code of codes) {
  const result = await api("POST", "/items/street_delivery_sessions", {
    code,
    status: "new",
    public_enabled: true,
    gallery_token: createGalleryToken(),
  });

  if (result.ok) {
    created += 1;
    console.log(`  ✔  created ${code}`);
    continue;
  }

  const duplicate = JSON.stringify(result.data).includes("RECORD_NOT_UNIQUE");

  if (duplicate) {
    skipped += 1;
    console.log(`  –  skipped ${code} (already exists)`);
    continue;
  }

  console.error(`  ❌  failed ${code}: ${JSON.stringify(result.data)}`);
  process.exit(1);
}

console.log(`\n✅  Finished. Created ${created}, skipped ${skipped}.\n`);
