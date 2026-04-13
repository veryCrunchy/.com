#!/usr/bin/env node
/**
 * scripts/seed.mjs
 *
 * Creates the Directus schema (collections + fields) and seeds sample data.
 * Also configures public read permissions so no token is required in production.
 *
 * Usage:
 *   pnpm seed
 *   node scripts/seed.mjs
 *
 * Requires: NUXT_PUBLIC_DIRECTUS_URL and DIRECTUS_TOKEN in .env or environment.
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────
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

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    // 400 with "already_exists" type errors are safe to ignore
    let parsed;
    try { parsed = JSON.parse(text); } catch {}
    const isExistsError = parsed?.errors?.some(
      (e) =>
        e?.extensions?.code === "RECORD_NOT_UNIQUE" ||
        e?.message?.toLowerCase().includes("already exists") ||
        e?.message?.toLowerCase().includes("duplicate")
    );
    if (isExistsError) return null; // silently skip
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }

  if (res.status === 204 || !text) return null;
  return JSON.parse(text);
}

async function exists(collection) {
  try {
    const r = await fetch(`${BASE}/collections/${collection}`, { headers: HEADERS });
    return r.ok;
  } catch { return false; }
}

async function fieldExists(collection, field) {
  try {
    const r = await fetch(`${BASE}/fields/${collection}/${field}`, { headers: HEADERS });
    return r.ok;
  } catch { return false; }
}

// ── Collection schemas ────────────────────────────────────────────────────────

async function createCollection(schema) {
  const { collection } = schema;
  if (await exists(collection)) {
    console.log(`  ↳ collection ${collection} already exists, skipping`);
    return;
  }
  await api("POST", "/collections", schema);
  console.log(`  ✔  created collection: ${collection}`);
}

async function ensureField(collection, field) {
  if (await fieldExists(collection, field.field)) return;
  await api("POST", `/fields/${collection}`, field);
  console.log(`  ✔  created field: ${collection}.${field.field}`);
}

// ── Schema definitions ────────────────────────────────────────────────────────

const STATUS_CHOICES = [
  { text: "Published", value: "published" },
  { text: "Draft", value: "draft" },
  { text: "Archived", value: "archived" },
];

const SITE_SETTINGS_SCHEMA = {
  collection: "site_settings",
  meta: {
    icon: "settings",
    note: "Global site configuration. One row only.",
    singleton: false, // we use readItems([0]) for SDK compat
    sort_field: null,
  },
  schema: { name: "site_settings" },
  fields: [
    {
      field: "id",
      type: "integer",
      meta: { hidden: true, readonly: true, interface: "input" },
      schema: { is_primary_key: true, has_auto_increment: true },
    },
    {
      field: "sort",
      type: "integer",
      meta: { hidden: true, interface: "input" },
      schema: { is_nullable: true },
    },
    {
      field: "site_name",
      type: "string",
      meta: { interface: "input", options: { placeholder: "veryCrunchy" }, width: "half" },
      schema: { default_value: "veryCrunchy" },
    },
    {
      field: "site_tagline",
      type: "string",
      meta: { interface: "input", options: { placeholder: "Fullstack dev, photo journal" }, width: "half" },
      schema: { default_value: null, is_nullable: true },
    },
    {
      field: "site_description",
      type: "text",
      meta: { interface: "input-multiline" },
      schema: { default_value: null, is_nullable: true },
    },
    {
      field: "github_url",
      type: "string",
      meta: { interface: "input", options: { placeholder: "https://github.com/..." }, width: "half" },
      schema: { default_value: null, is_nullable: true },
    },
    {
      field: "support_url",
      type: "string",
      meta: { interface: "input", options: { placeholder: "https://ko-fi.com/..." }, width: "half" },
      schema: { default_value: null, is_nullable: true },
    },
    {
      field: "nav_cta_label",
      type: "string",
      meta: { interface: "input", options: { placeholder: "Support" }, width: "half" },
      schema: { default_value: "Support", is_nullable: true },
    },
    {
      field: "nav_cta_url",
      type: "string",
      meta: { interface: "input", width: "half" },
      schema: { default_value: null, is_nullable: true },
    },
    {
      field: "posts_label",
      type: "string",
      meta: { interface: "input", options: { placeholder: "Blog" }, width: "half" },
      schema: { default_value: "Blog", is_nullable: true },
    },
    {
      field: "photos_label",
      type: "string",
      meta: { interface: "input", options: { placeholder: "Photos" }, width: "half" },
      schema: { default_value: "Photos", is_nullable: true },
    },
  ],
};

const POSTS_SCHEMA = {
  collection: "posts",
  meta: {
    icon: "article",
    note: "Blog posts and long-form writing.",
    sort_field: "sort",
    preview_url: "http://localhost:3000/blog/{{slug}}",
  },
  schema: { name: "posts" },
  fields: [
    {
      field: "id",
      type: "integer",
      meta: { hidden: true, readonly: true, interface: "input" },
      schema: { is_primary_key: true, has_auto_increment: true },
    },
    {
      field: "status",
      type: "string",
      meta: {
        width: "half",
        interface: "select-dropdown",
        display: "labels",
        display_options: {
          choices: [
            { text: "Published", value: "published", foreground: "#FFFFFF", background: "#3C845C" },
            { text: "Draft", value: "draft", foreground: "#FFFFFF", background: "#A2B5CD" },
            { text: "Archived", value: "archived", foreground: "#FFFFFF", background: "#636363" },
          ],
        },
        options: { choices: STATUS_CHOICES },
      },
      schema: { default_value: "draft", is_nullable: false },
    },
    {
      field: "sort",
      type: "integer",
      meta: { hidden: true, interface: "input" },
      schema: { is_nullable: true },
    },
    {
      field: "date_created",
      type: "timestamp",
      meta: { special: ["date-created"], readonly: true, hidden: true, width: "half", interface: "datetime" },
      schema: { is_nullable: true },
    },
    {
      field: "date_updated",
      type: "timestamp",
      meta: { special: ["date-updated"], readonly: true, hidden: true, width: "half", interface: "datetime" },
      schema: { is_nullable: true },
    },
    {
      field: "slug",
      type: "string",
      meta: {
        interface: "input",
        width: "half",
        note: "URL-safe identifier. Used in /blog/[slug]",
        options: { slug: true, trim: true },
      },
      schema: { is_nullable: false, is_unique: true },
    },
    {
      field: "title",
      type: "string",
      meta: { interface: "input", width: "half", required: true },
      schema: { is_nullable: false },
    },
    {
      field: "excerpt",
      type: "text",
      meta: { interface: "input-multiline", note: "Short summary shown in listings." },
      schema: { is_nullable: true },
    },
    {
      field: "content",
      type: "text",
      meta: {
        interface: "input-rich-text-html",
        note: "Full content rendered on the post page.",
        options: { toolbar: ["bold","italic","underline","link","image","blockquote","code","heading","unordered-list","ordered-list"] },
      },
      schema: { is_nullable: true },
    },
    {
      field: "cover_image",
      type: "uuid",
      meta: {
        interface: "file-image",
        display: "image",
        special: ["file"],
        note: "Cover image shown at the top of the post.",
      },
      schema: {
        is_nullable: true,
        foreign_key_table: "directus_files",
        foreign_key_column: "id",
      },
    },
    {
      field: "published_at",
      type: "timestamp",
      meta: {
        interface: "datetime",
        width: "half",
        note: "When the post was / will be publicly visible.",
      },
      schema: { is_nullable: true },
    },
    {
      field: "featured",
      type: "boolean",
      meta: { interface: "boolean", width: "half" },
      schema: { default_value: false, is_nullable: false },
    },
    {
      field: "tags",
      type: "json",
      meta: {
        interface: "tags",
        display: "labels",
        note: "Comma-separated or tag-input style.",
      },
      schema: { is_nullable: true },
    },
  ],
};

const PHOTOS_SCHEMA = {
  collection: "photos",
  meta: {
    icon: "photo_camera",
    note: "Photo journal entries.",
    sort_field: "sort",
    preview_url: "http://localhost:3000/photos/{{slug}}",
  },
  schema: { name: "photos" },
  fields: [
    {
      field: "id",
      type: "integer",
      meta: { hidden: true, readonly: true, interface: "input" },
      schema: { is_primary_key: true, has_auto_increment: true },
    },
    {
      field: "status",
      type: "string",
      meta: {
        width: "half",
        interface: "select-dropdown",
        display: "labels",
        display_options: {
          choices: [
            { text: "Published", value: "published", foreground: "#FFFFFF", background: "#3C845C" },
            { text: "Draft", value: "draft", foreground: "#FFFFFF", background: "#A2B5CD" },
            { text: "Archived", value: "archived", foreground: "#FFFFFF", background: "#636363" },
          ],
        },
        options: { choices: STATUS_CHOICES },
      },
      schema: { default_value: "draft", is_nullable: false },
    },
    {
      field: "sort",
      type: "integer",
      meta: { hidden: true, interface: "input" },
      schema: { is_nullable: true },
    },
    {
      field: "date_created",
      type: "timestamp",
      meta: { special: ["date-created"], readonly: true, hidden: true, width: "half", interface: "datetime" },
      schema: { is_nullable: true },
    },
    {
      field: "date_updated",
      type: "timestamp",
      meta: { special: ["date-updated"], readonly: true, hidden: true, width: "half", interface: "datetime" },
      schema: { is_nullable: true },
    },
    {
      field: "slug",
      type: "string",
      meta: {
        interface: "input",
        width: "half",
        options: { slug: true, trim: true },
        note: "URL-safe identifier. Used in /photos/[slug]",
      },
      schema: { is_nullable: false, is_unique: true },
    },
    {
      field: "title",
      type: "string",
      meta: { interface: "input", width: "half", required: true },
      schema: { is_nullable: false },
    },
    {
      field: "description",
      type: "text",
      meta: { interface: "input-multiline" },
      schema: { is_nullable: true },
    },
    {
      field: "image",
      type: "uuid",
      meta: {
        interface: "file-image",
        display: "image",
        special: ["file"],
        note: "The main photo.",
      },
      schema: {
        is_nullable: true,
        foreign_key_table: "directus_files",
        foreign_key_column: "id",
      },
    },
    {
      field: "published_at",
      type: "timestamp",
      meta: { interface: "datetime", width: "half" },
      schema: { is_nullable: true },
    },
    {
      field: "taken_at",
      type: "timestamp",
      meta: { interface: "datetime", width: "half", note: "When the photo was taken." },
      schema: { is_nullable: true },
    },
    {
      field: "location",
      type: "string",
      meta: { interface: "input", width: "half", options: { placeholder: "City, Country" } },
      schema: { is_nullable: true },
    },
    {
      field: "camera",
      type: "string",
      meta: { interface: "input", width: "half", options: { placeholder: "Canon EOS R" } },
      schema: { is_nullable: true },
    },
    {
      field: "lens",
      type: "string",
      meta: { interface: "input", width: "half", options: { placeholder: "50mm f/1.4" } },
      schema: { is_nullable: true },
    },
    {
      field: "featured",
      type: "boolean",
      meta: { interface: "boolean", width: "half" },
      schema: { default_value: false, is_nullable: false },
    },
    {
      field: "tags",
      type: "json",
      meta: { interface: "tags", display: "labels" },
      schema: { is_nullable: true },
    },
  ],
};

// ── Seed data ─────────────────────────────────────────────────────────────────

const SITE_SETTINGS_SEED = {
  site_name: "veryCrunchy",
  site_tagline: "Fullstack developer, photo journal, and personal notes.",
  site_description:
    "Personal site for projects, photography, and long-form writing by veryCrunchy.",
  github_url: "https://github.com/verycrunchy",
  support_url: "https://ko-fi.com/verycrunchy",
  nav_cta_label: "Support",
  nav_cta_url: "https://ko-fi.com/verycrunchy",
  posts_label: "Blog",
  photos_label: "Photos",
};

const POSTS_SEED = [
  {
    status: "published",
    slug: "building-in-public",
    title: "Building in Public",
    excerpt:
      "Why I commit to shipping work before it feels ready, and what it's taught me about the gap between planning and building.",
    content: `<p>There's a version of every project that lives entirely in your head. It's clean, it's fast, every edge case is handled, and the UI is exactly how you imagined it. That version never ships.</p>
<p>Building in public forces you out of that loop. The moment someone else can see your work, it becomes real. Feedback arrives before you're ready for it — and that's the point.</p>
<h2>The cost of waiting</h2>
<p>Every week a project stays private is a week of missed reality checks. Users find problems your mental model never considered. A half-finished feature live on staging reveals more about what it should be than six more weeks of solo design work.</p>
<p>I've shipped things I wasn't proud of. I've also watched those same things get used in ways I never expected, and the gap between what I built and what people needed was far smaller than I thought.</p>
<h2>What it actually means</h2>
<p>Building in public isn't about self-promotion. It's about accountability, and about treating your own work seriously enough to let it be seen. The repo being open doesn't matter if no one knows it exists. The changelog being public doesn't matter if it reads like a commit log.</p>
<p>It means writing about decisions, not just shipping features. Why did this architecture change? What's the real reason the launch got pushed? Those posts are harder to write than announcements, and they're worth ten times as much.</p>`,
    published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    featured: true,
    tags: ["process", "open source", "building"],
  },
  {
    status: "published",
    slug: "nuxt-3-directus-11-setup",
    title: "Setting Up Nuxt 3 with Directus 11",
    excerpt:
      "A practical guide to wiring Nuxt 3's server routes to a Directus 11 CMS, including public read access and live preview.",
    content: `<p>Directus 11 brought a genuinely different permissions model. If you've worked with Directus 9 or 10, the new "Policies" concept takes some adjusting to — but the end result is a cleaner separation between what each role can do.</p>
<h2>The public access setup</h2>
<p>For a personal site, you want the deployed version to read from Directus without any authentication token. That means configuring the Public policy in Directus to allow read access on your content collections — posts, photos, and site settings.</p>
<p>In the Directus admin: <strong>Settings → Access Control → Public → add read permission</strong> for each collection. Filter published content only: <code>{ "status": { "_eq": "published" } }</code>.</p>
<h2>Nuxt server routes</h2>
<p>The cleanest architecture keeps all Directus calls on the Nuxt server side. Client-side components never talk to Directus directly — they call your own <code>/api/cms/*</code> routes. This gives you full control over caching, field selection, and normalization without leaking your CMS structure to the client.</p>
<pre><code>// server/api/cms/posts.get.ts
import { readDirectusPosts } from '~/server/utils/directus'

export default defineEventHandler(async (event) => {
  const posts = await readDirectusPosts(event)
  return { posts }
})</code></pre>
<h2>Live preview</h2>
<p>In each collection's settings, set the <code>preview_url</code> to your dev server: <code>http://localhost:3000/blog/{{slug}}</code>. Directus will show a preview button in the editor that opens the live page.</p>`,
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    featured: false,
    tags: ["nuxt", "directus", "tutorial", "typescript"],
  },
  {
    status: "published",
    slug: "go-is-underrated-for-web-tooling",
    title: "Go Is Underrated for Web Tooling",
    excerpt:
      "Most web developers reach for Node when they need a background service or CLI. They should reach for Go more often.",
    content: `<p>Go compiles to a single binary. No runtime, no dependency tree at deploy time, no missing <code>node_modules</code> in production. For background workers, cron jobs, webhooks, and CLIs, that matters more than you'd think.</p>
<h2>The Node habit</h2>
<p>Most fullstack developers are comfortable in JavaScript. So when they need a small API, a file watcher, or a cron that hits a database, they reach for Node. This works. It's also slower, uses more memory, and requires the runtime to be installed on every server it touches.</p>
<p>Go changes those constraints. A Go HTTP service that handles webhooks compiles to a ~8MB binary. It starts in milliseconds, handles thousands of concurrent requests without a load balancer, and ships to any platform without a Dockerfile layer that installs Node.</p>
<h2>What the switch costs</h2>
<p>Learning Go takes time. The error handling pattern is verbose. There's no npm ecosystem to lean on. And for UI-heavy work, the tradeoff isn't worth it.</p>
<p>But for the backend services behind a web app — the queue workers, the API handlers, the cron infrastructure — the cost of learning Go is paid back in the first month of running a production server with half the memory footprint.</p>`,
    published_at: new Date().toISOString(),
    featured: false,
    tags: ["go", "backend", "tooling"],
  },
];

const PHOTOS_SEED = [
  {
    status: "published",
    slug: "dawn-by-the-canal",
    title: "Dawn by the Canal",
    description:
      "Early morning light diffusing through the fog. Taken before the city woke up, when the water was still enough to reflect the cranes.",
    published_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    taken_at:     new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Amsterdam, NL",
    camera: "Canon EOS R",
    lens: "50mm f/1.4",
    featured: true,
    tags: ["urban", "water", "morning"],
  },
  {
    status: "published",
    slug: "market-faces",
    title: "Market Faces",
    description:
      "Seventy-something vendors setting up at first light. The kind of scene that's over before most people start their commute.",
    published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    taken_at:     new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Brussels, BE",
    camera: "Canon EOS R",
    lens: "35mm f/2",
    featured: false,
    tags: ["street", "people", "morning"],
  },
  {
    status: "published",
    slug: "brutalist-symmetry",
    title: "Brutalist Symmetry",
    description:
      "Found while looking for a coffee shop. The kind of building architects argue about and everyone else just walks past.",
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    taken_at:     new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Rotterdam, NL",
    camera: "Canon EOS R",
    lens: "28mm f/2.8",
    featured: false,
    tags: ["architecture", "brutalism", "geometry"],
  },
];

// ── Permissions helpers ───────────────────────────────────────────────────────

async function findPublicPolicy() {
  // In Directus 11, public / unauthenticated access is via a special "Public" built-in policy.
  // Strategy: query /policies and find the one named "Public"; fall back to roles if needed.

  const policiesRes = await api("GET", "/policies?limit=100");
  const policies = policiesRes?.data ?? [];

  // Primary: look for a policy literally named "Public"
  let pub = policies.find((p) => p.name?.toLowerCase() === "public");

  if (!pub) {
    // Sometimes named differently — find the one with no admin/app access and no IP restriction
    pub = policies.find((p) => !p.admin_access && !p.app_access && p.ip_access === null);
  }

  if (pub) {
    console.log(`  ✔  found public policy: "${pub.name}" (${pub.id})`);
    return pub.id;
  }

  // Directus 11 also has a legacy public role — fall back to checking roles
  const rolesRes = await api("GET", "/roles?limit=100");
  const roles = rolesRes?.data ?? [];
  const pubRole = roles.find((r) => r.name?.toLowerCase() === "public");

  if (pubRole?.policies?.length) {
    const policyId = typeof pubRole.policies[0] === "string"
      ? pubRole.policies[0]
      : pubRole.policies[0]?.id;
    console.log(`  ✔  found public role policy via roles: ${policyId}`);
    return policyId;
  }

  console.warn(
    "\n  ⚠️  Could not find the public policy automatically.\n" +
    "     Follow these steps in the Directus admin manually:\n" +
    "       1. Settings → Access Control → Public\n" +
    "       2. Add READ permission for: posts, photos, site_settings, directus_files\n" +
    "       3. For posts / photos: add filter { \"status\": { \"_eq\": \"published\" } }"
  );
  return null;
}

async function setPublicPermissions(policyId) {
  const readAll = [
    // site_settings — always readable (no row filter)
    { collection: "site_settings", filter: null },
    // directus_files — needed for asset serving
    { collection: "directus_files", filter: null },
  ];
  const readPublished = [
    { collection: "posts",  filter: { status: { _eq: "published" } } },
    { collection: "photos", filter: { status: { _eq: "published" } } },
  ];

  for (const { collection, filter } of [...readAll, ...readPublished]) {
    try {
      await api("POST", "/permissions", {
        policy: policyId,
        collection,
        action: "read",
        fields: "*",
        permissions: filter ?? {},
      });
      console.log(`  ✔  public read: ${collection}${filter ? " (published only)" : ""}`);
    } catch (e) {
      // Likely already exists — safe to continue
      console.log(`  ↳ permission for ${collection} may already exist, skipping`);
    }
  }
}

// ── Item seed helpers ─────────────────────────────────────────────────────────

async function seedItems(collection, items, keyField = "slug") {
  const existing = await api("GET", `/items/${collection}?fields=${keyField}&limit=100`);
  const existingKeys = new Set((existing?.data ?? []).map((r) => r[keyField]));

  let created = 0;
  for (const item of items) {
    if (existingKeys.has(item[keyField])) {
      console.log(`  ↳ ${collection}/${item[keyField]} already exists, skipping`);
      continue;
    }
    await api("POST", `/items/${collection}`, item);
    console.log(`  ✔  seeded: ${collection}/${item[keyField]}`);
    created++;
  }
  return created;
}

async function seedSiteSettings() {
  const existing = await api("GET", "/items/site_settings?limit=1");
  if ((existing?.data ?? []).length > 0) {
    console.log("  ↳ site_settings already has a row, skipping");
    return;
  }
  await api("POST", "/items/site_settings", SITE_SETTINGS_SEED);
  console.log("  ✔  seeded: site_settings");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱  Seeding Directus at ${BASE}\n`);

  // 1. Create collections
  console.log("📦  Collections");
  await createCollection(SITE_SETTINGS_SCHEMA);
  await createCollection(POSTS_SCHEMA);
  await createCollection(PHOTOS_SCHEMA);

  // 2. Seed data
  console.log("\n📝  Data");
  await seedSiteSettings();
  await seedItems("posts", POSTS_SEED);
  await seedItems("photos", PHOTOS_SEED);

  // 3. Public permissions
  console.log("\n🔓  Public access");
  const publicPolicyId = await findPublicPolicy();
  if (publicPolicyId) await setPublicPermissions(publicPolicyId);

  // 4. Update preview URLs with a hint
  console.log("\n👁️  Preview URLs (dev: localhost:3000)");
  console.log("     Already set in the collection schemas above.");
  console.log("     For production, update in Directus: Data Model → posts/photos → Preview URL");

  console.log("\n✅  Done. Your Directus is ready.\n");
  console.log(
    "   Next steps:\n" +
    "   • Run `pnpm dev` to start the Nuxt dev server\n" +
    "   • Open your Directus admin and go to Content → Posts to start writing\n" +
    "   • In Directus, set the Visual Editor URL to http://localhost:3000\n" +
    "     for live visual editing support\n"
  );
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e.message);
  process.exit(1);
});
