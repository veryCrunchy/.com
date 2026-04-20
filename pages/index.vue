<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, computed } from "vue";
  import { gsap } from "gsap";
  import type { CmsHomePayload, CmsProject } from "~/types/directus";
  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";

  const { data: cmsHome } = await useAsyncData<CmsHomePayload>(
    "cms-home",
    () => $fetch("/api/cms/home"),
    {
      default: () => ({
        site: DEFAULT_CMS_SITE_SETTINGS,
        recentPosts: [],
        recentPhotos: [],
        projects: [],
        chapters: [],
      }),
    }
  );

  const cmsSite = computed(() => cmsHome.value?.site ?? DEFAULT_CMS_SITE_SETTINGS);
  const cmsProjects = computed(() => cmsHome.value?.projects ?? []);
  const cmsChapters = computed(() => cmsHome.value?.chapters ?? []);
  const projectMap = computed(() => new Map(cmsProjects.value.map((proj) => [proj.id, proj])));

  function getProj(id: number): CmsProject | null {
    return projectMap.value.get(id) ?? null;
  }

  function cmsCardProps(id: number) {
    const proj = getProj(id);
    if (!proj) return { title: '' };
    return {
      wide: proj.wide,
      eyebrow: proj.eyebrow ?? undefined,
      title: proj.title,
      description: proj.description ?? undefined,
      tags: proj.tags?.length ? proj.tags : undefined,
      link: proj.linkHref
        ? {
            href: proj.linkHref,
            label: proj.linkLabel || "Open →",
            ...(proj.linkTarget ? { target: proj.linkTarget } : {}),
            ...(proj.linkVariant ? { variant: proj.linkVariant as "default" | "green" } : {}),
          }
        : undefined,
      accentColor: (proj.accentColor ?? undefined) as "blue" | "orange" | "purple" | "green" | "pink" | "none" | undefined,
      footer:
        proj.footerLabel || proj.footerLive
          ? { label: proj.footerLabel || "", live: proj.footerLive }
          : undefined,
      status: proj.statusLabel ?? undefined,
    };
  }

  function projCardProps(id: number) {
    return cmsCardProps(id);
  }

  const moved = ref(false);
  const cursor = ref<HTMLDivElement | null>(null);
  const cursorSmall = ref<HTMLDivElement | null>(null);
  const main = ref<HTMLDivElement | null>(null);
  let animationContext: gsap.Context | null = null;
  const userTheme = useCookie<"dark" | "light">("user-theme", {
    watch: true,
  });

  useHead({
    bodyAttrs: {
      class: "home-cursor-page",
    },
  });

  type HoverSnapEl = {
    rect: DOMRect;
    size?: string;
    distance?: number;
    radius?: string;
    x?: string;
    y?: string;
  };

  function toggleTheme() {
    userTheme.value === "dark" ? setTheme("light") : setTheme("dark");
  }

  function setTheme(theme: "dark" | "light") {
    userTheme.value = theme;
    document.documentElement.className = theme;
  }

  onMounted(async () => {
    setTheme(userTheme.value || "dark");

    let rects: HoverSnapEl[] = [];
    let lastMouseX = -1;
    let lastMouseY = -1;
    let size = 300;

    load();

    setTimeout(() => {
      if (main.value) {
        gsap.to(main.value, { opacity: 1, duration: 0.5 });
      }

      animationContext = gsap.context(() => {
        // book animation removed — chapters now scroll naturally
      }, main.value || undefined);
    }, 300);

    updateRects();

    window.onmousemove = (e) => small(e.pageX, e.pageY);
    window.ontouchmove = (e) => {
      const touch = e.touches[0] || e.changedTouches[0];
      small(touch.pageX, touch.pageY);
    };
    let inactiveTimeout: NodeJS.Timeout;
    setTimeout(() => {
      function update() {
        updateRects();
        move(lastMouseX, lastMouseY);
      }
      window.onscroll = update;
      window.onresize = update;

      window.onmousemove = (e) => move(e.clientX, e.clientY);
      window.ontouchmove = (e) => {
        const touch = e.touches[0] || e.changedTouches[0];
        move(touch.clientX, touch.clientY);
      };

      const move = (x: number, y: number) => {
        clearTimeout(inactiveTimeout);
        lastMouseX = x;
        lastMouseY = y;
        let closestRect = null;
        let closestDistance = Infinity;

        for (let e of rects) {
          const { rect, distance } = e;
          const centerX = rect.x + rect.width / 2;
          const centerY = rect.y + rect.height / 2;
          const d = getDistance(x, y, centerX, centerY);
          const radius = distance || 50;

          if (
            x > centerX - radius - rect.width / 2 &&
            x < centerX + radius + rect.width / 2 &&
            y > centerY - radius - rect.height &&
            y < centerY + radius + rect.height &&
            d < closestDistance
          ) {
            closestDistance = d;
            closestRect = e;
          }
        }

        if (closestRect) {
          small(x, y);
          snap(closestRect);
          return;
        }

        small(x, y);
        size = 70;

        if (cursor.value) {
          gsap.to(cursor.value, {
            height: size,
            width: size,
            left: x,
            top: y,
            borderRadius: "50%",
            duration: 0.22,
          });
        }

        moved.value = true;
        inactiveTimeout = setTimeout(load, 2000);
      };
    }, 100);

    function snap(e: HoverSnapEl) {
      if (!e.size) e.size = `${Math.max(e.rect.width, e.rect.height) + 100}px`;
      let pos: { x: number | undefined; y: number | undefined } = {
        x: undefined,
        y: undefined,
      };
      if (e.x?.endsWith("%"))
        pos.x = window.innerWidth * (parseInt(e.x.replace("%", "")) * 0.01);
      if (e.y?.endsWith("%"))
        pos.y = window.innerHeight * (parseInt(e.y.replace("%", "")) * 0.01);
      if (cursor.value) {
        gsap.to(cursor.value, {
          height: e.size,
          width: e.size,
          left: pos.x ?? e.rect.x + e.rect.width / 2,
          top: pos.y ?? e.rect.y + e.rect.height / 2,
          borderRadius: e.radius,
          duration: 0.22,
        });
      }
    }

    function load() {
      const loadFocus = document.getElementsByClassName("load-focus")[0];
      if (loadFocus) {
        snap(getHSEl(loadFocus));
      }
    }

    function small(x: number, y: number) {
      if (cursorSmall.value) {
        gsap.set(cursorSmall.value, { left: x, top: y });
        gsap.to(cursorSmall.value, { opacity: 1, duration: 0.08, overwrite: "auto" });
      }
    }

    function getHSEl(el: Element): HoverSnapEl {
      return {
        rect: el.getBoundingClientRect(),
        size: el.getAttribute("hs-size") ?? undefined,
        distance: Number(el.getAttribute("hs-dist")) ?? undefined,
        radius: el.getAttribute("hs-br") ?? "50%",
        x: el.getAttribute("hs-x") ?? undefined,
        y: el.getAttribute("hs-y") ?? undefined,
      };
    }

    function updateRects() {
      const hovers = document.getElementsByClassName("hover");
      let newRects: HoverSnapEl[] = [];
      for (let hover of hovers) {
        newRects.push(getHSEl(hover));
      }
      rects = newRects;
    }

    function debounce<T extends unknown[], U>(
      callback: (...args: T) => PromiseLike<U> | U,
      wait: number
    ) {
      let timer: NodeJS.Timeout;

      return (...args: T): Promise<U> => {
        clearTimeout(timer);
        return new Promise((resolve) => {
          timer = setTimeout(() => resolve(callback(...args)), wait);
        });
      };
    }

    function getDistance(x1: number, y1: number, x2: number, y2: number) {
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
  });

  onBeforeUnmount(() => {
    window.onmousemove = null;
    window.ontouchmove = null;
    window.onscroll = null;
    window.onresize = null;
    animationContext?.revert();
  });
</script>

<template>
  <div class="grain fixed pointer-events-none"></div>

  <div class="pointer-events-none fixed z-50 size-full">
    <div ref="cursorSmall" id="cursorSmall" class="pointer-events-none"></div>
  </div>
  <div class="pointer-events-none fixed z-[-1] size-full">
    <div ref="cursor" id="cursor"></div>
  </div>

  <main
    ref="main"
    class="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-24 text-zinc-100 opacity-0 transition-opacity duration-500 sm:px-8 lg:px-10"
  >

    <!-- ── Hero ──────────────────────────────────────────── -->
    <section
      class="hover mb-20 flex flex-col gap-10 md:flex-row md:items-start md:gap-14"
      hs-dist="120"
    >
      <div
        class="load-focus flex-1"
        hs-size="400px"
        hs-br="25%"
        data-directus-collection="site_settings"
        data-directus-item="1"
      >
        <h1 class="hero-title">
          <span class="hero-greeting">Hey, I'm</span>
          <span class="hero-name">veryCrunchy</span>
        </h1>
        <p class="italicline mt-5 max-w-lg" data-directus-field="hero_tagline">{{ cmsSite.heroTagline }}</p>
        <p class="mt-3 max-w-lg text-[0.9rem] leading-relaxed text-zinc-400" data-directus-field="hero_description">{{ cmsSite.heroDescription }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a :href="cmsSite.primaryCtaUrl" target="_blank" rel="noopener" class="hero-btn hero-btn--primary">{{ cmsSite.primaryCtaLabel }}</a>
          <a :href="cmsSite.secondaryCtaUrl" target="_blank" rel="noopener" class="hero-btn hero-btn--ghost">{{ cmsSite.secondaryCtaLabel }}</a>
        </div>
      </div>

      <div class="flex flex-col items-center gap-3 md:pt-4">
        <div class="avatar-ring hover" hs-dist="80" hs-br="50%">
          <img
            src="https://pfp.crun.zip/verycrunchy.com/home"
            alt="veryCrunchy"
            class="avatar-img"
          />
        </div>
        <p class="mt-1 text-[0.75rem] font-medium text-zinc-200">veryCrunchy</p>
        <span class="role-badge">Founder &amp; CEO · Obiente</span>
      </div>
    </section>

    <section class="book">

      <PageArticle
        v-for="ch in cmsChapters"
        :key="ch.id"
        :chapter-num="ch.chapterNum"
        :watermark="ch.watermark ?? undefined"
        :title="ch.title"
        :chapter-label="ch.chapterLabel ?? undefined"
        :title-href="ch.titleHref ?? undefined"
        :tagline="ch.tagline ?? undefined"
        :description="ch.description ?? undefined"
        :theme="(ch.theme as 'green' | 'blue' | 'orange' | 'purple' | 'pink' | 'white' | undefined)"
        :marquee-items="ch.marqueeItems ?? undefined"
        :footer-links="ch.footerLinks ?? undefined"
        :data-directus-collection="'chapters'"
        :data-directus-item="ch.id"
      >
        <template v-for="item in ch.items" :key="item.id">

          <!-- Sub-section heading -->
          <template v-if="item.type === 'sub_section'">
            <div class="ch-sub-rule">
              <span class="ch-sub-num">{{ item.subSectionNum }}</span>
              <h3 class="ch-sub-title">{{ item.subSectionTitle }}</h3>
            </div>
            <p v-if="item.subSectionLead" class="ch-sub-lead">{{ item.subSectionLead }}</p>
          </template>

          <!-- Project card -->
          <ArticleCard
            v-else-if="item.type === 'project' && item.projectId"
            :theme="(ch.cardTheme as 'dark' | 'darker' | 'ob' | undefined)"
            v-bind="projCardProps(item.projectId)"
            :data-directus-collection="'projects'"
            :data-directus-item="item.projectId"
          />

          <!-- Paragraph card -->
          <p
            v-else-if="item.type === 'para_card' && item.paraCardText"
            class="para-card"
          >{{ item.paraCardText }}</p>

          <!-- Named component -->
          <div v-else-if="item.type === 'component'" class="ch-full">
            <SponsorsList v-if="item.component === 'SponsorsList'" />
            <DonationOptions v-else-if="item.component === 'DonationOptions'" />
          </div>

        </template>
      </PageArticle>

    </section>

  </main>
</template>


<style>
  :root {
    --primary: #c9d1d9;
    --bg-color: #0b0d11;
    --accent: #8ea8c3;
    --grain-overlay: url(/grain.svg);
    transition: background 1s, color 1s;
  }

  body.home-cursor-page,
  body.home-cursor-page * {
    cursor: none !important;
  }

  :root.dark { color: var(--primary); }

  ::selection { background: #334155; color: #f1f5f9; }

  body {
    font-family: "IBM Plex Sans", sans-serif;
    transition: background 0.7s, background-color 0.7s;
    background-color: var(--bg-color);
    background-image:
      radial-gradient(circle at 18% 8%, rgba(142, 168, 195, 0.18), transparent 38%),
      radial-gradient(circle at 82% 88%, rgba(96, 111, 129, 0.14), transparent 42%),
      radial-gradient(circle at 55% 50%, rgba(30, 40, 60, 0.22), transparent 60%);
  }

  .grain {
    background: var(--grain-overlay);
    background-size: 150px 150px;
    opacity: 0.16;
    mix-blend-mode: soft-light;
    width: 100%;
    height: 100%;
    z-index: 40;
  }

  .book {
    margin-top: 1rem;
  }

  /* ── Hero typography ──────────────────────────── */
  .hero-title {
    font-family: "Bricolage Grotesque", sans-serif;
    line-height: 0.92;
    letter-spacing: -0.03em;
  }

  .hero-greeting {
    display: block;
    font-size: clamp(1.1rem, 2.5vw, 1.5rem);
    font-weight: 400;
    color: #71717a;
    font-family: "IBM Plex Sans", sans-serif;
    letter-spacing: 0.01em;
    margin-bottom: 0.15em;
  }

  .hero-name {
    display: block;
    font-size: clamp(3.8rem, 11vw, 7rem);
    font-weight: 800;
    background: linear-gradient(135deg, #f1f5f9 0%, #94b4cc 50%, #c9d8e4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .italicline {
    font-family: "Instrument Serif", serif;
    font-style: italic;
    font-size: clamp(1.1rem, 2.5vw, 1.35rem);
    color: #a1a1aa;
    line-height: 1.5;
  }

  .hero-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s ease;
    cursor: none;
  }

  .hero-btn--primary {
    background: rgba(142, 168, 195, 0.1);
    border: 1px solid rgba(142, 168, 195, 0.35);
    color: #c9d1d9;
  }

  .hero-btn--primary:hover {
    background: rgba(142, 168, 195, 0.18);
    border-color: rgba(142, 168, 195, 0.65);
    color: #e2e8f0;
  }

  .hero-btn--ghost {
    background: transparent;
    border: 1px solid rgba(113, 113, 122, 0.4);
    color: #71717a;
  }

  .hero-btn--ghost:hover {
    border-color: rgba(148, 163, 184, 0.5);
    color: #d4d4d8;
  }

  .avatar-ring {
    position: relative;
    padding: 3px;
    border-radius: 50%;
    background: linear-gradient(145deg, rgba(142, 168, 195, 0.55), rgba(96, 111, 129, 0.2));
  }

  .avatar-img {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 2px solid var(--bg-color);
    object-fit: cover;
    display: block;
  }

  .role-badge {
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #71717a;
    border: 1px solid rgba(113, 113, 122, 0.4);
    border-radius: 99px;
    padding: 0.22rem 0.7rem;
    white-space: nowrap;
  }

  /* ── Chapter markers ──────────────────────────── */
  .ch-rule {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid rgba(113, 113, 122, 0.22);
  }

  .ch-num {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: #52525b;
  }

  .ch-num--green { color: rgba(74, 222, 128, 0.55); }

  .ch-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.4rem, 3vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #e4e4e7;
  }

  /* ── Sub-section rules (inside PageArticle) ──── */
  .ch-sub-rule {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 2rem 0 0.75rem;
    border-bottom: 1px solid rgba(113, 113, 122, 0.18);
    margin-top: 0.25rem;
  }

  /* First sub-rule in a chapter gets less top padding */
  .pa-grid > .ch-sub-rule:first-child {
    padding-top: 0.25rem;
    margin-top: 0;
  }

  .ch-sub-num {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: #52525b;
    white-space: nowrap;
  }

  .ch-sub-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #71717a;
  }

  .ch-sub-lead {
    font-family: "Instrument Serif", serif;
    font-style: italic;
    font-size: 1rem;
    line-height: 1.75;
    color: #6b7280;
    max-width: 60ch;
    padding-bottom: 0.25rem;
  }

  /* ── Paragraph card (editorial text block) ───── */
  .para-card {
    margin: 0.75rem 0;
    padding: 1.25rem 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(113, 113, 122, 0.12);
    background: rgba(12, 13, 18, 0.25);
    font-family: "Instrument Serif", serif;
    font-style: italic;
    font-size: 1rem;
    line-height: 1.875;
    color: #52525b;
  }

  /* ── Stack chips ──────────────────────────────── */
  .stack-chip {
    font-size: 0.73rem;
    color: #a1a1aa;
    background: rgba(39, 39, 42, 0.8);
    border: 1px solid rgba(63, 63, 70, 0.8);
    border-radius: 6px;
    padding: 0.28rem 0.6rem;
  }

  .stack-chip--blue {
    color: #c9d1d9;
    background: rgba(142, 168, 195, 0.09);
    border-color: rgba(142, 168, 195, 0.2);
  }

  .stack-chip--go {
    color: #67e8f9;
    background: rgba(0, 125, 162, 0.12);
    border-color: rgba(0, 175, 220, 0.25);
  }

  /* ── story-link with meta sub-text ───────────── */
  .story-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0;
    border-bottom: 1px solid rgba(113, 113, 122, 0.12);
    color: #a1a1aa;
    text-decoration: none;
    font-size: 0.875rem;
    transition: color 0.15s;
  }

  .story-link:last-child {
    border-bottom: none;
  }

  .story-link:hover {
    color: #e4e4e7;
  }

  .slmeta {
    font-size: 0.7rem;
    color: #3f3f46;
    letter-spacing: 0.01em;
    flex-shrink: 0;
  }

  /* ── Cursor ───────────────────────────────────── */
  #cursorSmall {
    position: absolute;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(142, 168, 195, 0.9);
    transform: translate(-50%, -50%);
    top: -100px;
    left: 50px;
    z-index: 50;
    box-shadow: 0 0 10px rgba(142, 168, 195, 0.5);
  }

  #cursor {
    position: absolute;
    width: calc(100vw + 100vh);
    height: calc(100vw + 100vh);
    top: 50vh;
    left: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(142, 168, 195, 0.62) 0%, transparent 70%);
    border-radius: 50%;
    overflow: hidden;
    filter: blur(105px) brightness(1.1);
    opacity: 0.45;
    z-index: -5;
  }

  .hover {
    transition: transform 0.3s ease, filter 0.3s ease;
  }

  .hover:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 12px 30px rgba(14, 20, 29, 0.5));
  }

  /* Hide cursor elements on touch / pointer-coarse devices */
  @media (pointer: coarse) {
    #cursor, #cursorSmall { display: none !important; }
  }

  @media (max-width: 768px) {
    .book-shell {
      top: 4.75rem;
      height: calc(100dvh - 6rem);
      min-height: 0;
    }

    .book-shell > .pa-wrap {
      inset: 0;
    }

    .book-page-status {
      top: 0.35rem;
      right: 0.35rem;
      padding: 0.35rem 0.65rem;
    }

    .book-page-label {
      display: none;
    }

    .book-edge-nav {
      width: 2.6rem;
      height: 2.6rem;
      top: auto;
      bottom: 0.85rem;
      transform: none;
    }

    .book-edge-nav--prev {
      left: 0.35rem;
    }

    .book-edge-nav--next {
      right: 0.35rem;
    }

    .book-edge-nav:hover:not(:disabled) {
      transform: scale(1.04);
    }
  }
</style>
