import type { DirectusFile } from "@directus/sdk";

export const DEFAULT_CMS_SITE_SETTINGS: CmsSiteSettings = {
  siteName: "veryCrunchy",
  siteTagline: "Fullstack developer, photo journal, and personal notes.",
  siteDescription:
    "Personal site for projects, photography, and long-form writing by veryCrunchy.",
  githubUrl: "https://github.com/verycrunchy",
  supportUrl: "https://ko-fi.com/verycrunchy",
  navCtaLabel: "Support",
  navCtaUrl: "https://ko-fi.com/verycrunchy",
  postsLabel: "Blog",
  photosLabel: "Photos",
};

export interface DirectusAsset extends Partial<DirectusFile> {
  id: string;
  title?: string | null;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  filename_download?: string | null;
}

export interface DirectusSiteSettings {
  id: string;
  site_name?: string | null;
  site_tagline?: string | null;
  site_description?: string | null;
  github_url?: string | null;
  support_url?: string | null;
  nav_cta_label?: string | null;
  nav_cta_url?: string | null;
  posts_label?: string | null;
  photos_label?: string | null;
}

export interface DirectusPost {
  id: string;
  status?: string | null;
  slug: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  cover_image?: string | DirectusAsset | null;
  published_at?: string | null;
  featured?: boolean | null;
  tags?: string[] | null;
}

export interface DirectusPhoto {
  id: string;
  status?: string | null;
  slug: string;
  title: string;
  description?: string | null;
  image?: string | DirectusAsset | null;
  published_at?: string | null;
  taken_at?: string | null;
  location?: string | null;
  camera?: string | null;
  lens?: string | null;
  featured?: boolean | null;
  tags?: string[] | null;
}

export interface DirectusSchema {
  site_settings: DirectusSiteSettings[];
  posts: DirectusPost[];
  photos: DirectusPhoto[];
}

export interface CmsAsset {
  id: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  downloadFilename: string | null;
  url: string;
}

export interface CmsSiteSettings {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  githubUrl: string;
  supportUrl: string;
  navCtaLabel: string;
  navCtaUrl: string;
  postsLabel: string;
  photosLabel: string;
}

export interface CmsPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  tags: string[];
  coverImage: CmsAsset | null;
}

export interface CmsPost extends CmsPostSummary {
  content: string | null;
}

export interface CmsPhotoSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  takenAt: string | null;
  location: string | null;
  camera: string | null;
  lens: string | null;
  tags: string[];
  image: CmsAsset | null;
}

export interface CmsPhoto extends CmsPhotoSummary {}

export interface CmsHomePayload {
  site: CmsSiteSettings;
  recentPosts: CmsPostSummary[];
  recentPhotos: CmsPhotoSummary[];
}
