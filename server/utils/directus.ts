import { createDirectus, readItems, rest, staticToken } from "@directus/sdk";
import type { H3Event } from "h3";

import type {
  CmsAsset,
  CmsPhoto,
  CmsPhotoset,
  CmsPhotosetSummary,
  CmsPhotoSummary,
  CmsPost,
  CmsPostSummary,
  CmsSiteSettings,
  DirectusAsset,
  DirectusPhoto,
  DirectusPhotosetPhoto,
  DirectusPhotoset,
  DirectusPost,
  DirectusSchema,
  DirectusSiteSettings,
} from "~/types/directus";
import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";

const SITE_SETTINGS_FIELDS = [
  "id",
  "site_name",
  "site_tagline",
  "site_description",
  "github_url",
  "support_url",
  "nav_cta_label",
  "nav_cta_url",
  "posts_label",
  "photos_label",
];

const POST_FIELDS = [
  "id",
  "status",
  "slug",
  "title",
  "excerpt",
  "content",
  "published_at",
  "featured",
  "tags",
  {
    cover_image: ["id", "title", "description", "width", "height", "filename_download"],
  },
] as const;

const PHOTO_FIELDS = [
  "id",
  "status",
  "slug",
  "title",
  "description",
  "published_at",
  "taken_at",
  "location",
  "camera",
  "lens",
  "featured",
  "tags",
  {
    image: ["id", "title", "description", "width", "height", "filename_download"],
  },
] as const;

const PHOTOSET_BASE_FIELDS = [
  "id",
  "status",
  "slug",
  "title",
  "description",
  "published_at",
  "tags",
  {
    cover_image: ["id", "title", "description", "width", "height", "filename_download"],
  },
] as const;

const PHOTOSET_PHOTO_FIELDS = [
  "id",
  "photosets_id",
  "sort",
  {
    photos_id: [
      "id",
      "slug",
      "title",
      "description",
      "published_at",
      "taken_at",
      "location",
      "camera",
      "lens",
      "tags",
      {
        image: ["id", "title", "description", "width", "height", "filename_download"],
      },
    ],
  },
] as const;

export function getDirectusClient(event?: H3Event) {
  const config = useRuntimeConfig(event);
  const directusUrl = config.public.directusUrl;

  if (!directusUrl) {
    return null;
  }

  let client = createDirectus<DirectusSchema>(directusUrl).with(rest());

  if (config.directusToken) {
    client = client.with(staticToken(config.directusToken));
  }

  return client;
}

export function getDirectusUrl(event?: H3Event) {
  return useRuntimeConfig(event).public.directusUrl || "";
}

export function buildDirectusAssetUrl(
  event: H3Event | undefined,
  asset: string | DirectusAsset | null | undefined,
  params?: Record<string, string | number | null | undefined>
) {
  const assetId = typeof asset === "string" ? asset : asset?.id;
  const directusUrl = getDirectusUrl(event);

  if (!assetId || !directusUrl) {
    return null;
  }

  const query = new URLSearchParams();

  const mergedParams = {
    format: "auto",
    withoutEnlargement: "true",
    ...(params || {}),
  };

  for (const [key, value] of Object.entries(mergedParams)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }

  const qs = query.toString();

  return `${directusUrl}/assets/${assetId}${qs ? `?${qs}` : ""}`;
}

function normalizeAsset(
  event: H3Event | undefined,
  asset: string | DirectusAsset | null | undefined,
  params?: Record<string, string | number | null | undefined>,
  previewParams?: Record<string, string | number | null | undefined>
): CmsAsset | null {
  const directusAsset = typeof asset === "string" ? null : asset;
  const id = typeof asset === "string" ? asset : asset?.id;
  const url = buildDirectusAssetUrl(event, asset, params);
  const previewUrl = buildDirectusAssetUrl(event, asset, previewParams || params);

  if (!id || !url) {
    return null;
  }

  return {
    id,
    alt: directusAsset?.description || directusAsset?.title || null,
    width: directusAsset?.width ?? null,
    height: directusAsset?.height ?? null,
    downloadFilename: directusAsset?.filename_download ?? null,
    url,
    previewUrl,
  };
}

export function normalizeSiteSettings(
  settings?: DirectusSiteSettings | null
): CmsSiteSettings {
  return {
    siteName: settings?.site_name || DEFAULT_CMS_SITE_SETTINGS.siteName,
    siteTagline: settings?.site_tagline || DEFAULT_CMS_SITE_SETTINGS.siteTagline,
    siteDescription:
      settings?.site_description || DEFAULT_CMS_SITE_SETTINGS.siteDescription,
    githubUrl: settings?.github_url || DEFAULT_CMS_SITE_SETTINGS.githubUrl,
    supportUrl: settings?.support_url || DEFAULT_CMS_SITE_SETTINGS.supportUrl,
    navCtaLabel: settings?.nav_cta_label || DEFAULT_CMS_SITE_SETTINGS.navCtaLabel,
    navCtaUrl: settings?.nav_cta_url || DEFAULT_CMS_SITE_SETTINGS.navCtaUrl,
    postsLabel: settings?.posts_label || DEFAULT_CMS_SITE_SETTINGS.postsLabel,
    photosLabel: settings?.photos_label || DEFAULT_CMS_SITE_SETTINGS.photosLabel,
  };
}

export function normalizePostSummary(
  event: H3Event | undefined,
  post: DirectusPost
): CmsPostSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt || null,
    publishedAt: post.published_at || null,
    tags: post.tags || [],
    coverImage: normalizeAsset(event, post.cover_image, {
      width: 1600,
      quality: 80,
    }, {
      width: 960,
      height: 540,
      quality: 74,
      fit: "cover",
    }),
  };
}

export function normalizePost(
  event: H3Event | undefined,
  post: DirectusPost
): CmsPost {
  return {
    ...normalizePostSummary(event, post),
    content: post.content || null,
  };
}

export function normalizePhotoSummary(
  event: H3Event | undefined,
  photo: DirectusPhoto
): CmsPhotoSummary {
  return {
    id: photo.id,
    slug: photo.slug,
    title: photo.title,
    description: photo.description || null,
    publishedAt: photo.published_at || null,
    takenAt: photo.taken_at || null,
    location: photo.location || null,
    camera: photo.camera || null,
    lens: photo.lens || null,
    tags: photo.tags || [],
    image: normalizeAsset(event, photo.image, {
      width: 2200,
      quality: 82,
    }, {
      width: 960,
      height: 960,
      quality: 74,
      fit: "cover",
    }),
  };
}

export function normalizePhoto(
  event: H3Event | undefined,
  photo: DirectusPhoto
): CmsPhoto {
  return normalizePhotoSummary(event, photo);
}

export async function readDirectusSiteSettings(event?: H3Event) {
  const client = getDirectusClient(event);

  if (!client) {
    return DEFAULT_CMS_SITE_SETTINGS;
  }

  try {
    const [settings] = (await client.request(
      readItems("site_settings", {
        limit: 1,
        fields: SITE_SETTINGS_FIELDS as never,
      })
    )) as DirectusSiteSettings[];

    return normalizeSiteSettings(settings || null);
  } catch {
    return DEFAULT_CMS_SITE_SETTINGS;
  }
}

export async function readDirectusPosts(
  event: H3Event | undefined,
  options?: {
    limit?: number;
    featured?: boolean;
  }
) {
  const client = getDirectusClient(event);

  if (!client) {
    return [];
  }

  try {
    const posts = (await client.request(
      readItems("posts", {
        fields: POST_FIELDS as never,
        filter: {
          status: {
            _eq: "published",
          },
          ...(options?.featured ? { featured: { _eq: true } } : {}),
        },
        sort: ["-featured", "-published_at", "-date_created"] as never,
        limit: options?.limit ?? -1,
      })
    )) as DirectusPost[];

    return posts.map((post) => normalizePostSummary(event, post));
  } catch {
    return [];
  }
}

export async function readDirectusPostBySlug(
  event: H3Event | undefined,
  slug: string
) {
  const client = getDirectusClient(event);

  if (!client) {
    return null;
  }

  try {
    const [post] = (await client.request(
      readItems("posts", {
        fields: POST_FIELDS as never,
        filter: {
          status: {
            _eq: "published",
          },
          slug: {
            _eq: slug,
          },
        },
        limit: 1,
      })
    )) as DirectusPost[];

    return post ? normalizePost(event, post) : null;
  } catch {
    return null;
  }
}

export async function readDirectusPhotos(
  event: H3Event | undefined,
  options?: {
    limit?: number;
    featured?: boolean;
  }
) {
  const client = getDirectusClient(event);

  if (!client) {
    return [];
  }

  try {
    const photos = (await client.request(
      readItems("photos", {
        fields: PHOTO_FIELDS as never,
        filter: {
          status: {
            _eq: "published",
          },
          ...(options?.featured ? { featured: { _eq: true } } : {}),
        },
        sort: ["-featured", "-taken_at", "-published_at", "-date_created"] as never,
        limit: options?.limit ?? -1,
      })
    )) as DirectusPhoto[];

    return photos.map((photo) => normalizePhotoSummary(event, photo));
  } catch {
    return [];
  }
}

export async function readDirectusPhotoBySlug(
  event: H3Event | undefined,
  slug: string
) {
  const client = getDirectusClient(event);

  if (!client) {
    return null;
  }

  try {
    const [photo] = (await client.request(
      readItems("photos", {
        fields: PHOTO_FIELDS as never,
        filter: {
          status: {
            _eq: "published",
          },
          slug: {
            _eq: slug,
          },
        },
        limit: 1,
      })
    )) as DirectusPhoto[];

    return photo ? normalizePhoto(event, photo) : null;
  } catch {
    return null;
  }
}

export function normalizePhotosetSummary(
  event: H3Event | undefined,
  photoset: DirectusPhotoset
): CmsPhotosetSummary {
  const photos = (photoset.photos ?? [])
    .filter((p) => p.photos_id && typeof p.photos_id === "object")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  return {
    id: photoset.id,
    slug: photoset.slug,
    title: photoset.title,
    description: photoset.description || null,
    publishedAt: photoset.published_at || null,
    tags: photoset.tags || [],
    coverImage: normalizeAsset(event, photoset.cover_image, {
      width: 1800,
      quality: 80,
    }, {
      width: 960,
      height: 540,
      quality: 74,
      fit: "cover",
    }),
    photoCount: photos.length,
  };
}

export function normalizePhotoset(
  event: H3Event | undefined,
  photoset: DirectusPhotoset
): CmsPhotoset {
  const photos = (photoset.photos ?? [])
    .filter((p) => p.photos_id && typeof p.photos_id === "object")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((p) => normalizePhotoSummary(event, p.photos_id as DirectusPhoto));

  return {
    ...normalizePhotosetSummary(event, photoset),
    photos,
  };
}

async function attachPhotosToPhotosets(
  client: NonNullable<ReturnType<typeof getDirectusClient>>,
  photosets: DirectusPhotoset[]
) {
  if (!photosets.length) {
    return photosets;
  }

  const photosetIds = photosets.map((photoset) => photoset.id);
  const links = (await client.request(
    readItems("photosets_photos", {
      fields: PHOTOSET_PHOTO_FIELDS as never,
      filter: {
        photosets_id: {
          _in: photosetIds,
        },
      },
      sort: ["sort", "id"],
      limit: -1,
    })
  )) as DirectusPhotosetPhoto[];

  const groupedLinks = new Map<number, DirectusPhotosetPhoto[]>();

  for (const link of links) {
    const group = groupedLinks.get(link.photosets_id) ?? [];
    group.push(link);
    groupedLinks.set(link.photosets_id, group);
  }

  return photosets.map((photoset) => ({
    ...photoset,
    photos: groupedLinks.get(photoset.id) ?? [],
  }));
}

export async function readDirectusPhotosets(
  event: H3Event | undefined,
  options?: { limit?: number }
) {
  const client = getDirectusClient(event);
  if (!client) return [];

  try {
    const photosets = (await client.request(
      readItems("photosets", {
        fields: PHOTOSET_BASE_FIELDS as never,
        filter: { status: { _eq: "published" } },
        sort: ["-published_at"] as never,
        limit: options?.limit ?? -1,
      })
    )) as DirectusPhotoset[];

    const photosetsWithPhotos = await attachPhotosToPhotosets(
      client,
      photosets
    );

    return photosetsWithPhotos.map((ps) => normalizePhotosetSummary(event, ps));
  } catch {
    return [];
  }
}

export async function readDirectusPhotosetBySlug(
  event: H3Event | undefined,
  slug: string
) {
  const client = getDirectusClient(event);
  if (!client) return null;

  try {
    const [photoset] = (await client.request(
      readItems("photosets", {
        fields: PHOTOSET_BASE_FIELDS as never,
        filter: {
          status: { _eq: "published" },
          slug: { _eq: slug },
        },
        limit: 1,
      })
    )) as DirectusPhotoset[];

    if (!photoset) {
      return null;
    }

    const [photosetWithPhotos] = await attachPhotosToPhotosets(client, [photoset]);

    return photosetWithPhotos ? normalizePhotoset(event, photosetWithPhotos) : null;
  } catch {
    return null;
  }
}

