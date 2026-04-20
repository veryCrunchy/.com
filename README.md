# veryCrunchy Site

Nuxt 3 frontend with a Directus-powered content layer for:

- site settings
- blog posts
- photo archive

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

Create a `.env` file with the Directus connection details:

```bash
NUXT_PUBLIC_DIRECTUS_URL=https://your-directus-instance.example.com
NUXT_PUBLIC_SITE_URL_DISPLAY=https://verycrunchy.com
DIRECTUS_TOKEN=your_directus_static_token
```

`DIRECTUS_TOKEN` is server-only. For the public site it can be omitted if your published collections are readable through Directus policies, but it is still required for local schema scripts and any write-backed features such as street-photo delivery intake.

`NUXT_PUBLIC_SITE_URL_DISPLAY` is optional. If set, the street-delivery studio uses that URL on printed cards and copied gallery links instead of the current browser origin, which is useful when generating production-ready cards from `localhost`.

## Directus Collections

The site expects these collections:

### `site_settings`

Use a single item with these fields:

- `site_name` string
- `site_tagline` text
- `site_description` text
- `github_url` string
- `support_url` string
- `nav_cta_label` string
- `nav_cta_url` string
- `posts_label` string
- `photos_label` string

### `posts`

- `status` string
- `slug` string
- `title` string
- `excerpt` text
- `content` text or rich text HTML
- `cover_image` file
- `published_at` datetime
- `featured` boolean
- `tags` JSON string array

### `photos`

- `status` string
- `slug` string
- `title` string
- `description` text
- `image` file
- `published_at` datetime
- `taken_at` datetime
- `location` string
- `camera` string
- `lens` string
- `featured` boolean
- `tags` JSON string array

Only items with `status = published` are exposed on the public site.

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm run dev
```

## Production

Build the application for production:

```bash
pnpm run build
```

Locally preview production build:

```bash
pnpm run preview
```

## Agent Photo Ingest

There is a reusable photo ingest CLI for agent-driven uploads:

```bash
pnpm run photos:prepare -- --manifest /tmp/photo-manifest.json /absolute/path/to/photo-1.jpg /absolute/path/to/photo-2.jpg
pnpm run photos:validate -- --manifest /tmp/photo-manifest.json
pnpm run photos:upload -- --manifest /tmp/photo-manifest.json
```

Optional Directus schema helpers:

```bash
pnpm run photos:setup-motion
pnpm run photos:setup-shots
pnpm run photos:setup-taxonomies
pnpm run photos:setup-timelines
```

The intended workflow is:

1. Run `photos:prepare` with exported image paths or `--paths-file`.
2. Let the agent inspect the images and ask a couple of concise questions about the journey, story, and grouping.
3. Fill in each photo's `title`, `description`, `slug`, and `setSlugs` in the generated manifest.
4. Optionally add `sets` definitions for custom photoset titles and descriptions.
5. Run `photos:validate`, then `photos:upload`.

The manifest includes EXIF-derived metadata, suggested auto-set candidates, and a `storyContext` section the agent can use while writing titles and descriptions.

TIFF uploads are converted to JPEG automatically before being sent to Directus.

If an edited export is missing GPS or place fields, the ingest CLI will also look for matching original raw and XMP sidecar files under `PHOTO_INGEST_ORIGINAL_ROOTS` (defaults to `/mnt/h/DCIM`) and merge that metadata into the manifest and converted upload.

If GPS exists but no readable place name does, `photos:prepare` will reverse geocode the coordinates through Nominatim and cache the result locally. You can override this with `PHOTO_INGEST_REVERSE_GEOCODE_URL`, `PHOTO_INGEST_REVERSE_GEOCODE_CACHE`, `PHOTO_INGEST_REVERSE_GEOCODE_USER_AGENT`, or disable it with `PHOTO_INGEST_REVERSE_GEOCODE=0`.

If a photo should behave like a motion sequence, add `motionFrameSourcePaths` to that photo entry in the manifest. Those files will also be converted to JPEG when needed and linked as motion frames before the final hero image.

If a photo needs attached still variants under the same slug, add a `shots` array to that photo entry. Each shot can include `sourcePath`, `role`, `title`, and `description`. This is intended for alternates, details, and nearby frames that belong to one published photo without turning into a full set.

You can also add structured metadata and story placement:

- `locationMeta` for structured places
- `cameraMeta` and `lensMeta` for lookup-backed gear metadata
- `timelineEntries` for placing a photo inside one or more story timelines with optional `chapterTitle` and `storyText`

## Street Delivery

The portfolio now includes a Directus-backed street photo handoff flow:

- public request page at `/p/[code]`
- legacy redirect from `/s/[code]`
- delivery gallery at `/g/[token]`
- Directus collections for sessions, contacts, and assigned photos

Set up the schema:

```bash
pnpm street:setup
```

Generate card codes directly into Directus:

```bash
pnpm street:codes -- --count 100
pnpm street:codes -- --count 25 --prefix AMS --dry-run
```

Directus collections created by `street:setup`:

- `street_delivery_sessions`
- `street_delivery_contacts`
- `street_delivery_session_photos`

Suggested workflow:

1. Run `pnpm street:setup`.
2. Generate a batch of codes with `pnpm street:codes`.
3. Or sign into `/studio/street-delivery` with your Directus account to create, print, and manage batches in-browser.
4. Print cards that point to `https://your-site.example.com/p/CODE`.
5. Add `location` and `photographed_at` later, once the actual shoot details are known.
6. When someone submits the form, their contact lands in `street_delivery_contacts`.
7. In Directus or the studio dashboard, assign matched images through the `photos` field on the session.
8. Mark the session delivered when the gallery is ready, then share `/g/{token}` manually.

The studio also tracks a code lifecycle through `distribution_state` (`available`, `printed`, `sent`), so you can avoid reusing a code that has already been printed or sent directly, requeue eligible codes for reprint, and delete only still-available unused codes. Per-photo public sharing consent is stored on `street_delivery_session_photos.consent_publish`, with the first form acting as the default and the gallery allowing subjects to review each photo individually.

For messaging, the studio can also copy per-session outreach and delivery text with the correct link already inserted. Edit these in Directus under `site_settings`:

- `street_delivery_request_message_template` with `[form link]`
- `street_delivery_ready_message_template` with `[gallery link]`

This feature intentionally does not create public Directus permissions for contact data. The public intake routes use your server-side `DIRECTUS_TOKEN` for privacy-safe reads and writes, while `/studio/street-delivery` uses real Directus user auth.
