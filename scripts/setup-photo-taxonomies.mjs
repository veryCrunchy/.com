#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dir, "../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
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
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

async function collectionExists(name) {
  return (await api("GET", `/collections/${name}`)).ok;
}

async function fieldExists(collection, field) {
  return (await api("GET", `/fields/${collection}/${field}`)).ok;
}

async function relationExists(collection, field) {
  return (await api("GET", `/relations/${collection}/${field}`)).ok;
}

async function ensureCollection(collection, fields, meta = {}) {
  if (await collectionExists(collection)) {
    console.log(`  –  ${collection} collection already exists`);
    return;
  }

  const r = await api("POST", "/collections", {
    collection,
    meta,
    schema: {},
    fields,
  });

  if (r.ok) console.log(`  ✔  created collection: ${collection}`);
  else {
    console.error(`  ❌  ${collection}:`, JSON.stringify(r.data));
    process.exit(1);
  }
}

await ensureCollection(
  "photo_locations",
  [
    { field: "id", type: "integer", meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
    { field: "slug", type: "string", meta: { interface: "input", width: "half" }, schema: { is_unique: true } },
    { field: "title", type: "string", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "city", type: "string", meta: { interface: "input", width: "third" }, schema: {} },
    { field: "region", type: "string", meta: { interface: "input", width: "third" }, schema: {} },
    { field: "country", type: "string", meta: { interface: "input", width: "third" }, schema: {} },
    { field: "latitude", type: "float", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "longitude", type: "float", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "description", type: "text", meta: { interface: "input-multiline", width: "full" }, schema: {} },
  ],
  { icon: "location_on", display_template: "{{title}}" }
);

await ensureCollection(
  "camera_bodies",
  [
    { field: "id", type: "integer", meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
    { field: "slug", type: "string", meta: { interface: "input", width: "half" }, schema: { is_unique: true } },
    { field: "brand", type: "string", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "model", type: "string", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "label", type: "string", meta: { interface: "input", width: "half" }, schema: {} },
  ],
  { icon: "photo_camera", display_template: "{{label}}" }
);

await ensureCollection(
  "lenses",
  [
    { field: "id", type: "integer", meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
    { field: "slug", type: "string", meta: { interface: "input", width: "half" }, schema: { is_unique: true } },
    { field: "brand", type: "string", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "model", type: "string", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "label", type: "string", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "mount", type: "string", meta: { interface: "input", width: "third" }, schema: {} },
    { field: "focal_range", type: "string", meta: { interface: "input", width: "third" }, schema: {} },
    { field: "max_aperture", type: "string", meta: { interface: "input", width: "third" }, schema: {} },
  ],
  { icon: "camera", display_template: "{{label}}" }
);

const photoRelations = [
  {
    field: "location_ref",
    label: "Location",
    related: "photo_locations",
    template: "{{title}}",
  },
  {
    field: "camera_ref",
    label: "Camera Body",
    related: "camera_bodies",
    template: "{{label}}",
  },
  {
    field: "lens_ref",
    label: "Lens",
    related: "lenses",
    template: "{{label}}",
  },
];

for (const relation of photoRelations) {
  if (!(await fieldExists("photos", relation.field))) {
    const createField = await api("POST", "/fields/photos", {
      field: relation.field,
      type: "integer",
      meta: {
        interface: "select-dropdown-m2o",
        display: "related-values",
        display_options: { template: relation.template },
        width: "full",
        note: relation.label,
      },
      schema: {},
    });

    if (createField.ok) console.log(`  ✔  field: photos.${relation.field}`);
    else console.warn(`  ⚠   field photos.${relation.field}:`, JSON.stringify(createField.data));
  } else {
    console.log(`  –  photos.${relation.field} field already exists`);
  }

  if (!(await relationExists("photos", relation.field))) {
    const createRelation = await api("POST", "/relations", {
      collection: "photos",
      field: relation.field,
      related_collection: relation.related,
    });

    if (createRelation.ok) console.log(`  ✔  relation: photos.${relation.field} → ${relation.related}`);
    else console.warn(`  ⚠   relation photos.${relation.field}:`, JSON.stringify(createRelation.data));
  } else {
    console.log(`  –  relation photos.${relation.field} already exists`);
  }
}

const policiesRes = await api("GET", "/policies?filter[name][_eq]=$t:public_label&limit=1");
const publicPolicy = policiesRes.data?.data?.[0];

if (!publicPolicy) {
  console.warn("  ⚠   Could not find public policy — skipping permissions");
} else {
  for (const collection of ["photo_locations", "camera_bodies", "lenses"]) {
    const r = await api("POST", "/permissions", {
      policy: publicPolicy.id,
      collection,
      action: "read",
      fields: ["*"],
    });

    if (r.ok) console.log(`  ✔  public read: ${collection}`);
    else console.warn(`  ⚠   permission ${collection}:`, JSON.stringify(r.data));
  }
}

console.log("\n✅  Photo taxonomy schema ready.\n");
