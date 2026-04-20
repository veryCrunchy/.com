#!/usr/bin/env node
/**
 * Creates `chapters` and `chapter_items` collections in Directus,
 * then seeds them with the homepage content.
 */

const BASE = process.env.NUXT_PUBLIC_DIRECTUS_URL || 'https://deploy-d01ddea06b3a4e9f.my.obiente.cloud';
const TOKEN = process.env.DIRECTUS_TOKEN || 'zS_mJBjuw27yoZM39MnelHtv_XKb2gGR';
const h = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!r.ok) {
    // 400 with "already exists" is fine
    if (json?.errors?.[0]?.message?.includes('already exists')) return { ok: true, exists: true };
    console.error(`${method} ${path} → ${r.status}`, JSON.stringify(json).slice(0, 300));
  }
  return json;
}

// ── 1. Create collections ─────────────────────────────────────────
async function createCollections() {
  console.log('Creating chapters collection...');
  await api('POST', '/collections', {
    collection: 'chapters',
    meta: { sort_field: 'sort', icon: 'book', note: 'Homepage chapters' },
    schema: {},
    fields: [
      { field: 'sort', type: 'integer', schema: {}, meta: { interface: 'input', hidden: true } },
      { field: 'status', type: 'string', schema: { default_value: 'published' }, meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Published', value: 'published' }, { text: 'Draft', value: 'draft' }] }, width: 'half' } },
      { field: 'slug', type: 'string', schema: { is_unique: true }, meta: { interface: 'input', width: 'half' } },
      { field: 'chapter_num', type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } },
      { field: 'watermark', type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } },
      { field: 'title', type: 'string', schema: {}, meta: { interface: 'input' } },
      { field: 'chapter_label', type: 'string', schema: { is_nullable: true }, meta: { interface: 'input', width: 'half', note: 'e.g. "Founder & CEO"' } },
      { field: 'title_href', type: 'string', schema: { is_nullable: true }, meta: { interface: 'input', width: 'half' } },
      { field: 'tagline', type: 'text', schema: { is_nullable: true }, meta: { interface: 'input-multiline' } },
      { field: 'description', type: 'text', schema: { is_nullable: true }, meta: { interface: 'input-multiline' } },
      { field: 'theme', type: 'string', schema: { default_value: 'white' }, meta: { interface: 'select-dropdown', options: { choices: ['white','green','pink','purple','blue','dark','darker','ob'].map(v=>({text:v,value:v})) }, width: 'half' } },
      { field: 'card_theme', type: 'string', schema: { default_value: 'dark' }, meta: { interface: 'select-dropdown', options: { choices: ['dark','darker','ob'].map(v=>({text:v,value:v})) }, width: 'half', note: 'Default theme for cards inside this chapter' } },
      { field: 'marquee_items', type: 'json', schema: { is_nullable: true }, meta: { interface: 'input-code', options: { language: 'json' }, note: 'Array of strings, e.g. ["TypeScript","Vue 3"]' } },
      { field: 'footer_links', type: 'json', schema: { is_nullable: true }, meta: { interface: 'input-code', options: { language: 'json' }, note: 'Array of {href, label, dim?}' } },
    ],
  });

  console.log('Creating chapter_items collection...');
  await api('POST', '/collections', {
    collection: 'chapter_items',
    meta: { sort_field: 'sort', icon: 'list', note: 'Content rows within each chapter' },
    schema: {},
    fields: [
      { field: 'sort', type: 'integer', schema: {}, meta: { interface: 'input', hidden: true } },
      { field: 'chapter', type: 'integer', schema: { is_nullable: false }, meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'type', type: 'string', schema: {}, meta: { interface: 'select-dropdown', options: { choices: ['sub_section','project','para_card','component'].map(v=>({text:v,value:v})) } } },
      { field: 'sub_section_num', type: 'string', schema: { is_nullable: true }, meta: { interface: 'input', width: 'half', note: 'e.g. "1.1"' } },
      { field: 'sub_section_title', type: 'string', schema: { is_nullable: true }, meta: { interface: 'input', width: 'half' } },
      { field: 'sub_section_lead', type: 'text', schema: { is_nullable: true }, meta: { interface: 'input-multiline' } },
      { field: 'project', type: 'integer', schema: { is_nullable: true }, meta: { interface: 'select-dropdown-m2o', special: ['m2o'], note: 'Reference to projects.id' } },
      { field: 'para_card_text', type: 'text', schema: { is_nullable: true }, meta: { interface: 'input-multiline' } },
      { field: 'component', type: 'string', schema: { is_nullable: true }, meta: { interface: 'select-dropdown', options: { choices: ['SponsorsList','DonationOptions'].map(v=>({text:v,value:v})) }, note: 'Static Vue component to embed' } },
    ],
  });

  // Create the M2O relation from chapter_items.chapter -> chapters.id
  console.log('Creating relation chapter_items.chapter -> chapters...');
  await api('POST', '/relations', {
    collection: 'chapter_items',
    field: 'chapter',
    related_collection: 'chapters',
    schema: { on_delete: 'CASCADE' },
    meta: { one_field: 'items', sort_field: 'sort' },
  });

  // Create the M2O relation from chapter_items.project -> projects.id
  console.log('Creating relation chapter_items.project -> projects...');
  await api('POST', '/relations', {
    collection: 'chapter_items',
    field: 'project',
    related_collection: 'projects',
    schema: { on_delete: 'SET NULL' },
    meta: {},
  });
}

// ── 2. Seed chapters ──────────────────────────────────────────────
const CHAPTERS = [
  {
    sort: 1, slug: 'work', status: 'published',
    chapter_num: '01', watermark: 'WORK',
    title: 'Personal Projects', chapter_label: null, title_href: null,
    tagline: "things I built because I wanted them to exist",
    description: "Side projects, tools, experiments. No team, no budget. Just things I wanted to exist and decided to make myself.",
    theme: 'white', card_theme: 'dark',
    marquee_items: ['verycrunchy.com', 'Photo Portfolio', 'TypeScript', 'Vue · Nuxt · Go', 'Self-Taught', 'Obiente', 'Open Source'],
    footer_links: null,
  },
  {
    sort: 2, slug: 'obiente', status: 'published',
    chapter_num: '02', watermark: 'OBIENTE',
    title: 'Obiente', chapter_label: 'Founder & CEO', title_href: 'https://obiente.com',
    tagline: "software that's actually free to use",
    description: "Open source software. Everything AGPL-3.0, self-hostable, built to give you full control over your data. Not a startup, not trying to exit.",
    theme: 'green', card_theme: 'ob',
    marquee_items: ['Open Source', 'AGPL-3.0', 'Self-Hostable', 'Go', 'Vue 3', 'Rust', 'Not for Profit'],
    footer_links: [
      { href: 'https://github.com/Obiente', label: 'View all Obiente projects on GitHub →' },
      { href: 'https://obiente.com', label: 'obiente.com ↗', dim: true },
    ],
  },
  {
    sort: 3, slug: 'visual', status: 'published',
    chapter_num: '03', watermark: 'VISUALS',
    title: 'Photography', chapter_label: null, title_href: null,
    tagline: "I got my first camera not long ago and immediately became obsessed",
    description: "It gives me a reason to go outside. Real places, real light. Shot on Fujifilm X-T5.",
    theme: 'pink', card_theme: 'darker',
    marquee_items: ['Fujifilm X-T5', 'XF 16-80mm', 'Netherlands', 'Behind the Shot', 'Film + Digital', 'DxO PhotoLab', '2024 onwards'],
    footer_links: null,
  },
  {
    sort: 4, slug: 'music', status: 'published',
    chapter_num: '04', watermark: 'MUSIC',
    title: 'Listening', chapter_label: 'stats.fm', title_href: null,
    tagline: "always something playing",
    description: "What's been playing while I build. Tracked by actual listening time, not stream count.",
    theme: 'purple', card_theme: 'dark',
    marquee_items: ['stats.fm', 'Weighted Scoring', '250+ Artists Tracked', 'Always Listening', 'Stream History', 'Custom Algorithm', 'Listening Time'],
    footer_links: [{ href: '/stats.fm/verycrunchy', label: 'See my full stats →' }],
  },
  {
    sort: 5, slug: 'about', status: 'published',
    chapter_num: '05', watermark: 'ABOUT',
    title: 'About Me', chapter_label: null, title_href: null,
    tagline: "18, Netherlands, self-taught",
    description: null,
    theme: 'white', card_theme: 'dark',
    marquee_items: null,
    footer_links: null,
  },
  {
    sort: 6, slug: 'supporters', status: 'published',
    chapter_num: '06', watermark: 'THANKS',
    title: 'Supporters', chapter_label: null, title_href: null,
    tagline: "people keeping this going",
    description: "Everything I build is free and open source. No ads. People who support directly are what make that possible.",
    theme: 'blue', card_theme: 'dark',
    marquee_items: null,
    footer_links: null,
  },
];

// ── 3. Seed chapter_items ─────────────────────────────────────────
// chapter slugs -> id map is built after inserting chapters
// Items: [chapter_slug, sort, type, {extra fields}]
const ITEMS_TEMPLATE = [
  // Ch 01: Work
  ['work',  1,  'sub_section', { sub_section_num: '1.1', sub_section_title: 'This Site',     sub_section_lead: "The site you're on. I keep rebuilding it." }],
  ['work',  2,  'project',     { project: 3 }],
  ['work',  3,  'para_card',   { para_card_text: "The cursor runs on a custom spring physics engine. Snap points, morphing border-radius, velocity dampening. Written from scratch with GSAP ticker loops and raw pointer events. I am perhaps not normal about this." }],
  ['work',  4,  'sub_section', { sub_section_num: '1.2', sub_section_title: 'In Progress',   sub_section_lead: "What I'm building right now. Subject to change." }],
  ['work',  5,  'project',     { project: 4 }],

  // Ch 02: Obiente
  ['obiente', 1, 'sub_section', { sub_section_num: '2.1', sub_section_title: 'Infrastructure', sub_section_lead: "Deployment tooling for your own infrastructure." }],
  ['obiente', 2, 'project',     { project: 5 }],
  ['obiente', 3, 'sub_section', { sub_section_num: '2.2', sub_section_title: 'Monitoring',     sub_section_lead: "Uptime monitoring. Own your data." }],
  ['obiente', 4, 'project',     { project: 6 }],

  // Ch 03: Visual
  ['visual', 1, 'sub_section', { sub_section_num: '3.1', sub_section_title: 'The Journal', sub_section_lead: "Every shoot documented. Location, context, what I was going for." }],
  ['visual', 2, 'project',     { project: 8 }],
  ['visual', 3, 'sub_section', { sub_section_num: '3.2', sub_section_title: 'Process',     sub_section_lead: "The gear. Nothing special." }],
  ['visual', 4, 'project',     { project: 9 }],

  // Ch 04: Music
  ['music', 1, 'sub_section', { sub_section_num: '4.1', sub_section_title: 'What I listen to', sub_section_lead: "Genre and rotation. What's been in the background." }],
  ['music', 2, 'project',     { project: 11 }],
  ['music', 3, 'para_card',   { para_card_text: "Algorithms know what you played. This knows what you actually heard. They're different things." }],

  // Ch 05: About
  ['about', 1, 'sub_section', { sub_section_num: '5.1', sub_section_title: 'Background', sub_section_lead: "The short version." }],
  ['about', 2, 'project',     { project: 12 }],  // Bio card — will create project 12
  ['about', 3, 'para_card',   { para_card_text: "No degree, no bootcamp. Years of reading docs, breaking things, and figuring out how they work. That's all." }],
  ['about', 4, 'sub_section', { sub_section_num: '5.2', sub_section_title: 'Stack',      sub_section_lead: "What I use." }],
  ['about', 5, 'project',     { project: 13 }],  // Stack card — will create project 13
  ['about', 6, 'sub_section', { sub_section_num: '5.3', sub_section_title: 'Find Me',    sub_section_lead: "Where to find me." }],
  ['about', 7, 'project',     { project: 14 }],  // Links card — will create project 14

  // Ch 06: Supporters
  ['supporters', 1, 'sub_section', { sub_section_num: '6.1', sub_section_title: 'Current Supporters', sub_section_lead: "People who have supported this." }],
  ['supporters', 2, 'component',   { component: 'SponsorsList' }],
  ['supporters', 3, 'sub_section', { sub_section_num: '6.2', sub_section_title: 'Back This Work',     sub_section_lead: "If any of this was useful to you." }],
  ['supporters', 4, 'component',   { component: 'DonationOptions' }],
];

// About-section projects that are static widgets, not real portfolio projects
// We create them with status='published' but they'll only show within the About chapter
const ABOUT_PROJECTS = [
  {
    id: 12, chapter: 'about', title: 'Background', eyebrow: 'Who I Am', wide: true,
    description: null,  // rendered via slot in template using site_settings.bio
    tags: [], status: 'published', sort: 12,
  },
  {
    id: 13, chapter: 'about', title: 'What I Build With', eyebrow: 'Languages & Frameworks', wide: true,
    description: null,
    tags: [
      { label: 'TypeScript', variant: 'blue' },
      { label: 'Vue 3', variant: 'blue' },
      { label: 'Nuxt 3', variant: 'blue' },
      { label: 'Node.js', variant: 'blue' },
      { label: 'Go' },
      { label: 'Tailwind CSS' },
      { label: 'GSAP' },
      { label: 'Docker' },
      { label: 'PostgreSQL' },
      { label: 'Redis' },
    ],
    status: 'published', sort: 13,
  },
  {
    id: 14, chapter: 'about', title: 'Online', eyebrow: 'Links', wide: false,
    description: null,
    tags: [],
    link_href: null, status: 'published', sort: 14,
  },
];

async function run() {
  // Create collections first
  await createCollections();

  // Seed about projects 12-14 (used as card stubs)
  console.log('Seeding about-section project stubs...');
  for (const proj of ABOUT_PROJECTS) {
    const existing = await api('GET', `/items/projects/${proj.id}`);
    if (existing?.data?.id) {
      console.log(`  project ${proj.id} already exists, skipping`);
      continue;
    }
    await api('POST', '/items/projects', proj);
    console.log(`  created project ${proj.id}`);
  }

  // Seed chapters
  console.log('Seeding chapters...');
  const chaptersRes = await api('POST', '/items/chapters', CHAPTERS);
  if (!chaptersRes?.data) {
    console.error('Failed to seed chapters:', chaptersRes);
    return;
  }

  // Build slug -> id map
  const slugToId = {};
  for (const ch of chaptersRes.data) {
    slugToId[ch.slug] = ch.id;
  }
  console.log('Chapter IDs:', slugToId);

  // Seed chapter_items
  console.log('Seeding chapter_items...');
  const items = ITEMS_TEMPLATE.map(([slug, sort, type, extra]) => ({
    chapter: slugToId[slug],
    sort,
    type,
    ...extra,
  }));

  const itemsRes = await api('POST', '/items/chapter_items', items);
  if (!itemsRes?.data) {
    console.error('Failed to seed chapter_items:', itemsRes);
    return;
  }
  console.log(`Created ${itemsRes.data.length} chapter_items`);

  // Update site_settings.bio if not set
  console.log('Checking bio in site_settings...');
  const siteRes = await api('GET', '/items/site_settings/1?fields=bio');
  if (!siteRes?.data?.bio) {
    await api('PATCH', '/items/site_settings/1', {
      bio: "I'm 18, from the Netherlands. I stopped going to school because of depression and spent most of those years at my computer, teaching myself to code. No plan, just curiosity and a lot of time.\n\nRecently I got my first camera and it kind of changed things. Photography gives me a concrete reason to go outside when everything in my brain says not to. I make music too. Everything self-taught.\n\nThis site is the intersection of all of that. Code, photos, music, whatever I'm building.",
    });
    console.log('Updated bio in site_settings');
  } else {
    console.log('bio already set, skipping');
  }

  console.log('\nDone!');
}

run().catch(console.error);
