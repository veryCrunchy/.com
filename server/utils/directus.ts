import { createDirectus, readItems, rest, staticToken } from "@directus/sdk";
import type { H3Event } from "h3";

import type {
  CmsAsset,
  CmsCameraMeta,
  CmsChapter,
  CmsChapterItem,
  CmsLensMeta,
  CmsLocationMeta,
  CmsMotionFrame,
  CmsPhoto,
  CmsPhotoShot,
  CmsPhotoset,
  CmsPhotosetSummary,
  CmsPhotoSummary,
  CmsPost,
  CmsPostSummary,
  CmsSiteSettings,
  CmsProject,
  CmsSetRef,
  CmsTimeline,
  CmsTimelineEntry,
  CmsTimelineRef,
  CmsTimelineSummary,
  DirectusCameraBody,
  DirectusAsset,
  DirectusChapter,
  DirectusChapterItem,
  DirectusLens,
  DirectusLocation,
  DirectusPhoto,
  DirectusPhotoMotionFrame,
  DirectusPhotoShot,
  DirectusTimeline,
  DirectusTimelinePhoto,
  DirectusPhotosetPhoto,
  DirectusPhotoset,
  DirectusPost,
  DirectusProject,
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
  "hero_tagline",
  "hero_description",
  "availability_label",
  "availability_active",
  "primary_cta_label",
  "primary_cta_url",
  "secondary_cta_label",
  "secondary_cta_url",
  "bio",
  "street_delivery_request_message_template",
  "street_delivery_ready_message_template",
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
    location_ref: [
      "id",
      "slug",
      "title",
      "city",
      "region",
      "country",
      "latitude",
      "longitude",
      "description",
    ],
  },
  {
    camera_ref: ["id", "slug", "brand", "model", "label"],
  },
  {
    lens_ref: ["id", "slug", "brand", "model", "label", "mount", "focal_range", "max_aperture"],
  },
  {
    image: ["id", "title", "description", "width", "height", "filename_download"],
  },
  {
    motion_frames: [
      "id",
      "photos_id",
      "sort",
      {
        frame_file: ["id", "title", "description", "width", "height", "filename_download"],
      },
    ],
  },
  {
    shots: [
      "id",
      "photos_id",
      "sort",
      "role",
      "title",
      "description",
      {
        shot_file: ["id", "title", "description", "width", "height", "filename_download"],
      },
    ],
  },
] as const;

const PHOTO_DETAIL_FIELDS = [
  ...PHOTO_FIELDS,
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
        location_ref: [
          "id",
          "slug",
          "title",
          "city",
          "region",
          "country",
          "latitude",
          "longitude",
          "description",
        ],
      },
      {
        camera_ref: ["id", "slug", "brand", "model", "label"],
      },
      {
        lens_ref: ["id", "slug", "brand", "model", "label", "mount", "focal_range", "max_aperture"],
      },
      {
        image: ["id", "title", "description", "width", "height", "filename_download"],
      },
      {
        motion_frames: [
          "id",
          "photos_id",
          "sort",
          {
            frame_file: ["id", "title", "description", "width", "height", "filename_download"],
          },
        ],
      },
      {
        shots: [
          "id",
          "photos_id",
          "sort",
          "role",
          "title",
          "description",
          {
            shot_file: ["id", "title", "description", "width", "height", "filename_download"],
          },
        ],
      },
      {
        shots: [
          "id",
          "photos_id",
          "sort",
          "role",
          "title",
          "description",
          {
            shot_file: ["id", "title", "description", "width", "height", "filename_download"],
          },
        ],
      },
    ],
  },
] as const;

const PHOTO_SET_LINK_FIELDS = [
  { photosets_id: ["id", "slug", "title", "status"] },
] as const;

const TIMELINE_BASE_FIELDS = [
  "id",
  "status",
  "slug",
  "title",
  "description",
  "story",
  "published_at",
  "tags",
  {
    cover_image: ["id", "title", "description", "width", "height", "filename_download"],
  },
] as const;

const TIMELINE_ENTRY_FIELDS = [
  "id",
  "timelines_id",
  "sort",
  "chapter_title",
  "story_text",
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
      "featured",
      "tags",
      {
        location_ref: [
          "id",
          "slug",
          "title",
          "city",
          "region",
          "country",
          "latitude",
          "longitude",
          "description",
        ],
      },
      {
        camera_ref: ["id", "slug", "brand", "model", "label"],
      },
      {
        lens_ref: ["id", "slug", "brand", "model", "label", "mount", "focal_range", "max_aperture"],
      },
      {
        image: ["id", "title", "description", "width", "height", "filename_download"],
      },
      {
        motion_frames: [
          "id",
          "photos_id",
          "sort",
          {
            frame_file: ["id", "title", "description", "width", "height", "filename_download"],
          },
        ],
      },
    ],
  },
] as const;

const TIMELINE_LINK_FIELDS = [
  { timelines_id: ["id", "slug", "title", "status"] },
] as const;

const PROJECT_FIELDS = [
  "id",
  "status",
  "sort",
  "chapter",
  "eyebrow",
  "title",
  "description",
  "tags",
  "link_href",
  "link_label",
  "link_target",
  "link_variant",
  "accent_color",
  "wide",
  "footer_label",
  "footer_live",
  "status_label",
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

function buildDirectusOriginalAssetUrl(
  event: H3Event | undefined,
  asset: string | DirectusAsset | null | undefined
) {
  const assetId = typeof asset === "string" ? asset : asset?.id;
  const directusUrl = getDirectusUrl(event);

  if (!assetId || !directusUrl) {
    return null;
  }

  return `${directusUrl}/assets/${assetId}`;
}

function buildDirectusSrcset(
  event: H3Event | undefined,
  asset: string | DirectusAsset | null | undefined,
  widths: number[],
  baseParams?: Record<string, string | number | null | undefined>
): string | null {
  const assetId = typeof asset === "string" ? asset : asset?.id;
  if (!assetId) return null;

  const assetWidth = typeof asset === "object" ? asset?.width ?? null : null;
  const baseWidth = Number(baseParams?.width);
  const baseHeight = Number(baseParams?.height);
  const responsiveWidths = Array.from(new Set(
    widths
      .map((width) => {
        if (!Number.isFinite(width) || width <= 0) return null;
        return assetWidth && assetWidth > 0 ? Math.min(width, assetWidth) : width;
      })
      .filter((width): width is number => Boolean(width))
  ));

  const parts = responsiveWidths
    .map((w) => {
      const params = { ...baseParams, width: w } as Record<string, string | number | null | undefined>;

      if (Number.isFinite(baseWidth) && baseWidth > 0 && Number.isFinite(baseHeight) && baseHeight > 0) {
        params.height = Math.max(1, Math.round((baseHeight / baseWidth) * w));
      }

      const url = buildDirectusAssetUrl(event, asset, params);
      return url ? `${url} ${w}w` : null;
    })
    .filter(Boolean) as string[];

  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizeAsset(
  event: H3Event | undefined,
  asset: string | DirectusAsset | null | undefined,
  params?: Record<string, string | number | null | undefined>,
  previewParams?: Record<string, string | number | null | undefined>,
  srcsetWidths?: number[]
): CmsAsset | null {
  const directusAsset = typeof asset === "string" ? null : asset;
  const id = typeof asset === "string" ? asset : asset?.id;
  const url = buildDirectusAssetUrl(event, asset, params);
  const fallbackUrl = buildDirectusOriginalAssetUrl(event, asset);
  const previewUrl = buildDirectusAssetUrl(event, asset, previewParams || params);

  if (!id || !url) {
    return null;
  }

  const srcset = srcsetWidths
    ? buildDirectusSrcset(event, asset, srcsetWidths, {
        ...params,
        format: "auto",
        withoutEnlargement: "true",
      })
    : null;
  const previewSrcset = srcsetWidths
    ? buildDirectusSrcset(event, asset, srcsetWidths, {
        ...(previewParams || params),
        format: "auto",
        withoutEnlargement: "true",
      })
    : null;

  return {
    id,
    alt: directusAsset?.description || directusAsset?.title || null,
    width: directusAsset?.width ?? null,
    height: directusAsset?.height ?? null,
    downloadFilename: directusAsset?.filename_download ?? null,
    url,
    fallbackUrl,
    previewUrl,
    srcset,
    previewSrcset,
  };
}

function normalizeLocationMeta(
  location?: DirectusLocation | number | null
): CmsLocationMeta | null {
  if (!location || typeof location !== "object") {
    return null;
  }

  return {
    id: location.id,
    slug: location.slug,
    title: location.title,
    city: location.city || null,
    region: location.region || null,
    country: location.country || null,
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    description: location.description || null,
  };
}

function normalizeCameraMeta(
  camera?: DirectusCameraBody | number | null
): CmsCameraMeta | null {
  if (!camera || typeof camera !== "object") {
    return null;
  }

  return {
    id: camera.id,
    slug: camera.slug,
    brand: camera.brand || null,
    model: camera.model,
    label: camera.label || null,
  };
}

function normalizeLensMeta(
  lens?: DirectusLens | number | null
): CmsLensMeta | null {
  if (!lens || typeof lens !== "object") {
    return null;
  }

  return {
    id: lens.id,
    slug: lens.slug,
    brand: lens.brand || null,
    model: lens.model,
    label: lens.label || null,
    mount: lens.mount || null,
    focalRange: lens.focal_range || null,
    maxAperture: lens.max_aperture || null,
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
    heroTagline: settings?.hero_tagline || DEFAULT_CMS_SITE_SETTINGS.heroTagline,
    heroDescription: settings?.hero_description || DEFAULT_CMS_SITE_SETTINGS.heroDescription,
    availabilityLabel: settings?.availability_label || DEFAULT_CMS_SITE_SETTINGS.availabilityLabel,
    availabilityActive: settings?.availability_active ?? DEFAULT_CMS_SITE_SETTINGS.availabilityActive,
    primaryCtaLabel: settings?.primary_cta_label || DEFAULT_CMS_SITE_SETTINGS.primaryCtaLabel,
    primaryCtaUrl: settings?.primary_cta_url || DEFAULT_CMS_SITE_SETTINGS.primaryCtaUrl,
    secondaryCtaLabel: settings?.secondary_cta_label || DEFAULT_CMS_SITE_SETTINGS.secondaryCtaLabel,
    secondaryCtaUrl: settings?.secondary_cta_url || DEFAULT_CMS_SITE_SETTINGS.secondaryCtaUrl,
    bio: settings?.bio || DEFAULT_CMS_SITE_SETTINGS.bio,
    streetDeliveryRequestMessageTemplate:
      settings?.street_delivery_request_message_template
      || DEFAULT_CMS_SITE_SETTINGS.streetDeliveryRequestMessageTemplate,
    streetDeliveryReadyMessageTemplate:
      settings?.street_delivery_ready_message_template
      || DEFAULT_CMS_SITE_SETTINGS.streetDeliveryReadyMessageTemplate,
  };
}

export function normalizeProject(project: DirectusProject): CmsProject {
  return {
    id: project.id,
    chapter: project.chapter || "work",
    eyebrow: project.eyebrow || null,
    title: project.title,
    description: project.description || null,
    tags: project.tags || [],
    linkHref: project.link_href || null,
    linkLabel: project.link_label || null,
    linkTarget: project.link_target || null,
    linkVariant: project.link_variant || null,
    accentColor: project.accent_color || null,
    wide: project.wide ?? false,
    footerLabel: project.footer_label || null,
    footerLive: project.footer_live ?? false,
    statusLabel: project.status_label || null,
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
    }, [480, 800, 1200, 1600]),
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
  const motionFrameCount =
    typeof photo.motion_frame_count === "number"
      ? photo.motion_frame_count
      : Array.isArray(photo.motion_frames)
        ? photo.motion_frames.filter(
            (frame) => frame.frame_file && typeof frame.frame_file === "object"
          ).length
        : 0;

  const shotCount =
    typeof photo.shot_count === "number"
      ? photo.shot_count
      : Array.isArray(photo.shots)
        ? photo.shots.filter(
            (shot) => shot.shot_file && typeof shot.shot_file === "object"
          ).length
        : 0;

  return {
    id: photo.id,
    slug: photo.slug,
    title: photo.title,
    description: photo.description || null,
    publishedAt: photo.published_at || null,
    takenAt: photo.taken_at || null,
    location: (typeof photo.location_ref === "object" ? photo.location_ref?.title : null) || photo.location || null,
    camera: (typeof photo.camera_ref === "object" ? photo.camera_ref?.label || photo.camera_ref?.model : null) || photo.camera || null,
    lens: (typeof photo.lens_ref === "object" ? photo.lens_ref?.label || photo.lens_ref?.model : null) || photo.lens || null,
    locationMeta: normalizeLocationMeta(photo.location_ref),
    cameraMeta: normalizeCameraMeta(photo.camera_ref),
    lensMeta: normalizeLensMeta(photo.lens_ref),
    tags: photo.tags || [],
    hasMotion: motionFrameCount > 0,
    motionFrameCount,
    motionFrames: normalizeMotionFrames(event, photo.motion_frames),
    shotCount,
    shots: normalizePhotoShots(event, photo.shots),
    image: normalizeAsset(event, photo.image, {
      width: 2200,
      quality: 82,
    }, {
      width: 960,
      height: 960,
      quality: 74,
      fit: "cover",
    }, [640, 960, 1400, 2200]),
  };
}

export function normalizeMotionFrames(
  event: H3Event | undefined,
  motionFrames?: DirectusPhotoMotionFrame[] | null
): CmsMotionFrame[] {
  return (motionFrames ?? [])
    .filter((frame) => frame.frame_file && typeof frame.frame_file === "object")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((frame) => ({
      id: frame.id,
      sort: frame.sort ?? null,
      image: normalizeAsset(event, frame.frame_file as DirectusAsset, {
        width: 1400,
        quality: 80,
      }, {
        width: 720,
        quality: 72,
      }),
    }));
}

export function normalizePhotoShots(
  event: H3Event | undefined,
  shots?: DirectusPhotoShot[] | null
): CmsPhotoShot[] {
  return (shots ?? [])
    .filter((shot) => shot.shot_file && typeof shot.shot_file === "object")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((shot) => ({
      id: shot.id,
      sort: shot.sort ?? null,
      role: shot.role || null,
      title: shot.title || null,
      description: shot.description || null,
      image: normalizeAsset(event, shot.shot_file as DirectusAsset, {
        width: 2200,
        quality: 82,
      }, {
        width: 1600,
        quality: 76,
      }, [640, 960, 1400, 2200]),
    }));
}

export function normalizePhoto(
  event: H3Event | undefined,
  photo: DirectusPhoto,
  sets: CmsSetRef[] = [],
  timelines: CmsTimelineRef[] = []
): CmsPhoto {
  const summary = normalizePhotoSummary(event, photo);

  return {
    ...summary,
    sets,
    timelines,
    motionFrames: summary.motionFrames,
  };
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
    includeSets?: boolean;
    order?: "asc" | "desc";
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
        sort: (
          options?.order === "asc"
            ? ["featured", "taken_at", "published_at", "date_created"]
            : ["-featured", "-taken_at", "-published_at", "-date_created"]
        ) as never,
        limit: options?.limit ?? -1,
      })
    )) as DirectusPhoto[];

    const photoIds = photos.map((photo) => photo.id);
    const motionLinks = photoIds.length
      ? ((await client.request(
          readItems("photos_motion_frames", {
            fields: ["id", "photos_id"] as never,
            filter: {
              photos_id: {
                _in: photoIds as never,
              },
            },
            limit: -1,
          })
        )) as Array<{ id: number; photos_id: string | number }>)
      : [];

    const motionCountByPhotoId = new Map<string, number>();

    for (const link of motionLinks) {
      const key = String(link.photos_id);
      motionCountByPhotoId.set(key, (motionCountByPhotoId.get(key) ?? 0) + 1);
    }

    const photosWithMotionCounts = photos.map((photo) => ({
      ...photo,
      motion_frame_count: motionCountByPhotoId.get(String(photo.id)) ?? 0,
    }));

    if (!options?.includeSets) {
      return photosWithMotionCounts.map((photo) => normalizePhotoSummary(event, photo));
    }

    const links = (await client.request(
      readItems("photosets_photos", {
        fields: ["photos_id", ...PHOTO_SET_LINK_FIELDS] as never,
        filter: {
          photos_id: {
            _in: photoIds as never,
          },
        },
        limit: -1,
      })
    )) as Array<{
      photos_id: string | number;
      photosets_id: { id: number; slug: string; title: string; status?: string | null } | number;
    }>;

    const setsByPhotoId = new Map<string, CmsSetRef[]>();

    for (const link of links) {
      if (!link.photosets_id || typeof link.photosets_id !== "object") {
        continue;
      }

      if (link.photosets_id.status !== "published") {
        continue;
      }

      const group = setsByPhotoId.get(String(link.photos_id)) ?? [];
      group.push({
        id: link.photosets_id.id,
        slug: link.photosets_id.slug,
        title: link.photosets_id.title,
      });
      setsByPhotoId.set(String(link.photos_id), group);
    }

    return photosWithMotionCounts.map((photo) =>
      normalizePhoto(event, photo, setsByPhotoId.get(String(photo.id)) ?? [])
    );
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
        fields: PHOTO_DETAIL_FIELDS as never,
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

    if (!photo) return null;

    const links = (await client.request(
      readItems("photosets_photos", {
        fields: PHOTO_SET_LINK_FIELDS as never,
        filter: { photos_id: { _eq: photo.id } },
        limit: -1,
      })
    )) as Array<{ photosets_id: { id: number; slug: string; title: string; status?: string | null } | number }>;

    const sets: CmsSetRef[] = links
      .filter(
        (row) =>
          row.photosets_id &&
          typeof row.photosets_id === "object" &&
          (row.photosets_id as { status?: string | null }).status === "published"
      )
      .map((row) => {
        const ps = row.photosets_id as { id: number; slug: string; title: string };
        return { id: ps.id, slug: ps.slug, title: ps.title };
      });

    const timelineLinks = (await client.request(
      readItems("timelines_photos", {
        fields: TIMELINE_LINK_FIELDS as never,
        filter: { photos_id: { _eq: photo.id } },
        limit: -1,
      })
    )) as Array<{ timelines_id: { id: number; slug: string; title: string; status?: string | null } | number }>;

    const timelines: CmsTimelineRef[] = timelineLinks
      .filter(
        (row) =>
          row.timelines_id &&
          typeof row.timelines_id === "object" &&
          (row.timelines_id as { status?: string | null }).status === "published"
      )
      .map((row) => {
        const timeline = row.timelines_id as { id: number; slug: string; title: string };
        return { id: timeline.id, slug: timeline.slug, title: timeline.title };
      });

    return normalizePhoto(event, photo, sets, timelines);
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
    }, [640, 960, 1400]),
    photoCount: photos.length,
  };
}

export function normalizeTimelineSummary(
  event: H3Event | undefined,
  timeline: DirectusTimeline
): CmsTimelineSummary {
  const entries = (timeline.entries ?? [])
    .filter((entry) => entry.photos_id && typeof entry.photos_id === "object")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  return {
    id: timeline.id,
    slug: timeline.slug,
    title: timeline.title,
    description: timeline.description || null,
    story: timeline.story || null,
    publishedAt: timeline.published_at || null,
    tags: timeline.tags || [],
    coverImage: normalizeAsset(event, timeline.cover_image, {
      width: 1800,
      quality: 80,
    }, {
      width: 960,
      height: 540,
      quality: 74,
      fit: "cover",
    }, [640, 960, 1400]),
    photoCount: entries.length,
  };
}

export function normalizeTimeline(
  event: H3Event | undefined,
  timeline: DirectusTimeline
): CmsTimeline {
  const entries: CmsTimelineEntry[] = (timeline.entries ?? [])
    .filter((entry) => entry.photos_id && typeof entry.photos_id === "object")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((entry) => ({
      id: entry.id,
      sort: entry.sort ?? null,
      chapterTitle: entry.chapter_title || null,
      storyText: entry.story_text || null,
      photo: entry.photos_id && typeof entry.photos_id === "object"
        ? normalizePhotoSummary(event, entry.photos_id as DirectusPhoto)
        : null,
    }));

  return {
    ...normalizeTimelineSummary(event, timeline),
    entries,
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

async function attachPhotosToTimelines(
  client: NonNullable<ReturnType<typeof getDirectusClient>>,
  timelines: DirectusTimeline[]
) {
  if (!timelines.length) {
    return timelines;
  }

  const timelineIds = timelines.map((timeline) => timeline.id);
  const entries = (await client.request(
    readItems("timelines_photos", {
      fields: TIMELINE_ENTRY_FIELDS as never,
      filter: {
        timelines_id: {
          _in: timelineIds,
        },
      },
      sort: ["sort", "id"],
      limit: -1,
    })
  )) as DirectusTimelinePhoto[];

  const grouped = new Map<number, DirectusTimelinePhoto[]>();

  for (const entry of entries) {
    const group = grouped.get(entry.timelines_id) ?? [];
    group.push(entry);
    grouped.set(entry.timelines_id, group);
  }

  return timelines.map((timeline) => ({
    ...timeline,
    entries: grouped.get(timeline.id) ?? [],
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

export async function readDirectusTimelines(
  event: H3Event | undefined,
  options?: { limit?: number }
) {
  const client = getDirectusClient(event);
  if (!client) return [];

  try {
    const timelines = (await client.request(
      readItems("timelines", {
        fields: TIMELINE_BASE_FIELDS as never,
        filter: { status: { _eq: "published" } },
        sort: ["-published_at"] as never,
        limit: options?.limit ?? -1,
      })
    )) as DirectusTimeline[];

    const timelinesWithEntries = await attachPhotosToTimelines(client, timelines);
    return timelinesWithEntries.map((timeline) => normalizeTimelineSummary(event, timeline));
  } catch {
    return [];
  }
}

export async function readDirectusTimelineBySlug(
  event: H3Event | undefined,
  slug: string
) {
  const client = getDirectusClient(event);
  if (!client) return null;

  try {
    const [timeline] = (await client.request(
      readItems("timelines", {
        fields: TIMELINE_BASE_FIELDS as never,
        filter: {
          status: { _eq: "published" },
          slug: { _eq: slug },
        },
        limit: 1,
      })
    )) as DirectusTimeline[];

    if (!timeline) {
      return null;
    }

    const [timelineWithEntries] = await attachPhotosToTimelines(client, [timeline]);
    return timelineWithEntries ? normalizeTimeline(event, timelineWithEntries) : null;
  } catch {
    return null;
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

export async function readDirectusProjects(event: H3Event | undefined) {
  const client = getDirectusClient(event);
  if (!client) return [];

  try {
    const projects = (await client.request(
      readItems("projects", {
        fields: PROJECT_FIELDS as never,
        filter: { status: { _eq: "published" } },
        sort: ["sort", "id"] as never,
        limit: -1,
      })
    )) as DirectusProject[];

    return projects.map(normalizeProject);
  } catch {
    return [];
  }
}

const CHAPTER_ITEM_FIELDS = [
  "id",
  "sort",
  "type",
  "sub_section_num",
  "sub_section_title",
  "sub_section_lead",
  "project",
  "para_card_text",
  "component",
] as const;

const CHAPTER_FIELDS = [
  "id",
  "sort",
  "slug",
  "chapter_num",
  "watermark",
  "title",
  "chapter_label",
  "title_href",
  "tagline",
  "description",
  "theme",
  "card_theme",
  "marquee_items",
  "footer_links",
  { items: CHAPTER_ITEM_FIELDS },
] as const;

export function normalizeChapterItem(item: DirectusChapterItem): CmsChapterItem {
  return {
    id: item.id,
    sort: item.sort ?? null,
    type: item.type,
    subSectionNum: item.sub_section_num ?? null,
    subSectionTitle: item.sub_section_title ?? null,
    subSectionLead: item.sub_section_lead ?? null,
    projectId: typeof item.project === "number" ? item.project : null,
    paraCardText: item.para_card_text ?? null,
    component: item.component ?? null,
  };
}

export function normalizeChapter(chapter: DirectusChapter): CmsChapter {
  return {
    id: chapter.id,
    sort: chapter.sort ?? null,
    slug: chapter.slug,
    chapterNum: chapter.chapter_num,
    watermark: chapter.watermark ?? null,
    title: chapter.title,
    chapterLabel: chapter.chapter_label ?? null,
    titleHref: chapter.title_href ?? null,
    tagline: chapter.tagline ?? null,
    description: chapter.description ?? null,
    theme: chapter.theme,
    cardTheme: chapter.card_theme,
    marqueeItems: chapter.marquee_items ?? null,
    footerLinks: chapter.footer_links ?? null,
    items: (chapter.items ?? []).map(normalizeChapterItem),
  };
}

export async function readDirectusChapters(event: H3Event | undefined) {
  const client = getDirectusClient(event);
  if (!client) return [];

  try {
    const chapters = (await client.request(
      readItems("chapters", {
        fields: CHAPTER_FIELDS as never,
        filter: { status: { _eq: "published" } },
        sort: ["sort"] as never,
        limit: -1,
        deep: { items: { _sort: ["sort"], _limit: -1 } } as never,
      })
    )) as DirectusChapter[];

    return chapters.map(normalizeChapter);
  } catch (e) {
    console.error("readDirectusChapters error:", e);
    return [];
  }
}
