import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
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
      "Instrument Serif": [400, "400italic"],
    },
    preload: true,
  },
  runtimeConfig: {
    // Server-only: admin token, only needed locally / for the seed script.
    // Do NOT set this in production — public access is handled via Directus policies.
    directusToken: process.env.DIRECTUS_TOKEN,
    public: {
      directusUrl: process.env.NUXT_PUBLIC_DIRECTUS_URL || "",
      env: process.env.NODE_ENV || "development",
    },
  },
});
