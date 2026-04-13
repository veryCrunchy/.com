#!/usr/bin/env node
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
if (!BASE || !TOKEN) { console.error("❌  Missing env vars"); process.exit(1); }

async function uploadFile(filePath, filename, title, description) {
  const bytes = readFileSync(filePath);
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const form = new FormData();
  form.append("title", title);
  form.append("description", description);
  form.append("file", blob, filename);
  const res = await fetch(`${BASE}/files`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  const { data } = await res.json();
  console.log(`  ✔  uploaded: ${filename} → ${data.id}`);
  return data.id;
}

async function createPhoto(payload) {
  const res = await fetch(`${BASE}/items/photos`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Create failed (${res.status}): ${await res.text()}`);
  const { data } = await res.json();
  console.log(`  ✔  created: "${payload.title}" (${data.id})`);
}

async function main() {
  console.log("\nUploading 4 photos…\n");

  const id1 = await uploadFile("/tmp/DSCF4503.jpg", "DSCF4503.jpg", "Approach", "A greylag goose walking straight toward the camera under dappled tree shadow.");
  await createPhoto({ status:"published", title:"Approach", slug:"approach", description:"The same goose from earlier, this time closer — neck stretched forward, mid-stride, framed by the root base of the tree behind it. The dappled light splits across its chest. Compressed to 54mm, which gave just enough reach without backing away.", tags:["goose","animal","park","spring","nature","portrait"], image:id1, camera:"Fujifilm X-T5", lens:"XF 16-80mm f/4 R OIS WR", focal_length:"54.5mm", aperture:"f/8", shutter_speed:"1/4000s", iso:4000, taken_at:"2026-04-10T15:17:07", published_at:"2026-04-10T15:17:07" });

  const id2 = await uploadFile("/tmp/DSCF4906.jpg", "DSCF4906.jpg", "Dandelion", "A goldendoodle puppy on a pavement looking directly at the camera beside a trampled dandelion.");
  await createPhoto({ status:"published", title:"Dandelion", slug:"dandelion", description:"A goldendoodle puppy halted on the pavement, ears flopped, staring directly into the lens. There's a crushed dandelion at its feet that it was clearly just investigating. Shot at 60mm in soft overcast light — the texture of that coat at f/4.5 is hard to beat.", tags:["dog","puppy","animal","street","nature","portrait"], image:id2, camera:"Fujifilm X-T5", lens:"XF 16-80mm f/4 R OIS WR", focal_length:"60.7mm", aperture:"f/4.5", shutter_speed:"1/500s", iso:200, taken_at:"2026-04-10T15:28:25", published_at:"2026-04-10T15:28:25" });

  const id3 = await uploadFile("/tmp/DSCF4735.jpg", "DSCF4735.jpg", "Oxidised", "Abstract close-up of rusted industrial cylinders in amber and teal.");
  await createPhoto({ status:"published", title:"Oxidised", slug:"oxidised", description:"Tightly cropped into the surface of what look like stacked industrial drums — paint peeled back to rust, the whole thing lit in late-afternoon amber. At 80mm and f/4 the curves almost abstract into brushstrokes. The patina alone is worth the full-res.", tags:["abstract","industrial","rust","texture","macro","colour"], image:id3, camera:"Fujifilm X-T5", lens:"XF 16-80mm f/4 R OIS WR", focal_length:"80mm", aperture:"f/4", shutter_speed:"1/4000s", iso:3200, taken_at:"2026-04-10T15:24:24", published_at:"2026-04-10T15:24:24" });

  const id4 = await uploadFile("/tmp/DSCF4752.jpg", "DSCF4752.jpg", "Resident", "A wooden insect hotel mounted on a tree trunk, bokeh treeline behind it.");
  await createPhoto({ status:"published", title:"Resident", slug:"resident", description:"A handmade insect hotel screwed to a tree trunk — wire mesh front packed with bark and twigs, soft green bokeh behind. Shot at 72mm, the background fully separates from the rough bark texture. Quietly one of my favourite frames from the day.", tags:["nature","insects","park","bokeh","spring","detail"], image:id4, camera:"Fujifilm X-T5", lens:"XF 16-80mm f/4 R OIS WR", focal_length:"72mm", aperture:"f/5.6", shutter_speed:"1/2000s", iso:6400, taken_at:"2026-04-10T15:25:01", published_at:"2026-04-10T15:25:01" });

  console.log("\n✅  Done.\n");
}

main().catch((e) => { console.error("❌ ", e.message); process.exit(1); });
