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

if (await collectionExists("photos_motion_frames")) {
  console.log("  –  photos_motion_frames collection already exists");
} else {
  const r = await api("POST", "/collections", {
    collection: "photos_motion_frames",
    meta: { hidden: true, icon: "motion_photos_on" },
    schema: {},
    fields: [
      {
        field: "id",
        type: "integer",
        meta: { hidden: true },
        schema: { is_primary_key: true, has_auto_increment: true },
      },
      {
        field: "photos_id",
        type: "integer",
        meta: { hidden: true },
        schema: {},
      },
      {
        field: "frame_file",
        type: "uuid",
        meta: { interface: "file-image", special: ["file"], width: "full" },
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

  if (r.ok) console.log("  ✔  created collection: photos_motion_frames");
  else {
    console.error("  ❌  photos_motion_frames:", JSON.stringify(r.data));
    process.exit(1);
  }
}

if (await relationExists("photos_motion_frames", "frame_file")) {
  console.log("  –  relation photos_motion_frames.frame_file already exists");
} else {
  const r = await api("POST", "/relations", {
    collection: "photos_motion_frames",
    field: "frame_file",
    related_collection: "directus_files",
  });

  if (r.ok) console.log("  ✔  relation: photos_motion_frames.frame_file → directus_files");
  else console.warn("  ⚠   frame_file relation:", JSON.stringify(r.data));
}

if (await relationExists("photos_motion_frames", "photos_id")) {
  console.log("  –  relation photos_motion_frames.photos_id already exists");
} else {
  const r = await api("POST", "/relations", {
    collection: "photos_motion_frames",
    field: "photos_id",
    related_collection: "photos",
    meta: {
      one_field: "motion_frames",
      sort_field: "sort",
    },
  });

  if (r.ok) console.log("  ✔  relation: photos_motion_frames.photos_id → photos");
  else console.warn("  ⚠   photos_id relation:", JSON.stringify(r.data));
}

if (await fieldExists("photos", "motion_frames")) {
  console.log("  –  photos.motion_frames field already exists");
} else {
  const r = await api("POST", "/fields/photos", {
    field: "motion_frames",
    type: "alias",
    meta: {
      interface: "list-o2m",
      special: ["o2m"],
      options: {
        template: "{{frame_file.filename_download}}",
        enableCreate: true,
        enableSelect: true,
      },
      display: "related-values",
      display_options: { template: "{{frame_file.filename_download}}" },
      width: "full",
      note: "Additional motion frames that play before the final hero image.",
    },
    schema: null,
  });

  if (r.ok) console.log("  ✔  field: photos.motion_frames (O2M)");
  else console.warn("  ⚠   motion_frames field:", JSON.stringify(r.data));
}

const policiesRes = await api("GET", "/policies?filter[name][_eq]=$t:public_label&limit=1");
const publicPolicy = policiesRes.data?.data?.[0];

if (!publicPolicy) {
  console.warn("  ⚠   Could not find public policy — skipping permissions");
} else {
  const r = await api("POST", "/permissions", {
    policy: publicPolicy.id,
    collection: "photos_motion_frames",
    action: "read",
    fields: ["*"],
  });

  if (r.ok) console.log("  ✔  public read: photos_motion_frames");
  else console.warn("  ⚠   permission photos_motion_frames:", JSON.stringify(r.data));
}

console.log("\n✅  Photo motion schema ready.\n");
