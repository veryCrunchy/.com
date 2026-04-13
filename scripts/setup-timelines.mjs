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
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
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

if (await collectionExists("timelines")) {
  console.log("  –  timelines collection already exists");
} else {
  const r = await api("POST", "/collections", {
    collection: "timelines",
    meta: {
      icon: "timeline",
      display_template: "{{title}}",
      preview_url: "http://localhost:3000/timelines/{{slug}}",
    },
    schema: {},
    fields: [
      { field: "status", type: "string", meta: { interface: "select-dropdown", width: "half" }, schema: { default_value: "draft", is_nullable: false } },
      { field: "slug", type: "string", meta: { interface: "input", width: "half" }, schema: { is_unique: true } },
      { field: "title", type: "string", meta: { interface: "input", width: "full" }, schema: {} },
      { field: "description", type: "text", meta: { interface: "input-multiline", width: "full" }, schema: {} },
      { field: "story", type: "text", meta: { interface: "input-rich-text-html", width: "full" }, schema: {} },
      { field: "cover_image", type: "uuid", meta: { interface: "file-image", special: ["file"], width: "full" }, schema: {} },
      { field: "published_at", type: "timestamp", meta: { interface: "datetime", width: "half" }, schema: {} },
      { field: "tags", type: "json", meta: { interface: "tags", width: "full", display: "labels" }, schema: {} },
    ],
  });
  if (r.ok) console.log("  ✔  created collection: timelines");
  else {
    console.error("  ❌  timelines:", JSON.stringify(r.data));
    process.exit(1);
  }
}

if (!(await relationExists("timelines", "cover_image"))) {
  const r = await api("POST", "/relations", {
    collection: "timelines",
    field: "cover_image",
    related_collection: "directus_files",
  });
  if (r.ok) console.log("  ✔  relation: timelines.cover_image → directus_files");
  else console.warn("  ⚠   cover_image relation:", JSON.stringify(r.data));
} else {
  console.log("  –  relation timelines.cover_image already exists");
}

if (await collectionExists("timelines_photos")) {
  console.log("  –  timelines_photos junction already exists");
} else {
  const r = await api("POST", "/collections", {
    collection: "timelines_photos",
    meta: { hidden: true, icon: "import_export" },
    schema: {},
    fields: [
      { field: "id", type: "integer", meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
      { field: "timelines_id", type: "integer", meta: { hidden: true }, schema: {} },
      { field: "photos_id", type: "integer", meta: { hidden: true }, schema: {} },
      { field: "sort", type: "integer", meta: { hidden: true }, schema: {} },
      { field: "chapter_title", type: "string", meta: { interface: "input", width: "full" }, schema: {} },
      { field: "story_text", type: "text", meta: { interface: "input-rich-text-html", width: "full" }, schema: {} },
    ],
  });
  if (r.ok) console.log("  ✔  created junction: timelines_photos");
  else {
    console.error("  ❌  timelines_photos:", JSON.stringify(r.data));
    process.exit(1);
  }
}

if (!(await relationExists("timelines_photos", "timelines_id"))) {
  const r = await api("POST", "/relations", {
    collection: "timelines_photos",
    field: "timelines_id",
    related_collection: "timelines",
    meta: {
      one_field: "entries",
      sort_field: "sort",
    },
  });
  if (r.ok) console.log("  ✔  relation: timelines_photos.timelines_id → timelines");
  else console.warn("  ⚠   timelines_id relation:", JSON.stringify(r.data));
} else {
  console.log("  –  relation timelines_photos.timelines_id already exists");
}

if (!(await relationExists("timelines_photos", "photos_id"))) {
  const r = await api("POST", "/relations", {
    collection: "timelines_photos",
    field: "photos_id",
    related_collection: "photos",
  });
  if (r.ok) console.log("  ✔  relation: timelines_photos.photos_id → photos");
  else console.warn("  ⚠   photos_id relation:", JSON.stringify(r.data));
} else {
  console.log("  –  relation timelines_photos.photos_id already exists");
}

if (!(await fieldExists("timelines", "entries"))) {
  const r = await api("POST", "/fields/timelines", {
    field: "entries",
    type: "alias",
    meta: {
      interface: "list-o2m",
      special: ["o2m"],
      options: {
        template: "{{photos_id.title}}",
        enableCreate: true,
      },
      display: "related-values",
      display_options: { template: "{{photos_id.title}}" },
      width: "full",
    },
    schema: null,
  });
  if (r.ok) console.log("  ✔  field: timelines.entries (O2M)");
  else console.warn("  ⚠   timelines.entries:", JSON.stringify(r.data));
} else {
  console.log("  –  timelines.entries field already exists");
}

const policiesRes = await api("GET", "/policies?filter[name][_eq]=$t:public_label&limit=1");
const publicPolicy = policiesRes.data?.data?.[0];

if (!publicPolicy) {
  console.warn("  ⚠   Could not find public policy — skipping permissions");
} else {
  for (const collection of ["timelines", "timelines_photos"]) {
    const filter = collection === "timelines"
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

console.log("\n✅  Timeline schema ready.\n");
