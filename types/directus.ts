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
  heroTagline: "Fullstack developer \u2014 web apps, developer tools, and interactive experiences.",
  heroDescription: "I care about clean code, fast interfaces, and products that feel good to use. Self-taught, ship-first, always building something.",
  availabilityLabel: "Available for freelance work",
  availabilityActive: true,
  primaryCtaLabel: "View my GitHub \u2192",
  primaryCtaUrl: "https://github.com/verycrunchy",
  secondaryCtaLabel: "Support me",
  secondaryCtaUrl: "https://ko-fi.com/verycrunchy",
  bio: "",
};

export interface DirectusAsset {
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
  hero_tagline?: string | null;
  hero_description?: string | null;
  availability_label?: string | null;
  availability_active?: boolean | null;
  primary_cta_label?: string | null;
  primary_cta_url?: string | null;
  secondary_cta_label?: string | null;
  secondary_cta_url?: string | null;
  bio?: string | null;
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

export interface DirectusProject {
  id: number;
  status?: string | null;
  sort?: number | null;
  chapter?: string | null;
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  tags?: Array<{ label: string; variant?: string }> | null;
  link_href?: string | null;
  link_label?: string | null;
  link_target?: string | null;
  link_variant?: string | null;
  accent_color?: string | null;
  wide?: boolean | null;
  footer_label?: string | null;
  footer_live?: boolean | null;
  status_label?: string | null;
}


export interface DirectusPhotosetPhoto {
  id: number;
  photosets_id: number;
  photos_id: string | DirectusPhoto;
  sort: number | null;
}

export interface DirectusPhotoset {
  id: number;
  status?: string | null;
  slug: string;
  title: string;
  description?: string | null;
  cover_image?: string | DirectusAsset | null;
  published_at?: string | null;
  tags?: string[] | null;
  photos?: DirectusPhotosetPhoto[] | null;
}

export interface DirectusSchema {
  site_settings: DirectusSiteSettings[];
  posts: DirectusPost[];
  photos: DirectusPhoto[];
  photosets: DirectusPhotoset[];
  photosets_photos: DirectusPhotosetPhoto[];
  projects: DirectusProject[];
}

export interface CmsAsset {
  id: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  downloadFilename: string | null;
  url: string;
  previewUrl: string | null;
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
  heroTagline: string;
  heroDescription: string;
  availabilityLabel: string;
  availabilityActive: boolean;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  bio: string;
}

export interface CmsProject {
  id: number;
  chapter: string;
  eyebrow: string | null;
  title: string;
  description: string | null;
  tags: Array<{ label: string; variant?: string }>;
  linkHref: string | null;
  linkLabel: string | null;
  linkTarget: string | null;
  linkVariant: string | null;
  accentColor: string | null;
  wide: boolean;
  footerLabel: string | null;
  footerLive: boolean;
  statusLabel: string | null;
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

export interface CmsPhotosetSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  tags: string[];
  coverImage: CmsAsset | null;
  photoCount: number;
}

export interface CmsPhotoset extends CmsPhotosetSummary {
  photos: CmsPhotoSummary[];
}

export interface CmsSetRef {
  id: number;
  slug: string;
  title: string;
}

export interface CmsPhoto extends CmsPhotoSummary {
  sets: CmsSetRef[];
}

export interface CmsHomePayload {
  site: CmsSiteSettings;
  recentPosts: CmsPostSummary[];
  recentPhotos: CmsPhotoSummary[];
  projects: CmsProject[];
}
