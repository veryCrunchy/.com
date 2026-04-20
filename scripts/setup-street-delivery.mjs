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

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
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

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
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

async function getRelation(collection, field) {
  const result = await api("GET", `/relations/${collection}/${field}`);
  return result.ok ? result.data?.data : null;
}

const SESSION_STATUS_CHOICES = [
  { text: "New", value: "new" },
  { text: "Matched", value: "matched" },
  { text: "Delivered", value: "delivered" },
  { text: "Archived", value: "archived" },
];

const CONTACT_METHOD_CHOICES = [
  { text: "Email", value: "email" },
  { text: "Instagram", value: "instagram" },
  { text: "Phone", value: "phone" },
];

const DISTRIBUTION_STATE_CHOICES = [
  { text: "Available", value: "available" },
  { text: "Printed", value: "printed" },
  { text: "Sent", value: "sent" },
];

const STREET_DELIVERY_REQUEST_TEMPLATE_DEFAULT = `Hi! I photographed you recently and I’m sorting the photos now.
When you get a chance, could you fill in this short form? [form link]
It helps me make sure I match the right photos to the right person, and it lets you note your preference for public sharing.
Once they’re ready, I’ll send you a private link where you can view and download everything in full quality.

Hoi! Ik heb je onlangs gefotografeerd en ik ben de foto’s nu aan het uitzoeken.
Als je even tijd hebt, zou je dit korte formulier kunnen invullen? [form link]
Het helpt me om zeker te weten dat ik de juiste foto’s aan de juiste persoon koppel, en je kunt daar ook je voorkeur voor openbare publicatie aangeven.
Zodra ze klaar zijn, stuur ik je een privelink waarmee je alles in volledige kwaliteit kunt bekijken en downloaden.`;

const STREET_DELIVERY_READY_TEMPLATE_DEFAULT = `Hi! Your photos are ready. Here’s your private gallery link where you can view and download everything in full quality: [gallery link]

Hoi! Je foto’s zijn klaar. Hier is je private gallery link waarmee je alles in volledige kwaliteit kunt bekijken en downloaden: [gallery link]`;

if (await collectionExists("street_delivery_sessions")) {
  console.log("  –  street_delivery_sessions collection already exists");
} else {
  const result = await api("POST", "/collections", {
    collection: "street_delivery_sessions",
    meta: {
      icon: "qr_code_2",
      note: "Card-based delivery sessions for street portrait handoff.",
      display_template: "{{code}}",
      preview_url: "http://localhost:3000/p/{{code}}",
      sort_field: "sort",
    },
    schema: {},
    fields: [
      {
        field: "id",
        type: "integer",
        meta: { hidden: true, readonly: true },
        schema: { is_primary_key: true, has_auto_increment: true },
      },
      {
        field: "sort",
        type: "integer",
        meta: { hidden: true },
        schema: { is_nullable: true },
      },
      {
        field: "status",
        type: "string",
        meta: {
          interface: "select-dropdown",
          display: "labels",
          width: "half",
          options: { choices: SESSION_STATUS_CHOICES },
        },
        schema: { default_value: "new", is_nullable: false },
      },
      {
        field: "code",
        type: "string",
        meta: {
          interface: "input",
          width: "half",
          note: "Printed on the physical card and used at /p/[code].",
        },
        schema: { is_nullable: false, is_unique: true, max_length: 32 },
      },
      {
        field: "date_created",
        type: "timestamp",
        meta: { special: ["date-created"], readonly: true, hidden: true },
        schema: { is_nullable: true },
      },
      {
        field: "date_updated",
        type: "timestamp",
        meta: { special: ["date-updated"], readonly: true, hidden: true },
        schema: { is_nullable: true },
      },
      {
        field: "distribution_state",
        type: "string",
        meta: {
          interface: "select-dropdown",
          display: "labels",
          width: "half",
          note: "Whether this code is still available, already printed on a card, or sent directly.",
          options: { choices: DISTRIBUTION_STATE_CHOICES },
        },
        schema: { default_value: "available", is_nullable: false, max_length: 32 },
      },
      {
        field: "printed_at",
        type: "timestamp",
        meta: {
          interface: "datetime",
          width: "half",
          note: "When this card code was physically printed.",
        },
        schema: { is_nullable: true },
      },
      {
        field: "photographed_at",
        type: "timestamp",
        meta: { interface: "datetime", width: "half" },
        schema: { is_nullable: true },
      },
      {
        field: "location",
        type: "string",
        meta: { interface: "input", width: "half" },
        schema: { is_nullable: true, max_length: 255 },
      },
      {
        field: "public_enabled",
        type: "boolean",
        meta: {
          interface: "boolean",
          width: "half",
          note: "Turn this off to disable the public card page and gallery.",
        },
        schema: { default_value: true, is_nullable: false },
      },
      {
        field: "gallery_token",
        type: "string",
        meta: {
          interface: "input",
          width: "half",
          note: "Optional share token for /g/[token]. Leave blank until ready to deliver.",
        },
        schema: { is_nullable: true, is_unique: true, max_length: 128 },
      },
      {
        field: "last_submission_at",
        type: "timestamp",
        meta: { interface: "datetime", width: "half", readonly: true },
        schema: { is_nullable: true },
      },
      {
        field: "delivered_at",
        type: "timestamp",
        meta: { interface: "datetime", width: "half" },
        schema: { is_nullable: true },
      },
      {
        field: "notes",
        type: "text",
        meta: {
          interface: "input-multiline",
          width: "full",
          note: "Marker shot notes, wardrobe hints, or anything useful during matching.",
        },
        schema: { is_nullable: true },
      },
    ],
  });

  if (result.ok) {
    console.log("  ✔  created collection: street_delivery_sessions");
  } else {
    console.error("  ❌  street_delivery_sessions:", JSON.stringify(result.data));
    process.exit(1);
  }
}

if (await fieldExists("street_delivery_sessions", "printed_at")) {
  console.log("  –  street_delivery_sessions.printed_at field already exists");
} else {
  const result = await api("POST", "/fields/street_delivery_sessions", {
    field: "printed_at",
    type: "timestamp",
    meta: {
      interface: "datetime",
      width: "half",
      note: "When this card code was physically printed.",
    },
    schema: { is_nullable: true },
  });

  if (result.ok) console.log("  ✔  field: street_delivery_sessions.printed_at");
  else console.warn("  ⚠   printed_at field:", JSON.stringify(result.data));
}

if (await fieldExists("street_delivery_sessions", "distribution_state")) {
  console.log("  –  street_delivery_sessions.distribution_state field already exists");
} else {
  const result = await api("POST", "/fields/street_delivery_sessions", {
    field: "distribution_state",
    type: "string",
    meta: {
      interface: "select-dropdown",
      display: "labels",
      width: "half",
      note: "Whether this code is still available, already printed on a card, or sent directly.",
      options: { choices: DISTRIBUTION_STATE_CHOICES },
    },
    schema: { default_value: "available", is_nullable: false, max_length: 32 },
  });

  if (result.ok) console.log("  ✔  field: street_delivery_sessions.distribution_state");
  else console.warn("  ⚠   distribution_state field:", JSON.stringify(result.data));
}

if (await fieldExists("site_settings", "street_delivery_request_message_template")) {
  console.log("  –  site_settings.street_delivery_request_message_template field already exists");
} else {
  const result = await api("POST", "/fields/site_settings", {
    field: "street_delivery_request_message_template",
    type: "text",
    meta: {
      interface: "input-multiline",
      width: "full",
      note: "Template for the outreach message. Use [form link] where the session URL should appear.",
    },
    schema: {
      is_nullable: true,
      default_value: STREET_DELIVERY_REQUEST_TEMPLATE_DEFAULT,
    },
  });

  if (result.ok) console.log("  ✔  field: site_settings.street_delivery_request_message_template");
  else console.warn("  ⚠   request message template field:", JSON.stringify(result.data));
}

if (await fieldExists("site_settings", "street_delivery_ready_message_template")) {
  console.log("  –  site_settings.street_delivery_ready_message_template field already exists");
} else {
  const result = await api("POST", "/fields/site_settings", {
    field: "street_delivery_ready_message_template",
    type: "text",
    meta: {
      interface: "input-multiline",
      width: "full",
      note: "Template for the ready/gallery message. Use [gallery link] where the gallery URL should appear.",
    },
    schema: {
      is_nullable: true,
      default_value: STREET_DELIVERY_READY_TEMPLATE_DEFAULT,
    },
  });

  if (result.ok) console.log("  ✔  field: site_settings.street_delivery_ready_message_template");
  else console.warn("  ⚠   ready message template field:", JSON.stringify(result.data));
}

if (await collectionExists("street_delivery_contacts")) {
  console.log("  –  street_delivery_contacts collection already exists");
} else {
  const result = await api("POST", "/collections", {
    collection: "street_delivery_contacts",
    meta: {
      hidden: true,
      icon: "contact_mail",
      note: "Public contact submissions attached to a delivery session.",
      sort_field: "sort",
    },
    schema: {},
    fields: [
      {
        field: "id",
        type: "integer",
        meta: { hidden: true, readonly: true },
        schema: { is_primary_key: true, has_auto_increment: true },
      },
      {
        field: "street_delivery_sessions_id",
        type: "integer",
        meta: { hidden: true },
        schema: {},
      },
      {
        field: "sort",
        type: "integer",
        meta: { hidden: true },
        schema: { is_nullable: true },
      },
      {
        field: "date_created",
        type: "timestamp",
        meta: { special: ["date-created"], readonly: true, hidden: true },
        schema: { is_nullable: true },
      },
      {
        field: "method",
        type: "string",
        meta: {
          interface: "select-dropdown",
          width: "half",
          options: { choices: CONTACT_METHOD_CHOICES },
        },
        schema: { is_nullable: false, max_length: 32 },
      },
      {
        field: "value",
        type: "string",
        meta: { interface: "input", width: "half" },
        schema: { is_nullable: false, max_length: 255 },
      },
      {
        field: "first_name",
        type: "string",
        meta: { interface: "input", width: "half" },
        schema: { is_nullable: true, max_length: 80 },
      },
      {
        field: "selfie",
        type: "uuid",
        meta: {
          interface: "file-image",
          special: ["file"],
          width: "half",
          note: "Optional selfie reference uploaded by the subject.",
        },
        schema: { is_nullable: true },
      },
      {
        field: "consent_send",
        type: "boolean",
        meta: { interface: "boolean", width: "half" },
        schema: { default_value: true, is_nullable: false },
      },
      {
        field: "consent_publish",
        type: "boolean",
        meta: { interface: "boolean", width: "half" },
        schema: { default_value: false, is_nullable: false },
      },
      {
        field: "description",
        type: "text",
        meta: { interface: "input-multiline", width: "full" },
        schema: { is_nullable: true },
      },
    ],
  });

  if (result.ok) {
    console.log("  ✔  created collection: street_delivery_contacts");
  } else {
    console.error("  ❌  street_delivery_contacts:", JSON.stringify(result.data));
    process.exit(1);
  }
}

if (await collectionExists("street_delivery_session_photos")) {
  console.log("  –  street_delivery_session_photos junction already exists");
} else {
  const result = await api("POST", "/collections", {
    collection: "street_delivery_session_photos",
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
        field: "street_delivery_sessions_id",
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

  if (result.ok) {
    console.log("  ✔  created junction: street_delivery_session_photos");
  } else {
    console.error("  ❌  street_delivery_session_photos:", JSON.stringify(result.data));
    process.exit(1);
  }
}

const contactsRelation = await getRelation("street_delivery_contacts", "street_delivery_sessions_id");

if (!contactsRelation) {
  const result = await api("POST", "/relations", {
    collection: "street_delivery_contacts",
    field: "street_delivery_sessions_id",
    related_collection: "street_delivery_sessions",
    meta: {
      one_field: "contacts",
      sort_field: "sort",
    },
  });

  if (result.ok) console.log("  ✔  relation: street_delivery_contacts.street_delivery_sessions_id → street_delivery_sessions");
  else console.warn("  ⚠   contacts relation:", JSON.stringify(result.data));
} else if (
  contactsRelation.meta?.one_field !== "contacts" ||
  contactsRelation.meta?.sort_field !== "sort"
) {
  const result = await api("PATCH", "/relations/street_delivery_contacts/street_delivery_sessions_id", {
    meta: {
      one_field: "contacts",
      sort_field: "sort",
      junction_field: null,
    },
  });

  if (result.ok) console.log("  ✔  repaired relation: street_delivery_contacts.street_delivery_sessions_id");
  else console.warn("  ⚠   repair contacts relation:", JSON.stringify(result.data));
} else {
  console.log("  –  relation street_delivery_contacts.street_delivery_sessions_id already exists");
}

const selfieRelation = await getRelation("street_delivery_contacts", "selfie");

if (!selfieRelation) {
  const result = await api("POST", "/relations", {
    collection: "street_delivery_contacts",
    field: "selfie",
    related_collection: "directus_files",
  });

  if (result.ok) console.log("  ✔  relation: street_delivery_contacts.selfie → directus_files");
  else console.warn("  ⚠   selfie relation:", JSON.stringify(result.data));
} else {
  console.log("  –  relation street_delivery_contacts.selfie already exists");
}

const sessionPhotosRelation = await getRelation("street_delivery_session_photos", "street_delivery_sessions_id");

if (!sessionPhotosRelation) {
  const result = await api("POST", "/relations", {
    collection: "street_delivery_session_photos",
    field: "street_delivery_sessions_id",
    related_collection: "street_delivery_sessions",
    meta: {
      one_field: "photos",
      sort_field: "sort",
    },
  });

  if (result.ok) console.log("  ✔  relation: street_delivery_session_photos.street_delivery_sessions_id → street_delivery_sessions");
  else console.warn("  ⚠   session photos relation:", JSON.stringify(result.data));
} else if (
  sessionPhotosRelation.meta?.one_field !== "photos" ||
  sessionPhotosRelation.meta?.sort_field !== "sort"
) {
  const result = await api("PATCH", "/relations/street_delivery_session_photos/street_delivery_sessions_id", {
    meta: {
      one_field: "photos",
      sort_field: "sort",
      junction_field: null,
    },
  });

  if (result.ok) console.log("  ✔  repaired relation: street_delivery_session_photos.street_delivery_sessions_id");
  else console.warn("  ⚠   repair session photos relation:", JSON.stringify(result.data));
} else {
  console.log("  –  relation street_delivery_session_photos.street_delivery_sessions_id already exists");
}

const photosRelation = await getRelation("street_delivery_session_photos", "photos_id");

if (!photosRelation) {
  const result = await api("POST", "/relations", {
    collection: "street_delivery_session_photos",
    field: "photos_id",
    related_collection: "photos",
    meta: {
      junction_field: "street_delivery_sessions_id",
    },
  });

  if (result.ok) console.log("  ✔  relation: street_delivery_session_photos.photos_id → photos");
  else console.warn("  ⚠   photos relation:", JSON.stringify(result.data));
} else if (
  photosRelation.meta?.junction_field !== "street_delivery_sessions_id" ||
  photosRelation.meta?.one_field !== null
) {
  const result = await api("PATCH", "/relations/street_delivery_session_photos/photos_id", {
    meta: {
      one_field: null,
      junction_field: "street_delivery_sessions_id",
      sort_field: null,
    },
  });

  if (result.ok) console.log("  ✔  repaired relation: street_delivery_session_photos.photos_id");
  else console.warn("  ⚠   repair photos relation:", JSON.stringify(result.data));
} else {
  console.log("  –  relation street_delivery_session_photos.photos_id already exists");
}

if (await fieldExists("street_delivery_sessions", "contacts")) {
  console.log("  –  street_delivery_sessions.contacts field already exists");
} else {
  const result = await api("POST", "/fields/street_delivery_sessions", {
    field: "contacts",
    type: "alias",
    meta: {
      interface: "list-o2m",
      special: ["o2m"],
      options: {
        template: "{{method}} · {{value}}",
        enableCreate: true,
      },
      display: "related-values",
      display_options: { template: "{{method}} · {{value}}" },
      width: "full",
    },
    schema: null,
  });

  if (result.ok) console.log("  ✔  field: street_delivery_sessions.contacts (O2M)");
  else console.warn("  ⚠   contacts field:", JSON.stringify(result.data));
}

if (await fieldExists("street_delivery_sessions", "photos")) {
  console.log("  –  street_delivery_sessions.photos field already exists");
} else {
  const result = await api("POST", "/fields/street_delivery_sessions", {
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

  if (result.ok) console.log("  ✔  field: street_delivery_sessions.photos (M2M)");
  else console.warn("  ⚠   photos field:", JSON.stringify(result.data));
}

console.log("\n✅  Street delivery schema ready.\n");
console.log("   No public Directus permissions were added.");
console.log("   The portfolio routes use your server-side DIRECTUS_TOKEN for privacy-safe lookups and submissions.\n");
