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
