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
DIRECTUS_TOKEN=your_directus_static_token
```

`DIRECTUS_TOKEN` should be a read token with access to the public-facing collections below. If your Directus instance exposes these collections publicly, you can omit the token and the site will still render.

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

You can also add structured metadata and story placement:

- `locationMeta` for structured places
- `cameraMeta` and `lensMeta` for lookup-backed gear metadata
- `timelineEntries` for placing a photo inside one or more story timelines with optional `chapterTitle` and `storyText`
