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
      "Libre Barcode 128 Text": true,
      Poppins: true,
      Syne: [400, 500, 600, 700, 800],
      "Instrument Serif": true,
    },
    preload: true,
  },
  runtimeConfig: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    directusToken: process.env.DIRECTUS_TOKEN,
    public: {
      directusUrl: process.env.NUXT_PUBLIC_DIRECTUS_URL || "",
      env: process.env.NODE_ENV || "development",
    },
  },
});
