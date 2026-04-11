<script setup lang="ts">
  import { computed } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";

  const route = useRoute();
  const { data: cmsShell } = await useCmsShell();

  const site = computed(() => cmsShell.value?.site || DEFAULT_CMS_SITE_SETTINGS);

  function isActive(path: string) {
    return route.path === path || route.path.startsWith(`${path}/`);
  }
</script>

<template>
  <div class="min-h-dvh">
    <nav class="site-nav">
      <div
        class="site-nav-inner"
        data-directus-collection="site_settings"
        data-directus-item="1"
      >
        <NuxtLink to="/" class="site-nav-logo">
          <span class="logo-mark">vc</span>
          <span class="logo-label" data-directus-field="site_name">{{ site.siteName }}</span>
        </NuxtLink>
        <div class="site-nav-links">
          <NuxtLink to="/" class="nav-link" :class="{ 'is-active': route.path === '/' }">
            Home
          </NuxtLink>
          <NuxtLink to="/blog" class="nav-link" :class="{ 'is-active': isActive('/blog') }">
            <span data-directus-field="posts_label">{{ site.postsLabel }}</span>
          </NuxtLink>
          <NuxtLink
            to="/photos"
            class="nav-link"
            :class="{ 'is-active': isActive('/photos') }"
          >
            <span data-directus-field="photos_label">{{ site.photosLabel }}</span>
          </NuxtLink>
          <NuxtLink
            to="/photosets"
            class="nav-link"
            :class="{ 'is-active': isActive('/photosets') }"
          >
            Sets
          </NuxtLink>
          <a
            :href="site.githubUrl"
            target="_blank"
            rel="noopener"
            class="nav-link"
          >
            GitHub
          </a>
          <a
            :href="site.navCtaUrl || site.supportUrl"
            target="_blank"
            rel="noopener"
            class="nav-cta"
            data-directus-field="nav_cta_label"
          >
            {{ site.navCtaLabel }}
          </a>
        </div>
      </div>
    </nav>
    <slot />
  </div>
</template>

<style>
  .site-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 40;
    border-bottom: 1px solid rgba(113, 113, 122, 0.2);
    background: rgba(9, 11, 15, 0.8);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
  }

  .site-nav-inner {
    max-width: 72rem;
    margin: 0 auto;
    padding: 0 1.25rem;
    height: 3.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  @media (min-width: 640px) {
    .site-nav-inner { padding: 0 2rem; }
  }

  .site-nav-logo {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    text-decoration: none;
    flex-shrink: 0;
  }

  .logo-mark {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 4px;
    padding: 0.18rem 0.42rem;
    line-height: 1;
  }

  .logo-label {
    font-size: 0.82rem;
    font-weight: 500;
    color: #94a3b8;
    letter-spacing: -0.01em;
  }

  @media (max-width: 400px) {
    .logo-label { display: none; }
  }

  .site-nav-links {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .nav-link {
    font-size: 0.8rem;
    font-weight: 400;
    color: #52525b;
    padding: 0.35rem 0.65rem;
    border-radius: 5px;
    text-decoration: none;
    transition: color 0.15s;
  }

  .nav-link:hover {
    color: #a1a1aa;
  }

  .nav-link.is-active {
    color: #d4d4d8;
  }

  .nav-cta {
    font-size: 0.78rem;
    font-weight: 500;
    color: #6b7280;
    border: 1px solid rgba(113, 113, 122, 0.3);
    border-radius: 5px;
    padding: 0.28rem 0.7rem;
    text-decoration: none;
    margin-left: 0.5rem;
    transition: color 0.15s, border-color 0.15s;
  }

  .nav-cta:hover {
    color: #d4d4d8;
    border-color: rgba(148, 163, 184, 0.45);
  }
</style>
