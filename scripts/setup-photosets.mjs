#!/usr/bin/env node
/**
 * scripts/setup-photosets.mjs
 *
 * Creates the photosets collection + photosets_photos junction in Directus,
 * wires all relations, and sets public read permissions.
 *
 * Safe to re-run — skips steps that already exist.
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dir, "../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const BASE = process.env.NUXT_PUBLIC_DIRECTUS_URL?.replace(/\/$/, "");
const TOKEN = process.env.DIRECTUS_TOKEN;

if (!BASE || !TOKEN) {
  console.error("❌  Missing NUXT_PUBLIC_DIRECTUS_URL or DIRECTUS_TOKEN in .env");
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function collectionExists(name) {
  const r = await api("GET", `/collections/${name}`);
  return r.ok;
}

async function fieldExists(collection, field) {
  const r = await api("GET", `/fields/${collection}/${field}`);
  return r.ok;
}

async function relationExists(collection, field) {
  const r = await api("GET", `/relations/${collection}/${field}`);
  return r.ok;
}

async function getRelation(collection, field) {
  const r = await api("GET", `/relations/${collection}/${field}`);
  return r.ok ? r.data?.data || null : null;
}

// ── 1. Create photosets collection ───────────────────────────────────────────
if (await collectionExists("photosets")) {
  console.log("  –  photosets collection already exists");
} else {
  const r = await api("POST", "/collections", {
    collection: "photosets",
    meta: {
      icon: "collections_bookmark",
      display_template: "{{title}}",
      preview_url: "http://localhost:3000/photosets/{{slug}}",
    },
    schema: {},
    fields: [
      {
        field: "status",
        type: "string",
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Published", value: "published" },
              { text: "Draft", value: "draft" },
              { text: "Archived", value: "archived" },
            ],
          },
          display: "labels",
          display_options: {
            choices: [
              { text: "Published", value: "published", foreground: "#FFFFFF", background: "#2ecda7" },
              { text: "Draft", value: "draft", foreground: "#FFFFFF", background: "#ffa439" },
              { text: "Archived", value: "archived", foreground: "#FFFFFF", background: "#8b909a" },
            ],
          },
          width: "half",
        },
        schema: { default_value: "draft", is_nullable: false },
      },
      {
        field: "slug",
        type: "string",
        meta: { interface: "input", width: "half" },
        schema: { is_unique: true },
      },
      {
        field: "title",
        type: "string",
        meta: { interface: "input", width: "full" },
        schema: {},
      },
      {
        field: "description",
        type: "text",
        meta: { interface: "input-multiline", width: "full" },
        schema: {},
      },
      {
        field: "cover_image",
        type: "uuid",
        meta: { interface: "file-image", special: ["file"], width: "full" },
        schema: {},
      },
      {
        field: "published_at",
        type: "timestamp",
        meta: { interface: "datetime", width: "half" },
        schema: {},
      },
      {
        field: "tags",
        type: "json",
        meta: {
          interface: "tags",
          options: { iconRight: "local_offer" },
          display: "labels",
          width: "full",
        },
        schema: {},
      },
    ],
  });
  if (r.ok) console.log("  ✔  created collection: photosets");
  else { console.error("  ❌  photosets:", JSON.stringify(r.data)); process.exit(1); }
}

// ── 2. cover_image → directus_files relation ─────────────────────────────────
if (await relationExists("photosets", "cover_image")) {
  console.log("  –  relation photosets.cover_image already exists");
} else {
  const r = await api("POST", "/relations", {
    collection: "photosets",
    field: "cover_image",
    related_collection: "directus_files",
  });
  if (r.ok) console.log("  ✔  relation: photosets.cover_image → directus_files");
  else console.warn("  ⚠   cover_image relation:", JSON.stringify(r.data));
}

// ── 3. Create junction collection photosets_photos ───────────────────────────
if (await collectionExists("photosets_photos")) {
  console.log("  –  photosets_photos junction already exists");
} else {
  const r = await api("POST", "/collections", {
    collection: "photosets_photos",
    meta: { hidden: true, icon: "import_export" },
    schema: {},
    fields: [
      {
        field: "id",
        type: "integer",
        meta: { hidden: true },
        schema: { is_primary_key: true, has_auto_increment: true },
      },
      {
        field: "photosets_id",
        type: "integer",
        meta: { hidden: true },
        schema: {},
      },
      {
        field: "photos_id",
        type: "integer",
        meta: { hidden: true },
        schema: {},
      },
      {
        field: "sort",
        type: "integer",
        meta: { hidden: true },
        schema: {},
      },
    ],
  });
  if (r.ok) console.log("  ✔  created junction: photosets_photos");
  else { console.error("  ❌  photosets_photos:", JSON.stringify(r.data)); process.exit(1); }
}

// ── 4. Junction relations ─────────────────────────────────────────────────────
const photosetsRelation = await getRelation("photosets_photos", "photosets_id");

if (!photosetsRelation) {
  const r = await api("POST", "/relations", {
    collection: "photosets_photos",
    field: "photosets_id",
    related_collection: "photosets",
    meta: {
      one_field: "photos",
      sort_field: "sort",
    },
  });
  if (r.ok) console.log("  ✔  relation: photosets_photos.photosets_id → photosets");
  else console.warn("  ⚠   photosets_id relation:", JSON.stringify(r.data));
} else if (
  photosetsRelation.meta?.one_field !== "photos" ||
  photosetsRelation.meta?.junction_field !== null ||
  photosetsRelation.meta?.sort_field !== "sort"
) {
  const r = await api("PATCH", "/relations/photosets_photos/photosets_id", {
    meta: {
      one_field: "photos",
      junction_field: null,
      sort_field: "sort",
    },
  });
  if (r.ok) console.log("  ✔  repaired relation: photosets_photos.photosets_id → photosets");
  else console.warn("  ⚠   repair photosets_id relation:", JSON.stringify(r.data));
} else {
  console.log("  –  relation photosets_photos.photosets_id already exists");
}

const photosRelation = await getRelation("photosets_photos", "photos_id");

if (!photosRelation) {
  const r = await api("POST", "/relations", {
    collection: "photosets_photos",
    field: "photos_id",
    related_collection: "photos",
    meta: {
      junction_field: "photosets_id",
    },
  });
  if (r.ok) console.log("  ✔  relation: photosets_photos.photos_id → photos");
  else console.warn("  ⚠   photos_id relation:", JSON.stringify(r.data));
} else if (
  photosRelation.meta?.junction_field !== "photosets_id" ||
  photosRelation.meta?.one_field !== null
) {
  const r = await api("PATCH", "/relations/photosets_photos/photos_id", {
    meta: {
      one_field: null,
      junction_field: "photosets_id",
      sort_field: null,
    },
  });
  if (r.ok) console.log("  ✔  repaired relation: photosets_photos.photos_id → photos");
  else console.warn("  ⚠   repair photos_id relation:", JSON.stringify(r.data));
} else {
  console.log("  –  relation photosets_photos.photos_id already exists");
}

// ── 5. Add `photos` M2M field on photosets collection ────────────────────────
if (await fieldExists("photosets", "photos")) {
  console.log("  –  photosets.photos field already exists");
} else {
  const r = await api("POST", "/fields/photosets", {
    field: "photos",
    type: "alias",
    meta: {
      interface: "list-m2m",
      special: ["m2m"],
      options: {
        template: "{{photos_id.title}}",
        enableCreate: false,
        enableSelect: true,
      },
      display: "related-values",
      display_options: { template: "{{photos_id.title}}" },
      width: "full",
    },
    schema: null,
  });
  if (r.ok) console.log("  ✔  field: photosets.photos (M2M)");
  else console.warn("  ⚠   photos M2M field:", JSON.stringify(r.data));
}

// ── 6. Public read permissions ────────────────────────────────────────────────
const policiesRes = await api("GET", "/policies?filter[name][_eq]=$t:public_label&limit=1");
const publicPolicy = policiesRes.data?.data?.[0];

if (!publicPolicy) {
  console.warn("  ⚠   Could not find public policy — skipping permissions");
} else {
  for (const collection of ["photosets", "photosets_photos"]) {
    const filter = collection === "photosets"
      ? { status: { _eq: "published" } }
      : {};

    const r = await api("POST", "/permissions", {
      policy: publicPolicy.id,
      collection,
      action: "read",
      fields: ["*"],
      ...(Object.keys(filter).length ? { filter } : {}),
    });
    if (r.ok) console.log(`  ✔  public read: ${collection}`);
    else console.warn(`  ⚠   permission ${collection}:`, JSON.stringify(r.data));
  }
}

console.log("\n✅  Photosets schema ready.\n");
