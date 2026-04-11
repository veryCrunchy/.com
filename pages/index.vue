<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from "vue";
  import { gsap } from "gsap";

  const moved = ref(false);
  const cursor = ref<HTMLDivElement | null>(null);
  const cursorSmall = ref<HTMLDivElement | null>(null);
  const main = ref<HTMLDivElement | null>(null);
  const book = ref<HTMLDivElement | null>(null);
  const activeBookPage = ref(0);
  const totalBookPages = ref(0);
  let animationContext: gsap.Context | null = null;
  let requestBookPageTurn: ((index: number, animate?: boolean) => boolean) | null = null;
  let bookInteractionController: AbortController | null = null;
  const userTheme = useCookie<"dark" | "light">("user-theme", {
    watch: true,
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

  function goToBookPage(index: number) {
    requestBookPageTurn?.(index, true);
  }

  function goToPrevBookPage() {
    goToBookPage(activeBookPage.value - 1);
  }

  function goToNextBookPage() {
    goToBookPage(activeBookPage.value + 1);
  }

  onMounted(async () => {
    setTheme(userTheme.value || "dark");

    let rects: HoverSnapEl[] = [];
    let cursorSmallShown = false;
    let lastMouseX = -1;
    let lastMouseY = -1;
    let size = 300;

    load();

    setTimeout(() => {
      if (main.value) {
        gsap.to(main.value, { opacity: 1, duration: 0.5 });
      }

      animationContext = gsap.context(() => {
        const shell = book.value?.querySelector<HTMLElement>(".book-shell");
        const wraps = gsap.utils.toArray<HTMLElement>(".pa-wrap");
        const roots = wraps
          .map((wrap) => wrap.querySelector<HTMLElement>(".pa-root"))
          .filter((root): root is HTMLElement => Boolean(root));
        const pageBodies = roots.map((root) => Array.from(root.children) as HTMLElement[]);
        const clamp01 = gsap.utils.clamp(0, 1);
        const mix = (from: number, to: number, progress: number) =>
          from + (to - from) * progress;
        const turnEase = gsap.parseEase("power2.inOut");
        const bodyEase = gsap.parseEase("power2.out");
        let pageMetrics: Array<{
          start: number;
          readDistance: number;
          turnDistance: number;
          maxScroll: number;
        }> = [];
        let bookStart = 0;
        let totalScrollSpan = 1;
        let rafId = 0;

        bookInteractionController?.abort();
        bookInteractionController = new AbortController();
        const { signal } = bookInteractionController;

        if (!shell || !book.value || !wraps.length || roots.length !== wraps.length) return;

        totalBookPages.value = wraps.length;

        roots.forEach((root) => {
          gsap.set(root, {
            transformPerspective: 1800,
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
          });
        });

        const setFocusPage = (focusIndex: number) => {
          wraps.forEach((wrap, index) => {
            wrap.classList.toggle("is-active", index === focusIndex);
            wrap.classList.toggle("is-next", index === focusIndex + 1);
            wrap.classList.toggle("is-past", index < focusIndex);
            wrap.classList.toggle("is-future", index > focusIndex + 1);
            wrap.style.pointerEvents = index === focusIndex ? "auto" : "none";
            wrap.style.zIndex =
              index === focusIndex
                ? String(wraps.length + 3)
                : index === focusIndex + 1
                  ? String(wraps.length + 2)
                  : String(wraps.length - index);
          });

          activeBookPage.value = focusIndex;
        };

        const applyBookState = (position: number) => {
          let segmentIndex = pageMetrics.length - 1;

          for (let index = 0; index < pageMetrics.length; index++) {
            const metric = pageMetrics[index];
            const metricEnd = metric.start + metric.readDistance + metric.turnDistance;

            if (position <= metricEnd || index === pageMetrics.length - 1) {
              segmentIndex = index;
              break;
            }
          }

          const metric = pageMetrics[segmentIndex];
          const nextMetric = pageMetrics[segmentIndex + 1];
          const localPosition = Math.max(position - metric.start, 0);
          const readProgress =
            metric.maxScroll > 0
              ? clamp01(localPosition / metric.readDistance)
              : localPosition >= metric.readDistance
                ? 1
                : 0;
          const rawTurnProgress = nextMetric
            ? clamp01((localPosition - metric.readDistance) / metric.turnDistance)
            : 0;
          const easedTurnProgress = turnEase(rawTurnProgress);
          const focusIndex =
            rawTurnProgress > 0.56 && segmentIndex < pageMetrics.length - 1
              ? segmentIndex + 1
              : segmentIndex;

          setFocusPage(focusIndex);

          roots.forEach((root, index) => {
            const body = pageBodies[index];
            const pageMetric = pageMetrics[index];

            if (!body || !pageMetric) return;

            if (index < segmentIndex) {
              root.scrollTop = pageMetric.maxScroll;
              gsap.set(root, {
                rotationY: -180,
                xPercent: -7,
                z: -180,
                scale: 0.975,
                opacity: 0.16,
              });
              gsap.set(body, { autoAlpha: 0, y: -8 });
              return;
            }

            if (index > segmentIndex + 1) {
              root.scrollTop = 0;
              gsap.set(root, {
                rotationY: 0,
                xPercent: 0,
                z: -18,
                scale: 0.995,
                opacity: 0.94,
              });
              gsap.set(body, { autoAlpha: 0, y: 10 });
            }
          });

          const currentRoot = roots[segmentIndex];
          const currentBody = pageBodies[segmentIndex];

          currentRoot.scrollTop = metric.maxScroll * readProgress;

          if (!nextMetric) {
            gsap.set(currentRoot, {
              rotationY: 0,
              xPercent: 0,
              z: 0,
              scale: 1,
              opacity: 1,
            });
            gsap.set(currentBody, { autoAlpha: 1, y: 0 });
            return;
          }

          const nextRoot = roots[segmentIndex + 1];
          const nextBody = pageBodies[segmentIndex + 1];
          const currentBodyFade = clamp01(rawTurnProgress / 0.34);
          const nextBodyFade = clamp01((rawTurnProgress - 0.42) / 0.36);

          nextRoot.scrollTop = 0;

          gsap.set(currentRoot, {
            rotationY: mix(0, -168, easedTurnProgress),
            xPercent: mix(0, -8, easedTurnProgress),
            z: mix(0, -170, easedTurnProgress),
            scale: mix(1, 0.976, easedTurnProgress),
            opacity: mix(1, 0.16, easedTurnProgress),
          });
          gsap.set(currentBody, {
            autoAlpha: 1 - currentBodyFade,
            y: mix(0, -8, currentBodyFade),
          });
          gsap.set(nextRoot, {
            rotationY: 0,
            xPercent: 0,
            z: mix(-20, 0, easedTurnProgress),
            scale: mix(0.994, 1, easedTurnProgress),
            opacity: mix(0.95, 1, easedTurnProgress),
          });
          gsap.set(nextBody, {
            autoAlpha: bodyEase(nextBodyFade),
            y: mix(10, 0, nextBodyFade),
          });
        };

        const computeBookMetrics = () => {
          const stickyTop = parseFloat(getComputedStyle(shell).top || "0") || 0;
          const shellHeight = shell.clientHeight;
          const minReadDistance = Math.max(shellHeight * 0.46, 280);
          const turnDistance = Math.max(shellHeight * 0.34, 220);
          let start = 0;

          pageMetrics = roots.map((root, index) => {
            const maxScroll = Math.max(root.scrollHeight - root.clientHeight, 0);
            const readDistance = Math.max(maxScroll, minReadDistance);
            const pageTurnDistance =
              index === roots.length - 1 ? Math.max(shellHeight * 0.18, 120) : turnDistance;
            const metric = {
              start,
              readDistance,
              turnDistance: pageTurnDistance,
              maxScroll,
            };

            start += readDistance + pageTurnDistance;
            return metric;
          });

          totalScrollSpan = Math.max(start, shellHeight);
          bookStart = window.scrollY + book.value!.getBoundingClientRect().top - stickyTop;
          book.value!.style.setProperty(
            "--book-scroll-span",
            `${totalScrollSpan + shellHeight + stickyTop * 1.5}px`
          );
        };

        const syncBookToScroll = () => {
          rafId = 0;

          const position = Math.max(
            0,
            Math.min(window.scrollY - bookStart, totalScrollSpan)
          );

          applyBookState(position);
        };

        const requestBookSync = () => {
          if (rafId) return;
          rafId = window.requestAnimationFrame(syncBookToScroll);
        };

        requestBookPageTurn = (index, animate = true) => {
          const clampedIndex = Math.max(0, Math.min(wraps.length - 1, index));
          const metric = pageMetrics[clampedIndex];

          if (!metric) return false;

          window.scrollTo({
            top: bookStart + metric.start,
            behavior: animate ? "smooth" : "auto",
          });

          return true;
        };

        computeBookMetrics();
        applyBookState(0);

        window.addEventListener("scroll", requestBookSync, { passive: true, signal });
        window.addEventListener(
          "resize",
          () => {
            computeBookMetrics();
            requestBookSync();
          },
          { passive: true, signal }
        );
        window.addEventListener(
          "keydown",
          (event) => {
            const shellRect = shell.getBoundingClientRect();
            const bookInView = shellRect.bottom > 120 && shellRect.top < window.innerHeight - 80;

            if (!bookInView) return;

            if (event.key === "ArrowRight" || event.key === "PageDown") {
              if (requestBookPageTurn?.(activeBookPage.value + 1, true)) {
                event.preventDefault();
              }
            }

            if (event.key === "ArrowLeft" || event.key === "PageUp") {
              if (requestBookPageTurn?.(activeBookPage.value - 1, true)) {
                event.preventDefault();
              }
            }
          },
          { signal }
        );
      }, main.value);
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

        if (cursorSmall.value) {
          gsap.to(cursorSmall.value, {
            opacity: 0,
            duration: 0.5,
          });
          cursorSmall.value.style.top = `${y}px`;
          cursorSmall.value.style.left = `${x}px`;
          cursorSmall.value.style.animation = "spin infinite 200s linear";
        }
        cursorSmallShown = false;
        size = 70;

        if (cursor.value) {
          gsap.to(cursor.value, {
            height: size,
            width: size,
            left: x,
            top: y,
            borderRadius: "50%",
            duration: 0.5,
          });
        }

        moved.value = true;
        inactiveTimeout = setTimeout(load, 2000);
      };
    }, 1500);

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
          duration: 0.5,
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
        gsap.to(cursorSmall.value, {
          left: x,
          top: y,
          duration: 0.4,
        });
        cursorSmall.value.style.opacity = "0.8";
        if (!cursorSmallShown) {
          if (cursorSmall.value) {
            cursorSmall.value.style.animation =
              "spin infinite 200s linear, blink infinite 5s linear";
          }
        }
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
    requestBookPageTurn = null;
    bookInteractionController?.abort();
    animationContext?.revert();
  });
</script>

<template>
  <div class="grain fixed pointer-events-none"></div>

  <div class="pointer-events-none fixed z-10 size-full">
    <div ref="cursorSmall" id="cursorSmall" class="pointer-events-none select-none text-4xl">⋆</div>
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
      <div class="load-focus flex-1" hs-size="400px" hs-br="25%">
        <div class="flex items-center gap-2">
          <span class="live-dot"></span>
          <p class="eyebrow">Available for freelance work</p>
        </div>
        <h1 class="hero-title mt-4">
          <span class="hero-greeting">Hey, I'm</span>
          <span class="hero-name">veryCrunchy</span>
        </h1>
        <p class="italicline mt-5 max-w-lg">
          Fullstack developer — web apps, developer tools, and interactive&nbsp;experiences.
        </p>
        <p class="mt-3 max-w-lg text-[0.9rem] leading-relaxed text-zinc-400">
          I care about clean code, fast interfaces, and products that feel good to use.
          Self-taught, ship-first, always building something.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="https://github.com/verycrunchy" target="_blank" rel="noopener" class="hero-btn hero-btn--primary">View my GitHub&nbsp;→</a>
          <a href="https://ko-fi.com/verycrunchy" target="_blank" rel="noopener" class="hero-btn hero-btn--ghost">Support me</a>
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

    <section ref="book" class="book">
    <div class="book-shell">
    <!-- ── Ch. 01: Personal Projects ── -->
    <PageArticle
      chapter-num="01"
      watermark="WORK"
      title="Personal Projects"
      tagline="Shipping things that matter."
      description="Side projects, tools, and experiments — built and maintained by me alone. No teams, no budgets, just an idea and the time to make it real."
      theme="white"
      :marquee-items="['Better stats.fm', 'Activity Card', 'verycrunchy.com', 'Photo Portfolio', 'Built in Public', 'TypeScript', 'Vue · Nuxt · Go']"
    >

      <div class="ch-sub-rule">
        <span class="ch-sub-num">1.1</span>
        <h3 class="ch-sub-title">Web Apps</h3>
      </div>
      <p class="ch-sub-lead">Music and presence — tools that surface what you're actually doing rather than what the algorithm decides you should see.</p>

      <ArticleCard
        :wide="true"
        eyebrow="Music · Web App"
        title="Better stats.fm"
        description="Your stats.fm history re-ranked by a custom weighted algorithm — balances stream count with total listening time. Find out what you've <em>actually</em> listened to most, not just what shuffled past."
        :tags="[
          { label: 'Nuxt 3' },
          { label: 'stats.fm API' },
          { label: 'TypeScript' },
          { label: 'Weighted scoring', variant: 'purple' },
        ]"
        :link="{ href: '/stats.fm/verycrunchy', label: 'Open →' }"
        accent-color="purple"
        theme="dark"
      />

      <ArticleCard
        eyebrow="Discord · Live"
        title="Activity Card"
        description="Real-time Discord activity — current game, Spotify track, or online status. Powered by Lanyard WebSockets. Always live, zero polling."
        :tags="[
          { label: 'Lanyard API' },
          { label: 'WebSockets' },
          { label: 'Vue 3' },
        ]"
        :link="{ href: '/lanyard/514892600038514689', label: 'Demo →' }"
        accent-color="blue"
        theme="dark"
        :footer="{ label: 'Always live', live: true }"
      />

      <div class="ch-sub-rule">
        <span class="ch-sub-num">1.2</span>
        <h3 class="ch-sub-title">This Site</h3>
      </div>
      <p class="ch-sub-lead">The canvas you're looking at — a personal site that doubles as an engineering playground. Every interaction is deliberate.</p>

      <ArticleCard
        eyebrow="This Site"
        title="verycrunchy.com"
        description="Custom GSAP cursor engine — tracks, snaps, and morphs to each element. No UI library for the interaction logic, built entirely from scratch."
        :tags="[
          { label: 'GSAP' },
          { label: 'Nuxt 3' },
          { label: 'Tailwind v4' },
        ]"
        :link="{ href: 'https://github.com/verycrunchy/.com', label: 'Source →', target: '_blank' }"
        theme="dark"
      />

      <p class="para-card">Every cursor movement passes through a custom spring physics engine. Snap points, morphing border-radii, velocity dampening — built from scratch with GSAP ticker loops and raw pointer event math. No third-party cursor library was harmed in the making of this site.</p>

      <div class="ch-sub-rule">
        <span class="ch-sub-num">1.3</span>
        <h3 class="ch-sub-title">In Progress</h3>
      </div>
      <p class="ch-sub-lead">What I'm actively building. Subject to pivots, delays, and the occasional complete restart.</p>

      <ArticleCard
        :wide="true"
        eyebrow="Coming · Q3 2026"
        title="Photo Portfolio"
        description="A first-person photo journal. Real places, real moments. Editorial grid layouts and behind-the-shot process notes. No stock imagery, no filters that don't belong."
        :tags="[
          { label: 'Photography' },
          { label: 'Editorial design' },
          { label: 'Nuxt Image' },
        ]"
        status="In progress"
        theme="darker"
        accent-color="pink"
      />

    </PageArticle>

    <!-- ── Ch. 02: Obiente ── -->
    <PageArticle
      chapter-num="02"
      chapter-label="Founder & CEO"
      watermark="OBIENTE"
      title="Obiente"
      title-href="https://obiente.com"
      tagline="Built for People, Not Profit."
      description="Open Source SaaS with a mission to serve the common good. Every project we ship is AGPL-3.0 licensed, free to self-host, and built to give users full control over their own data. Powered by community contributors, built entirely in the open."
      theme="green"
      :marquee-items="['Open Source', 'AGPL-3.0', 'Built for People', 'Not for Profit', 'Your Data, Your Control', 'Community Powered', 'Self-Hostable']"
      :footer-links="[
        { href: 'https://github.com/Obiente', label: 'View all Obiente projects on GitHub →' },
        { href: 'https://obiente.com', label: 'obiente.com ↗', dim: true },
      ]"
    >

      <div class="ch-sub-rule">
        <span class="ch-sub-num">2.1</span>
        <h3 class="ch-sub-title">Infrastructure</h3>
      </div>
      <p class="ch-sub-lead">Deployment and ops tooling built for full control — homelabs, teams, and production IaaS. Self-hosted by default.</p>

      <ArticleCard
        :wide="true"
        eyebrow="Infrastructure · Go"
        title="Obiente Cloud"
        description="A distributed Platform-as-a-Service for deploying and managing apps across multiple nodes. Multi-node deployments, auto-scaling, dynamic routing via Traefik, integrated Zitadel auth, Prometheus & Grafana monitoring. Built for homelabbers, teams, and production IaaS."
        :tags="[
          { label: 'Go', variant: 'blue' },
          { label: 'Vue 3' },
          { label: 'Docker Swarm' },
          { label: 'Traefik' },
          { label: 'Self-hostable' },
        ]"
        :link="{ href: 'https://github.com/Obiente/Cloud', label: 'GitHub →', target: '_blank', variant: 'green' }"
        accent-color="blue"
        theme="ob"
        :footer="{ label: 'Active development', live: true }"
      />

      <div class="ch-sub-rule">
        <span class="ch-sub-num">2.2</span>
        <h3 class="ch-sub-title">Monitoring &amp; Security</h3>
      </div>
      <p class="ch-sub-lead">Distributed observability and email authentication. Own your uptime data and your domain's reputation.</p>

      <ArticleCard
        eyebrow="Monitoring · Rust"
        title="Uppe."
        description="Peer-to-peer distributed uptime monitoring. Nodes monitor each other's services, sign results cryptographically, and publish a global uptime consensus. Monitoring that doesn't let you down."
        :tags="[
          { label: 'Rust', variant: 'rust' },
          { label: 'P2P · GossipSub' },
          { label: 'Astro' },
        ]"
        :link="{ href: 'https://uppe.rs', label: 'uppe.rs →', target: '_blank', variant: 'green' }"
        accent-color="orange"
        theme="ob"
        :footer="{ label: '9 stars · AGPL-3.0' }"
      />

      <ArticleCard
        eyebrow="Email Security"
        title="DMARC"
        description="Analyze and monitor DMARC aggregate reports. Detects email spoofing, enforces domain policies, sends real-time alerts, and gives you complete data ownership. Free for individuals and small teams."
        :tags="[
          { label: 'SPF & DKIM' },
          { label: 'Real-time alerts' },
          { label: 'AGPL-3.0', variant: 'green' },
        ]"
        :link="{ href: 'https://dmarc.obiente.com', label: 'Live →', target: '_blank', variant: 'green' }"
        accent-color="purple"
        theme="ob"
        :footer="{ label: 'Alpha · Free tier' }"
      />
    </PageArticle>

    <!-- ── Ch. 03: Visual Journal ── -->
    <PageArticle
      chapter-num="03"
      chapter-label="In Progress"
      watermark="VISUALS"
      title="Visual Journal"
      tagline="Real places. Real moments. No filters that don't belong."
      description="A first-person photo journal documenting places, light, and seconds worth keeping. Editorial grid layouts, behind-the-shot process notes, and zero stock imagery. Launching Q3 2026."
      theme="pink"
      :marquee-items="['First-Person Photography', 'Editorial Grid', 'Behind the Shot', 'No Stock Imagery', 'Real Moments', 'Q3 2026', 'Film + Digital']"
    >
      <div class="ch-sub-rule">
        <span class="ch-sub-num">3.1</span>
        <h3 class="ch-sub-title">The Journal</h3>
      </div>
      <p class="ch-sub-lead">A photo journal built as an editorial publication — every shoot documented front to back.</p>

      <ArticleCard
        :wide="true"
        eyebrow="Coming · Q3 2026"
        title="Photo Journal"
        description="Curated editorial photo grids. Shoots documented front-to-back — location context, lighting notes, and what the shot was going for. Every image tells its own story and something larger."
        :tags="[
          { label: 'Photography' },
          { label: 'Editorial Design' },
          { label: 'Nuxt Image' },
          { label: 'Film + Digital' },
        ]"
        status="In development"
        theme="darker"
        accent-color="pink"
      />
      <div class="ch-sub-rule">
        <span class="ch-sub-num">3.2</span>
        <h3 class="ch-sub-title">Process</h3>
      </div>
      <p class="ch-sub-lead">Gear and workflow. The kit enables the vision — nothing more.</p>
      <ArticleCard
        eyebrow="Process · Gear"
        title="Kit & Workflow"
        description="Canon EOS R + vintage glass. Lightroom for tones, Capture One for raw control. The gear matters less than what you choose to point it at."
        :tags="[
          { label: 'Canon EOS R' },
          { label: 'Lightroom' },
          { label: 'Capture One' },
        ]"
        theme="darker"
      />
    </PageArticle>

    <!-- ── Ch. 04: Listening ── -->
    <PageArticle
      chapter-num="04"
      chapter-label="stats.fm"
      watermark="MUSIC"
      title="Listening"
      tagline="Music is the measure."
      description="What plays while I code. Albums, artists, and tracks tracked by total listening time — not just stream count. A weighted view of taste, not the algorithm's."
      theme="purple"
      :marquee-items="['stats.fm', 'Weighted Scoring', '250+ Artists Tracked', 'Always Listening', 'Stream History', 'Custom Algorithm', 'Listening Time']"
      :footer-links="[
        { href: '/stats.fm/verycrunchy', label: 'See my full stats →' },
      ]"
    >

      <div class="ch-sub-rule">
        <span class="ch-sub-num">4.1</span>
        <h3 class="ch-sub-title">The Tool</h3>
      </div>
      <p class="ch-sub-lead">A better way to see what you actually listen to — weighted by time, not algorithmic popularity.</p>

      <ArticleCard
        :wide="true"
        eyebrow="Music · Web App"
        title="Better stats.fm"
        description="stats.fm re-ranked by a custom weighted algorithm. Balances stream count against total listening time to surface what you've genuinely been deep in — not what happened to shuffle past."
        :tags="[
          { label: 'Nuxt 3' },
          { label: 'stats.fm API' },
          { label: 'TypeScript' },
          { label: 'Weighted scoring', variant: 'purple' },
        ]"
        :link="{ href: '/stats.fm/verycrunchy', label: 'Open →' }"
        accent-color="purple"
        theme="dark"
        :footer="{ label: 'Always up to date', live: true }"
      />

      <div class="ch-sub-rule">
        <span class="ch-sub-num">4.2</span>
        <h3 class="ch-sub-title">Listening Habits</h3>
      </div>
      <p class="ch-sub-lead">Genre, rotation, and the music that's been in the background while building everything above.</p>

      <ArticleCard
        eyebrow="Currently Into"
        title="Taste Profile"
        description="Heavy rotation: ambient, math rock, lo-fi hip hop, and occasional hyperpop detours. Favourite artists tend to produce both the most and the least popular music in my library at the same time."
        :tags="[
          { label: 'Ambient' },
          { label: 'Math Rock' },
          { label: 'Lo-fi Hip Hop' },
          { label: 'Hyperpop', variant: 'purple' },
        ]"
        theme="dark"
      />

      <p class="para-card">Listening habits say a lot about the headspace you're in. An algorithm knows what you played; this tool knows what you actually heard. There's a difference — and it shows when you trace your own taste over time.</p>

    </PageArticle>

    <!-- ── Ch. 05: About Me ── -->
    <PageArticle
      chapter-num="05"
      watermark="ABOUT"
      title="About Me"
      tagline="Self-taught. Ship-first. Always building."
      theme="white"
    >

      <div class="ch-sub-rule">
        <span class="ch-sub-num">5.1</span>
        <h3 class="ch-sub-title">Background</h3>
      </div>
      <p class="ch-sub-lead">The longer story behind the shorter bio.</p>

      <ArticleCard
        :wide="true"
        eyebrow="Who I Am"
        title="Background"
        theme="dark"
      >
        <div class="space-y-4 text-[0.9rem] leading-relaxed text-zinc-400">
          <p>I'm a self-taught developer, mostly working in TypeScript, Vue, and Go. I got into coding because I wanted to build things I actually cared about — and I've been doing exactly that ever since.</p>
          <p>I focus on the full product: a backend that's reliable, a frontend that responds instantly, and the small design decisions that take something from "it works" to "it's <em>good</em>." I build in public, ship fast, and iterate on real feedback.</p>
          <p>When I'm not coding I'm shooting photos, gaming, or going deep on some random engineering problem. This site is where all of that connects.</p>
        </div>
      </ArticleCard>

      <p class="para-card">I don't have a CS degree or a bootcamp certificate. I have GitHub repos, production apps, and a habit of reading source code until I understand exactly how something works. That's the background.</p>

      <div class="ch-sub-rule">
        <span class="ch-sub-num">5.2</span>
        <h3 class="ch-sub-title">Stack</h3>
      </div>
      <p class="ch-sub-lead">The tools I reach for first. The rest I pick up as needed.</p>

      <ArticleCard
        :wide="true"
        eyebrow="Languages & Frameworks"
        title="What I Build With"
        theme="dark"
      >
        <div class="mt-3 flex flex-wrap gap-2">
          <span class="stack-chip stack-chip--blue">TypeScript</span>
          <span class="stack-chip stack-chip--blue">Vue 3</span>
          <span class="stack-chip stack-chip--blue">Nuxt 3</span>
          <span class="stack-chip stack-chip--blue">Node.js</span>
          <span class="stack-chip stack-chip--go">Go</span>
          <span class="stack-chip">Tailwind CSS</span>
          <span class="stack-chip">GSAP</span>
          <span class="stack-chip">Docker</span>
          <span class="stack-chip">WebSockets</span>
          <span class="stack-chip">Vite</span>
          <span class="stack-chip">PostgreSQL</span>
          <span class="stack-chip">Redis</span>
        </div>
      </ArticleCard>

      <div class="ch-sub-rule">
        <span class="ch-sub-num">5.3</span>
        <h3 class="ch-sub-title">Find Me</h3>
      </div>
      <p class="ch-sub-lead">Where I post code, ships, and the occasional thought.</p>

      <ArticleCard
        eyebrow="Links"
        title="Online"
        theme="dark"
      >
        <nav class="mt-2">
          <a href="https://github.com/verycrunchy" target="_blank" rel="noopener" class="story-link">
            <span>GitHub</span><span class="slmeta">@verycrunchy</span>
          </a>
          <a href="https://obiente.com" target="_blank" rel="noopener" class="story-link">
            <span>Obiente</span><span class="slmeta">Founder &amp; CEO</span>
          </a>
          <a href="https://ko-fi.com/verycrunchy" target="_blank" rel="noopener" class="story-link">
            <span>Ko-fi</span><span class="slmeta">Support &amp; tips</span>
          </a>
          <a href="https://github.com/sponsors/verycrunchy" target="_blank" rel="noopener" class="story-link">
            <span>GitHub Sponsors</span><span class="slmeta">Monthly</span>
          </a>
        </nav>
      </ArticleCard>

      <ArticleCard
        eyebrow="Availability"
        title="Freelance"
        description="Open for interesting projects — fullstack development, Vue/Nuxt apps, Go backends, and dev tooling. Reach out via GitHub or ko-fi."
        :tags="[
          { label: 'Available', variant: 'green' },
          { label: 'Fullstack' },
          { label: 'Remote' },
        ]"
        :link="{ href: 'https://github.com/verycrunchy', label: 'Get in touch →', target: '_blank' }"
        accent-color="green"
        theme="dark"
      />

    </PageArticle>

    <!-- ── Ch. 06: Supporters ── -->
    <PageArticle
      chapter-num="06"
      watermark="THANKS"
      title="Supporters"
      tagline="Reader-supported, not ad-supported."
      description="Everything I build is free, open source, and maintained on my own time. Support goes directly toward keeping it that way."
      theme="blue"
    >

      <div class="ch-sub-rule">
        <span class="ch-sub-num">6.1</span>
        <h3 class="ch-sub-title">Current Supporters</h3>
      </div>
      <p class="ch-sub-lead">People who've backed this work. Thank you.</p>

      <div class="ch-full">
        <SponsorsList />
      </div>

      <div class="ch-sub-rule">
        <span class="ch-sub-num">6.2</span>
        <h3 class="ch-sub-title">Back This Work</h3>
      </div>
      <p class="ch-sub-lead">If something I've built was useful — this is how to say thanks.</p>

      <div class="ch-full">
        <DonationOptions />
      </div>

    </PageArticle>
    <div class="book-overlay-nav">
      <button
        type="button"
        class="book-edge-nav book-edge-nav--prev"
        :disabled="activeBookPage === 0"
        aria-label="Go to previous chapter"
        @click="goToPrevBookPage"
      >
        <span aria-hidden="true">←</span>
      </button>
      <div class="book-page-status" aria-live="polite">
        <span class="book-page-label">Chapter</span>
        <strong>{{ String(activeBookPage + 1).padStart(2, '0') }}</strong>
        <span>/ {{ String(totalBookPages).padStart(2, '0') }}</span>
      </div>
      <button
        type="button"
        class="book-edge-nav book-edge-nav--next"
        :disabled="activeBookPage === totalBookPages - 1"
        aria-label="Go to next chapter"
        @click="goToNextBookPage"
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
    </div>
    </section>

  </main>
</template>


<style>
  :root {
    --primary: #c9d1d9;
    --bg-color: #0b0d11;
    --accent: #8ea8c3;
    --grain-overlay: url(/grain.svg);
    cursor: none;
    transition: background 1s, color 1s;
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
  }

  .book {
    position: relative;
    min-height: var(--book-scroll-span, 560vh);
    margin-top: 1rem;
  }

  .book-shell {
    position: sticky;
    top: 5.5rem;
    height: calc(100dvh - 7rem);
    min-height: 42rem;
    perspective: 2200px;
    transform-style: preserve-3d;
    overflow: visible;
  }

  .book-shell > .pa-wrap {
    position: absolute;
    inset: 0;
    margin: 0;
    height: auto;
  }

  .book-shell > .pa-wrap::before,
  .book-shell > .pa-wrap::after {
    display: none;
  }

  .book-shell > .pa-wrap:not(.is-active) .pa-root {
    box-shadow: 0 20px 44px -30px rgba(0, 0, 0, 0.4);
  }

  .book-overlay-nav {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .book-page-status,
  .book-edge-nav {
    pointer-events: auto;
  }

  .book-page-status {
    position: absolute;
    top: -0.2rem;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid rgba(142, 168, 195, 0.22);
    background: rgba(10, 12, 17, 0.76);
    backdrop-filter: blur(12px);
    border-radius: 999px;
    padding: 0.42rem 0.8rem;
    color: #d4d4d8;
    box-shadow: 0 14px 30px -24px rgba(0, 0, 0, 0.8);
  }

  .book-page-label {
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #a1a1aa;
  }

  .book-page-status strong {
    font-size: 0.84rem;
    color: #f4f4f5;
  }

  .book-edge-nav {
    position: absolute;
    top: 50%;
    width: 3rem;
    height: 3rem;
    display: grid;
    place-items: center;
    border: 1px solid rgba(142, 168, 195, 0.24);
    background: rgba(10, 12, 17, 0.76);
    color: #d4d4d8;
    border-radius: 999px;
    font-size: 1.15rem;
    cursor: none;
    transform: translateY(-50%);
    backdrop-filter: blur(12px);
    box-shadow: 0 14px 30px -24px rgba(0, 0, 0, 0.8);
    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
  }

  .book-edge-nav--prev {
    left: -1.5rem;
  }

  .book-edge-nav--next {
    right: -1.5rem;
  }

  .book-edge-nav:hover:not(:disabled) {
    background: rgba(142, 168, 195, 0.14);
    border-color: rgba(142, 168, 195, 0.48);
    color: #f4f4f5;
    transform: translateY(-50%) scale(1.04);
  }

  .book-edge-nav:disabled {
    opacity: 0.38;
    cursor: default;
  }

  /* ── Hero typography ──────────────────────────── */
  .hero-title {
    font-family: "Syne", sans-serif;
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
    background: linear-gradient(135deg, #e2e8f0 0%, #8ea8c3 40%, #b4c8db 65%, #e2e8f0 100%);
    background-size: 250% 250%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 8s ease infinite;
  }

  @keyframes shimmer {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .italicline {
    font-family: "Instrument Serif", serif;
    font-style: italic;
    font-size: clamp(1.1rem, 2.5vw, 1.35rem);
    color: #a1a1aa;
    line-height: 1.5;
  }

  .live-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.8);
    animation: pulse-dot 2.4s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.82); }
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
    font-family: "Syne", sans-serif;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: #52525b;
  }

  .ch-num--green { color: rgba(74, 222, 128, 0.55); }

  .ch-title {
    font-family: "Syne", sans-serif;
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
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(113, 113, 122, 0.18);
  }

  .ch-sub-num {
    font-family: "Syne", sans-serif;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: #52525b;
    white-space: nowrap;
  }

  .ch-sub-title {
    font-family: "Syne", sans-serif;
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
  }

  /* ── Paragraph card (editorial text block) ───── */
  .para-card {
    padding: 1.5rem 1.75rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(113, 113, 122, 0.14);
    background: rgba(12, 13, 18, 0.3);
    font-family: "Instrument Serif", serif;
    font-style: italic;
    font-size: 1rem;
    line-height: 1.875;
    color: #6b7280;
  }

  .para-card::first-letter {
    font-size: 3.5rem;
    font-weight: 400;
    line-height: 0.72;
    float: left;
    margin-right: 0.1rem;
    margin-bottom: 0;
    color: #71717a;
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
    transform: translate(-50%, -50%);
    border-radius: 50%;
    top: -100px;
    left: 50px;
    color: var(--accent);
    filter: blur(1px) drop-shadow(0 0 8px rgba(142, 168, 195, 0.8));
    z-index: 50;
    opacity: 1;
    line-height: 0px;
    transition: transform 0.1s ease-out;
  }

  @keyframes spin {
    from { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
    to   { transform: translate(-50%, -50%) rotate(360deg) scale(1.1); }
  }

  @keyframes blink {
    0%, 100% { opacity: 0.8; }
    50%       { opacity: 0.4; }
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
    transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .hover {
    transition: transform 0.3s ease, filter 0.3s ease;
  }

  .hover:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 12px 30px rgba(14, 20, 29, 0.5));
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
