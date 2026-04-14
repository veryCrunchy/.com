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
  heroTagline: "Fullstack developer — I build web apps, developer tools, and things I want to exist.",
  heroDescription: "Self-taught. I care more about shipping something real than getting the architecture perfect on the first pass. Always building, usually in public.",
  availabilityLabel: "Open to freelance work",
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

export interface DirectusLocation {
  id: number;
  slug: string;
  title: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
}

export interface DirectusCameraBody {
  id: number;
  slug: string;
  brand?: string | null;
  model: string;
  label?: string | null;
}

export interface DirectusLens {
  id: number;
  slug: string;
  brand?: string | null;
  model: string;
  label?: string | null;
  mount?: string | null;
  focal_range?: string | null;
  max_aperture?: string | null;
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
  location_ref?: number | DirectusLocation | null;
  camera_ref?: number | DirectusCameraBody | null;
  lens_ref?: number | DirectusLens | null;
  featured?: boolean | null;
  tags?: string[] | null;
  motion_frames?: DirectusPhotoMotionFrame[] | null;
  motion_frame_count?: number | null;
  shots?: DirectusPhotoShot[] | null;
  shot_count?: number | null;
}

export interface DirectusPhotoMotionFrame {
  id: number;
  photos_id: number | string;
  frame_file?: string | DirectusAsset | null;
  sort: number | null;
}

export interface DirectusPhotoShot {
  id: number;
  photos_id: number | string;
  shot_file?: string | DirectusAsset | null;
  sort: number | null;
  role?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface DirectusProject {
  id: number;
  status?: string | null;
  sort?: number | null;
  chapter?: string | null;
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  tags?: Array<{ label: string; variant?: 'blue' | 'rust' | 'green' | 'purple' | 'orange' }> | null;
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

export interface DirectusTimelinePhoto {
  id: number;
  timelines_id: number;
  photos_id: string | DirectusPhoto;
  sort: number | null;
  chapter_title?: string | null;
  story_text?: string | null;
}

export interface DirectusTimeline {
  id: number;
  status?: string | null;
  slug: string;
  title: string;
  description?: string | null;
  story?: string | null;
  cover_image?: string | DirectusAsset | null;
  published_at?: string | null;
  tags?: string[] | null;
  entries?: DirectusTimelinePhoto[] | null;
}

export interface DirectusSchema {
  site_settings: DirectusSiteSettings[];
  posts: DirectusPost[];
  photos: DirectusPhoto[];
  photos_motion_frames: DirectusPhotoMotionFrame[];
  photos_shots: DirectusPhotoShot[];
  photo_locations: DirectusLocation[];
  camera_bodies: DirectusCameraBody[];
  lenses: DirectusLens[];
  photosets: DirectusPhotoset[];
  photosets_photos: DirectusPhotosetPhoto[];
  timelines: DirectusTimeline[];
  timelines_photos: DirectusTimelinePhoto[];
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
  srcset: string | null;
}

export interface CmsLocationMeta {
  id: number;
  slug: string;
  title: string;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
}

export interface CmsCameraMeta {
  id: number;
  slug: string;
  brand: string | null;
  model: string;
  label: string | null;
}

export interface CmsLensMeta {
  id: number;
  slug: string;
  brand: string | null;
  model: string;
  label: string | null;
  mount: string | null;
  focalRange: string | null;
  maxAperture: string | null;
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
  tags: Array<{ label: string; variant?: 'blue' | 'rust' | 'green' | 'purple' | 'orange' }>;
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
  locationMeta: CmsLocationMeta | null;
  cameraMeta: CmsCameraMeta | null;
  lensMeta: CmsLensMeta | null;
  tags: string[];
  image: CmsAsset | null;
  hasMotion: boolean;
  motionFrameCount: number;
  motionFrames: CmsMotionFrame[];
  shotCount: number;
  shots: CmsPhotoShot[];
  sets?: CmsSetRef[];
  timelines?: CmsTimelineRef[];
}

export interface CmsMotionFrame {
  id: number;
  sort: number | null;
  image: CmsAsset | null;
}

export interface CmsPhotoShot {
  id: number;
  sort: number | null;
  role: string | null;
  title: string | null;
  description: string | null;
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

export interface CmsTimelineSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  story: string | null;
  publishedAt: string | null;
  tags: string[];
  coverImage: CmsAsset | null;
  photoCount: number;
}

export interface CmsTimelineEntry {
  id: number;
  sort: number | null;
  chapterTitle: string | null;
  storyText: string | null;
  photo: CmsPhotoSummary | null;
}

export interface CmsTimeline extends CmsTimelineSummary {
  entries: CmsTimelineEntry[];
}

export interface CmsSetRef {
  id: number;
  slug: string;
  title: string;
}

export interface CmsTimelineRef {
  id: number;
  slug: string;
  title: string;
}

export interface CmsPhoto extends CmsPhotoSummary {
  sets: CmsSetRef[];
  timelines: CmsTimelineRef[];
  motionFrames: CmsMotionFrame[];
  shots: CmsPhotoShot[];
}

export interface CmsHomePayload {
  site: CmsSiteSettings;
  recentPosts: CmsPostSummary[];
  recentPhotos: CmsPhotoSummary[];
  projects: CmsProject[];
}
