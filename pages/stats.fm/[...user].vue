    <script setup lang="ts">
  type artists = {
    id: number;
    name: string;
  }[];

  interface Track {
    streams: number;
    playedMs: number;
    track: {
      id: number;
      name: string;
      artists: artists;
      albums: {
        image: string;
      }[];
    };
  }
  interface Album {
    id: number;
    streams: number;
    playedMs: number;
    album: {
      id: number;
      name: string;
      artists: artists;
      image: string;
    };
  }
  interface Artist {
    id: number;
    streams: number;
    playedMs: number;
    artist: {
      id: number;
      name: string;
      image: string;
    };
  }
  interface User {
    displayName: string;
    image: string;
  }

  const rangeModes = [
    { id: "today", name: "today", desc: "from" },
    { id: "weeks", name: "4 weeks", desc: "from the past" },
    { id: "months", name: "6 months", desc: "from the past" },
    { id: "lifetime", name: "lifetime", desc: "" },
  ];
  const statModes = [
    { id: "genres", name: "genres" },
    { id: "tracks", name: "tracks" },
    { id: "artists", name: "artists" },
    { id: "albums", name: "albums" },
  ];

  const route = useRoute();
  const range = ref(rangeModes[2].id);
  const stats = ref(statModes[1].id);
  const setActiveTab = (newRange: string) => {
    range.value = newRange;
  };
  const setActiveStats = (newStats: string) => {
    stats.value = newStats;
  };
  const { data: user } = await useFetch<{ item: User }>(
    `https://api.stats.fm/api/v1/users/${route.params.user[0]}/`
  );

  const url = "https://stats.fm";

  useHead({
    title: user.value
      ? `${user.value.item.displayName}'s better stats.fm stats`
      : "User not found",
    meta: [
      user.value
        ? {
            name: "description",
            content: `View ${user.value.item.displayName}'s weight based stats.fm stats!`,
          }
        : {},
      user.value ? { name: "og:image", content: user.value?.item.image } : {},
      { name: "theme-color", content: "rgb(30 215 96)" },
    ],

    link: [{ rel: "icon", type: "image/x-icon", href: "/statsfm.webp" }],
  });
  const {
    data: tracks,
    execute: fetchTracks,
    status: trackStatus,
  } = await useFetch<{
    items: Track[];
  }>(`https://api.stats.fm/api/v1/users/${route.params.user[0]}/top/tracks`, {
    query: { range },
    lazy: true,
    server: false,
  });
  const {
    data: artists,
    execute: fetchArtists,
    status: artistStatus,
  } = await useFetch<{
    items: Artist[];
  }>(`https://api.stats.fm/api/v1/users/${route.params.user[0]}/top/artists`, {
    query: { range },
    lazy: true,
    server: false,
    immediate: false,
  });
  const {
    data: albums,
    execute: fetchAlbums,
    status: albumStatus,
  } = await useFetch<{
    items: Album[];
  }>(`https://api.stats.fm/api/v1/users/${route.params.user[0]}/top/albums`, {
    query: { range },
    lazy: true,
    server: false,
    immediate: false,
  });
  function filterTracks() {
    if (trackStatus.value == "idle") fetchTracks();
    return tracks.value?.items.sort((a, b) => {
      return (
        calculateCombinedScore(b.streams, b.playedMs) -
        calculateCombinedScore(a.streams, a.playedMs)
      );
    });
  }
  function filterAlbums() {
    if (albumStatus.value == "idle") fetchAlbums();
    return albums.value?.items.sort((a, b) => {
      return (
        calculateCombinedScore(b.streams, b.playedMs) -
        calculateCombinedScore(a.streams, a.playedMs)
      );
    });
  }
  function filterArtists() {
    if (artistStatus.value == "idle") fetchArtists();

    return artists.value?.items.sort((a: any, b: any) => {
      return (
        calculateCombinedScore(b.streams, b.playedMs) -
        calculateCombinedScore(a.streams, a.playedMs)
      );
    });
  }
  function calculateCombinedScore(streams: number, totalTime: number) {
    const streamWeight = 0.7 * streams;
    const timeWeight = 0.3 * (totalTime / 60000 / 2);

    return streamWeight + timeWeight;
  }

  function formatTime(ms: number) {
    const minutes = Math.floor(ms / 60000);
    return `${minutes} minutes`;
  }
</script>

<template>
  <div class="sfm-page">

    <!-- ── Not found ─────────────────────────── -->
    <div v-if="!user" class="sfm-empty">
      <p class="sfm-empty-code">404</p>
      <p class="sfm-empty-msg">User not found</p>
      <p class="sfm-empty-sub">No stats.fm user exists at this URL.</p>
    </div>

    <template v-else>
      <!-- ── Page header ────────────────────── -->
      <header class="sfm-header">
        <a :href="`${url}/${route.params.user}`" target="_blank" rel="noopener" class="sfm-user">
          <img :src="user.item.image" alt="" class="sfm-avatar" />
          <div>
            <p class="sfm-display-name">{{ user.item.displayName }}</p>
            <p class="sfm-sub-label">stats.fm profile</p>
          </div>
        </a>
        <p class="sfm-context-label">
          Top <span class="sfm-accent">{{ stats }}</span>
          <template v-if="rangeModes.find(r => r.id === range)?.desc">
            {{ " " + rangeModes.find(r => r.id === range)?.desc }}
          </template>
          <template v-if="range !== rangeModes[3].id">
            {{ " " + rangeModes.find(r => r.id === range)?.name }}
          </template>
        </p>
      </header>

      <!-- ── Sticky controls ────────────────── -->
      <div class="sfm-controls-bar">
        <div class="sfm-pill-group">
          <button
            v-for="tab in statModes"
            :key="tab.id"
            :class="['sfm-pill', { 'sfm-pill--active': stats === tab.id }]"
            @click="setActiveStats(tab.id)"
          >{{ tab.name }}</button>
        </div>
        <div class="sfm-pill-group">
          <button
            v-for="tab in rangeModes"
            :key="tab.id"
            :class="['sfm-pill', { 'sfm-pill--active': range === tab.id }]"
            @click="setActiveTab(tab.id)"
          >{{ tab.name }}</button>
        </div>
      </div>

      <!-- ── Content grid ───────────────────── -->
      <main class="sfm-grid-wrap">

        <!-- Genres placeholder -->
        <div v-if="stats === statModes[0].id" class="sfm-wip">
          <span class="sfm-wip-icon">🎵</span>
          <p class="sfm-wip-title">Genres coming soon</p>
          <p class="sfm-wip-sub">This stat mode is still being built.</p>
        </div>

        <!-- Skeleton loaders -->
        <template v-else-if="
          (stats === statModes[1].id && !tracks?.items?.length && trackStatus !== 'success') ||
          (stats === statModes[2].id && !artists?.items?.length && artistStatus !== 'success') ||
          (stats === statModes[3].id && !albums?.items?.length && albumStatus !== 'success')
        ">
          <div v-for="i in 24" :key="i" class="sfm-card sfm-card--skeleton">
            <div class="sfm-card-img skeleton"></div>
            <div class="sfm-card-body">
              <div class="skeleton sfm-skel-title"></div>
              <div class="skeleton sfm-skel-meta"></div>
            </div>
          </div>
        </template>

        <!-- Tracks -->
        <template v-else-if="stats === statModes[1].id">
          <a
            v-for="(item, index) in filterTracks()"
            :key="item.track.id"
            :href="`${url}/track/${item.track.id}`"
            target="_blank"
            rel="noopener"
            class="sfm-card"
          >
            <div class="sfm-card-img-wrap">
              <img :src="item.track.albums[0].image" :alt="item.track.name" class="sfm-card-img" loading="lazy" />
              <span class="sfm-rank">#{{ index + 1 }}</span>
            </div>
            <div class="sfm-card-body">
              <p class="sfm-card-title">{{ item.track.name }}</p>
              <p class="sfm-card-artist">{{ item.track.artists[0]?.name ?? "Unknown" }}</p>
              <div class="sfm-card-meta">
                <span>{{ item.streams }}×</span>
                <span>{{ formatTime(item.playedMs) }}</span>
              </div>
            </div>
          </a>
        </template>

        <!-- Artists -->
        <template v-else-if="stats === statModes[2].id">
          <a
            v-for="(item, index) in filterArtists()"
            :key="item.artist.id"
            :href="`${url}/artist/${item.artist.id}`"
            target="_blank"
            rel="noopener"
            class="sfm-card"
          >
            <div class="sfm-card-img-wrap">
              <img :src="item.artist.image" :alt="item.artist.name" class="sfm-card-img sfm-card-img--round" loading="lazy" />
              <span class="sfm-rank">#{{ index + 1 }}</span>
            </div>
            <div class="sfm-card-body">
              <p class="sfm-card-title">{{ item.artist.name }}</p>
              <div class="sfm-card-meta">
                <span>{{ item.streams }}×</span>
                <span>{{ formatTime(item.playedMs) }}</span>
              </div>
            </div>
          </a>
        </template>

        <!-- Albums -->
        <template v-else-if="stats === statModes[3].id">
          <a
            v-for="(item, index) in filterAlbums()"
            :key="item.album.id"
            :href="`${url}/album/${item.album.id}`"
            target="_blank"
            rel="noopener"
            class="sfm-card"
          >
            <div class="sfm-card-img-wrap">
              <img :src="item.album.image" :alt="item.album.name" class="sfm-card-img" loading="lazy" />
              <span class="sfm-rank">#{{ index + 1 }}</span>
            </div>
            <div class="sfm-card-body">
              <p class="sfm-card-title">{{ item.album.name }}</p>
              <p class="sfm-card-artist">{{ item.album.artists[0]?.name ?? "Unknown" }}</p>
              <div class="sfm-card-meta">
                <span>{{ item.streams }}×</span>
                <span>{{ formatTime(item.playedMs) }}</span>
              </div>
            </div>
          </a>
        </template>

      </main>
    </template>
  </div>
</template>

<style scoped>
  /* ── Page shell ──────────────────────────────── */
  .sfm-page {
    min-height: 100dvh;
    background-color: rgb(17 17 18);
    color: #e4e4e7;
    font-family: "IBM Plex Sans", sans-serif;
    display: flex;
    flex-direction: column;
  }

  /* ── Not found ───────────────────────────────── */
  .sfm-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 4rem 2rem;
    text-align: center;
  }
  .sfm-empty-code  { font-size: 4rem; font-weight: 700; color: rgb(30 215 96); line-height: 1; }
  .sfm-empty-msg   { font-size: 1.25rem; font-weight: 600; color: #e4e4e7; }
  .sfm-empty-sub   { font-size: 0.9rem; color: #71717a; }

  /* ── Header ─────────────────────────────────── */
  .sfm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1.5rem 1.5rem 0.75rem;
    max-width: 90rem;
    width: 100%;
    margin: 0 auto;
  }

  .sfm-user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
  }

  .sfm-avatar {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(30, 215, 96, 0.4);
  }

  .sfm-display-name {
    font-size: 1rem;
    font-weight: 600;
    color: #f4f4f5;
    line-height: 1.2;
  }

  .sfm-sub-label {
    font-size: 0.75rem;
    color: #71717a;
    margin-top: 0.1rem;
  }

  .sfm-context-label {
    font-size: 0.82rem;
    color: #71717a;
    text-align: right;
  }

  .sfm-accent {
    color: rgb(30 215 96);
    font-weight: 600;
  }

  /* ── Sticky controls ─────────────────────────── */
  .sfm-controls-bar {
    position: sticky;
    top: 3.25rem; /* matches nav height */
    z-index: 30;
    background: rgba(17, 17, 18, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(39, 39, 42, 0.8);
    padding: 0.6rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .sfm-pill-group {
    display: flex;
    background: rgb(24 24 28);
    border-radius: 0.65rem;
    padding: 0.2rem;
    gap: 0.1rem;
  }

  .sfm-pill {
    font-size: 0.8rem;
    font-weight: 500;
    color: #a1a1aa;
    background: transparent;
    border: none;
    border-radius: 0.45rem;
    padding: 0.3rem 0.85rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, background 0.15s;
    line-height: 1.4;
  }

  .sfm-pill:hover {
    color: #e4e4e7;
    background: rgba(30, 215, 96, 0.06);
  }

  .sfm-pill--active {
    color: rgb(30 215 96);
    background: rgba(30, 215, 96, 0.12);
  }

  /* ── WIP placeholder ─────────────────────────── */
  .sfm-wip {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 5rem 2rem;
    text-align: center;
  }
  .sfm-wip-icon  { font-size: 2.5rem; }
  .sfm-wip-title { font-size: 1.1rem; font-weight: 600; color: #e4e4e7; }
  .sfm-wip-sub   { font-size: 0.85rem; color: #71717a; }

  /* ── Grid ────────────────────────────────────── */
  .sfm-grid-wrap {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.85rem;
    padding: 1.25rem 1.5rem 3rem;
    max-width: 90rem;
    width: 100%;
    margin: 0 auto;
    align-items: start;
  }

  @media (min-width: 480px)  { .sfm-grid-wrap { grid-template-columns: repeat(4, 1fr); } }
  @media (min-width: 640px)  { .sfm-grid-wrap { grid-template-columns: repeat(5, 1fr); } }
  @media (min-width: 900px)  { .sfm-grid-wrap { grid-template-columns: repeat(6, 1fr); } }
  @media (min-width: 1280px) { .sfm-grid-wrap { grid-template-columns: repeat(8, 1fr); } }
  @media (min-width: 1600px) { .sfm-grid-wrap { grid-template-columns: repeat(10, 1fr); } }

  /* ── Card ────────────────────────────────────── */
  .sfm-card {
    display: flex;
    flex-direction: column;
    gap: 0;
    text-decoration: none;
    color: inherit;
    border-radius: 0.5rem;
    overflow: hidden;
    background: rgb(24 24 28);
    border: 1px solid rgba(39, 39, 42, 0.8);
    transition: border-color 0.2s, transform 0.2s;
  }

  .sfm-card:hover {
    border-color: rgba(30, 215, 96, 0.35);
    transform: translateY(-2px);
  }

  .sfm-card--skeleton {
    pointer-events: none;
  }

  /* ── Card image ──────────────────────────────── */
  .sfm-card-img-wrap {
    position: relative;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    background: rgb(30 30 34);
  }

  .sfm-card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.35s ease;
  }

  .sfm-card--skeleton .sfm-card-img {
    height: 100%;
    width: 100%;
  }

  .sfm-card:hover .sfm-card-img {
    transform: scale(1.04);
  }

  .sfm-card-img--round {
    border-radius: 0;
  }

  .sfm-rank {
    position: absolute;
    bottom: 0.35rem;
    left: 0.35rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
    background: rgba(0, 0, 0, 0.62);
    backdrop-filter: blur(4px);
    border-radius: 4px;
    padding: 0.1rem 0.35rem;
    line-height: 1.4;
  }

  /* ── Card body ───────────────────────────────── */
  .sfm-card-body {
    padding: 0.55rem 0.6rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .sfm-card-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: #e4e4e7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .sfm-card-artist {
    font-size: 0.72rem;
    color: #71717a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sfm-card-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.68rem;
    color: rgba(30, 215, 96, 0.75);
    margin-top: 0.25rem;
    flex-wrap: wrap;
  }

  /* ── Skeleton ────────────────────────────────── */
  .skeleton {
    background: linear-gradient(
      110deg,
      rgba(39, 39, 42, 0.9) 8%,
      rgba(63, 63, 70, 0.6) 18%,
      rgba(39, 39, 42, 0.9) 33%
    );
    background-size: 200% 100%;
    animation: sfm-shine 1.4s linear infinite;
    border-radius: 3px;
  }

  .sfm-skel-title {
    height: 0.7rem;
    width: 80%;
    margin-bottom: 0.3rem;
  }

  .sfm-skel-meta {
    height: 0.6rem;
    width: 55%;
  }

  @keyframes sfm-shine {
    to { background-position-x: -200%; }
  }

  /* ── Scrollbar (scoped via page bg) ──────────── */
  .sfm-page ::-webkit-scrollbar       { width: 5px; }
  .sfm-page ::-webkit-scrollbar-track { background: transparent; }
  .sfm-page ::-webkit-scrollbar-thumb { background: rgba(30, 215, 96, 0.25); border-radius: 99px; }
  .sfm-page ::-webkit-scrollbar-thumb:hover { background: rgba(30, 215, 96, 0.5); }
</style>
