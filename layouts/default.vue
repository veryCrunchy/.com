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
      <div class="site-nav-inner">
        <NuxtLink to="/" class="site-nav-logo">
          <span class="logo-mark">vc</span>
          <span class="logo-label">{{ site.siteName }}</span>
        </NuxtLink>
        <div class="site-nav-links">
          <NuxtLink to="/" class="nav-link" :class="{ 'is-active': route.path === '/' }">
            Home
          </NuxtLink>
          <NuxtLink to="/blog" class="nav-link" :class="{ 'is-active': isActive('/blog') }">
            {{ site.postsLabel }}
          </NuxtLink>
          <NuxtLink
            to="/photos"
            class="nav-link"
            :class="{ 'is-active': isActive('/photos') }"
          >
            {{ site.photosLabel }}
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
    border-bottom: 1px solid rgba(113, 113, 122, 0.28);
    background: rgba(11, 13, 17, 0.72);
    backdrop-filter: blur(14px) saturate(120%);
    -webkit-backdrop-filter: blur(14px) saturate(120%);
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
    gap: 0.6rem;
    text-decoration: none;
    flex-shrink: 0;
  }

  .logo-mark {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: linear-gradient(135deg, #c9d1d9, #8ea8c3);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    border: 1px solid rgba(142, 168, 195, 0.35);
    border-radius: 5px;
    padding: 0.2rem 0.45rem;
    line-height: 1;
  }

  .logo-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: #cbd5e1;
    letter-spacing: -0.01em;
  }

  @media (max-width: 400px) {
    .logo-label { display: none; }
  }

  .site-nav-links {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .nav-link {
    font-size: 0.82rem;
    font-weight: 400;
    color: #94a3b8;
    padding: 0.35rem 0.7rem;
    border-radius: 6px;
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
  }

  .nav-link:hover {
    color: #e2e8f0;
    background: rgba(148, 163, 184, 0.08);
  }

  .nav-link.is-active {
    color: #e2e8f0;
    background: rgba(148, 163, 184, 0.11);
  }

  .nav-cta {
    font-size: 0.8rem;
    font-weight: 500;
    color: #c9d1d9;
    border: 1px solid rgba(142, 168, 195, 0.38);
    border-radius: 6px;
    padding: 0.3rem 0.8rem;
    text-decoration: none;
    margin-left: 0.35rem;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .nav-cta:hover {
    color: #f1f5f9;
    border-color: rgba(219, 234, 254, 0.6);
    background: rgba(142, 168, 195, 0.08);
  }
</style>
