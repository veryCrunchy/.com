import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-04-13",
  devtools: { enabled: false },
  css: ["@/global.css"],
  modules: ["@nuxtjs/google-fonts", "nuxt-build-cache", "@nuxt/image"],
  vite: {
    plugins: [tailwindcss()],
  },
  googleFonts: {
    families: {
      "IBM Plex Sans": true,
      "IBM Plex Mono": [400],
      "Libre Barcode 128 Text": true,
      Poppins: true,
      Syne: [400, 500, 600, 700, 800],
      "Instrument Serif": ["400"],
    },
    preload: true,
  },
  // Preconnect to Directus so image fetches start faster
  app: {
    head: {
      link: process.env.NUXT_PUBLIC_DIRECTUS_URL
        ? [
            { rel: "preconnect", href: process.env.NUXT_PUBLIC_DIRECTUS_URL },
            { rel: "dns-prefetch", href: process.env.NUXT_PUBLIC_DIRECTUS_URL },
          ]
        : [],
    },
  },
  // Server-side SWR caching for CMS API routes
  routeRules: {
    "/api/cms/home": { cache: { maxAge: 300, swr: true } },
    "/api/cms/photos": { cache: { maxAge: 300, swr: true } },
    "/api/cms/photos-timeline": { cache: { maxAge: 600, swr: true } },
    "/api/cms/photos/**": { cache: { maxAge: 600, swr: true } },
    "/api/cms/photosets": { cache: { maxAge: 600, swr: true } },
    "/api/cms/photosets/**": { cache: { maxAge: 600, swr: true } },
    "/api/cms/timelines": { cache: { maxAge: 600, swr: true } },
    "/api/cms/timelines/**": { cache: { maxAge: 600, swr: true } },
    "/api/cms/posts": { cache: { maxAge: 300, swr: true } },
    "/api/cms/posts/**": { cache: { maxAge: 600, swr: true } },
    "/api/cms/sponsors/**": { cache: { maxAge: 1800, swr: true } },
  },
  // Allow @nuxt/image to reference Directus assets if NuxtImg/NuxtPicture is used in future
  image: {
    domains: process.env.NUXT_PUBLIC_DIRECTUS_URL
      ? [process.env.NUXT_PUBLIC_DIRECTUS_URL.replace(/^https?:\/\//, "").split("/")[0] ?? ""]
      : [],
  },
  runtimeConfig: {
    // Server-only Directus token. Optional for public read-only pages, but required
    // for local schema scripts and write-backed server routes such as street delivery intake.
    directusToken: process.env.DIRECTUS_TOKEN,
    photoIngestAiApiKey: process.env.PHOTO_INGEST_AI_API_KEY,
    photoIngestAiBaseUrl: process.env.PHOTO_INGEST_AI_BASE_URL,
    photoIngestAiModel: process.env.PHOTO_INGEST_AI_MODEL,
    public: {
      directusUrl: process.env.NUXT_PUBLIC_DIRECTUS_URL || "",
      siteUrlDisplay: process.env.NUXT_PUBLIC_SITE_URL_DISPLAY || "",
      env: process.env.NODE_ENV || "development",
    },
  },
});
