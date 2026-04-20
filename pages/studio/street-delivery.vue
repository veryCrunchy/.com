<script setup lang="ts">
  import QRCode from "qrcode";
  import { computed, onMounted, reactive, ref, watch } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";
  import type {
    CmsSiteSettings,
    CmsStreetDeliveryAdminSessionSummary,
    CmsStreetDeliveryDistributionState,
  } from "~/types/directus";

  type SessionDraft = {
    status: string;
    location: string;
    photographedAtLocal: string;
    publicEnabled: boolean;
    distributionState: CmsStreetDeliveryDistributionState;
  };

  type PrintPage = {
    front: Array<CmsStreetDeliveryAdminSessionSummary | null>;
    back: Array<CmsStreetDeliveryAdminSessionSummary | null>;
  };

  const STORAGE_KEY = "street-delivery-directus-token";
  const PRINT_COLUMNS = 2;
  const PRINT_ROWS = 5;
  const CARDS_PER_PAGE = PRINT_COLUMNS * PRINT_ROWS;
  const runtimeConfig = useRuntimeConfig();
  const { data: siteSettings } = await useAsyncData<CmsSiteSettings>(
    "street-delivery-site-settings",
    async () => {
      const response = await $fetch<{ site: CmsSiteSettings }>("/api/cms/site-settings");
      return response.site;
    },
    {
      default: () => DEFAULT_CMS_SITE_SETTINGS,
    }
  );

  const origin = ref("");
  const authToken = ref("");
  const email = ref("");
  const password = ref("");
  const loginBusy = ref(false);
  const loginError = ref("");
  const loadingSessions = ref(false);
  const sessions = ref<CmsStreetDeliveryAdminSessionSummary[]>([]);
  const latestBatch = ref<CmsStreetDeliveryAdminSessionSummary[]>([]);
  const batchCount = ref(10);
  const batchPrefix = ref("");
  const batchBusy = ref(false);
  const batchError = ref("");
  const batchMessage = ref("");
  const distributionStateFilter = ref<"all" | CmsStreetDeliveryDistributionState>("all");
  const printMirrorBacks = ref(true);
  const printIncludeBacks = ref(true);
  const qrByCode = reactive<Record<string, string>>({});
  const saveBusy = reactive<Record<number, boolean>>({});
  const saveError = reactive<Record<number, string>>({});
  const deleteBusy = reactive<Record<number, boolean>>({});
  const deleteError = reactive<Record<number, string>>({});
  const copyFeedback = reactive<Record<number, string>>({});
  const drafts = reactive<Record<number, SessionDraft>>({});

  useSeoMeta({
    title: "Street Delivery Studio | veryCrunchy",
    description: "Directus-backed admin dashboard for card creation, QR card printing, and delivery.",
    robots: "noindex, nofollow",
  });

  useHead({
    bodyAttrs: {
      class: "street-delivery-studio-body",
    },
  });

  function toLocalInputValue(iso: string | null) {
    if (!iso) {
      return "";
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function syncDraft(session: CmsStreetDeliveryAdminSessionSummary) {
    drafts[session.id] = {
      status: session.status || "new",
      location: session.location || "",
      photographedAtLocal: toLocalInputValue(session.photographedAt),
      publicEnabled: session.publicEnabled,
      distributionState: session.distributionState,
    };
  }

  function syncDrafts(nextSessions: CmsStreetDeliveryAdminSessionSummary[]) {
    for (const session of nextSessions) {
      syncDraft(session);
    }
  }

  const displayBaseUrl = computed(() =>
    String(runtimeConfig.public.siteUrlDisplay || origin.value || "").replace(/\/$/, "")
  );

  function cardUrl(session: CmsStreetDeliveryAdminSessionSummary) {
    return `${displayBaseUrl.value}${session.publicPath}`;
  }

  function formatDisplayDate(value: string | null) {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function distributionStateLabel(state: CmsStreetDeliveryDistributionState) {
    if (state === "printed") {
      return "Printed";
    }

    if (state === "sent") {
      return "Sent";
    }

    return "Available";
  }

  function fillMessageTemplate(
    template: string,
    replacements: {
      formLink?: string;
      galleryLink?: string;
    }
  ) {
    return String(template || "")
      .replace(/\[(form link|form_link)\]/gi, replacements.formLink || "")
      .replace(/\{\{\s*form_link\s*\}\}/gi, replacements.formLink || "")
      .replace(/\[(gallery link|gallery_link)\]/gi, replacements.galleryLink || "")
      .replace(/\{\{\s*gallery_link\s*\}\}/gi, replacements.galleryLink || "")
      .trim();
  }

  async function adminFetch<T>(path: string, options: Parameters<typeof $fetch<T>>[1] = {}) {
    return await $fetch<T>(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${authToken.value}`,
      },
    });
  }

  async function refreshSessions() {
    if (!authToken.value) {
      return;
    }

    loadingSessions.value = true;
    loginError.value = "";

    try {
      const response = await adminFetch<{ sessions: CmsStreetDeliveryAdminSessionSummary[] }>(
        "/api/cms/street-delivery/admin/sessions"
      );

      sessions.value = response.sessions;
      syncDrafts(response.sessions);
    } catch (error: unknown) {
      loginError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not load sessions.")
          : "Could not load sessions.";

      if (
        typeof error === "object" &&
        error &&
        "statusCode" in error &&
        Number((error as { statusCode?: number }).statusCode) === 401
      ) {
        authToken.value = "";
        localStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      loadingSessions.value = false;
    }
  }

  async function login() {
    loginBusy.value = true;
    loginError.value = "";

    try {
      const response = await $fetch<{ accessToken: string }>(
        "/api/cms/street-delivery/admin/auth/login",
        {
          method: "POST",
          body: {
            email: email.value,
            password: password.value,
          },
        }
      );

      authToken.value = response.accessToken;
      localStorage.setItem(STORAGE_KEY, response.accessToken);
      password.value = "";
      await refreshSessions();
    } catch (error: unknown) {
      loginError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Login failed.")
          : "Login failed.";
    } finally {
      loginBusy.value = false;
    }
  }

  function logout() {
    authToken.value = "";
    sessions.value = [];
    latestBatch.value = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  async function createBatch() {
    batchBusy.value = true;
    batchError.value = "";
    batchMessage.value = "";

    try {
      const response = await adminFetch<{ sessions: CmsStreetDeliveryAdminSessionSummary[] }>(
        "/api/cms/street-delivery/admin/sessions/batch",
        {
          method: "POST",
          body: {
            count: batchCount.value,
            prefix: batchPrefix.value || null,
          },
        }
      );

      latestBatch.value = response.sessions;
      sessions.value = [...response.sessions, ...sessions.value];
      syncDrafts(response.sessions);
      batchMessage.value = `Created ${response.sessions.length} secure QR cards. Add location and photo date later from the session workspace.`;
    } catch (error: unknown) {
      batchError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not create batch.")
          : "Could not create batch.";
    } finally {
      batchBusy.value = false;
    }
  }

  function replaceSessionState(nextSession: CmsStreetDeliveryAdminSessionSummary) {
    const index = sessions.value.findIndex((session) => session.id === nextSession.id);
    if (index !== -1) {
      sessions.value[index] = nextSession;
    }

    const latestIndex = latestBatch.value.findIndex((session) => session.id === nextSession.id);
    if (latestIndex !== -1) {
      latestBatch.value[latestIndex] = nextSession;
    }

    syncDraft(nextSession);
  }

  async function saveSession(sessionId: number, regenerateGalleryToken = false) {
    const draft = drafts[sessionId];

    if (!draft) {
      return;
    }

    saveBusy[sessionId] = true;
    saveError[sessionId] = "";

    try {
      const response = await adminFetch<{ session: CmsStreetDeliveryAdminSessionSummary }>(
        `/api/cms/street-delivery/admin/sessions/${sessionId}`,
        {
          method: "PATCH",
          body: {
            status: draft.status,
            location: draft.location || null,
            photographedAt: draft.photographedAtLocal
              ? new Date(draft.photographedAtLocal).toISOString()
              : null,
            publicEnabled: draft.publicEnabled,
            distributionState: draft.distributionState,
            regenerateGalleryToken,
          },
        }
      );
      replaceSessionState(response.session);
    } catch (error: unknown) {
      saveError[sessionId] =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not save session.")
          : "Could not save session.";
    } finally {
      saveBusy[sessionId] = false;
    }
  }

  async function setDistributionState(sessionId: number, distributionState: CmsStreetDeliveryDistributionState) {
    saveBusy[sessionId] = true;
    saveError[sessionId] = "";

    try {
      const response = await adminFetch<{ session: CmsStreetDeliveryAdminSessionSummary }>(
        `/api/cms/street-delivery/admin/sessions/${sessionId}`,
        {
          method: "PATCH",
          body: {
            distributionState,
          },
        }
      );

      replaceSessionState(response.session);
    } catch (error: unknown) {
      saveError[sessionId] =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not update code state.")
          : "Could not update code state.";
    } finally {
      saveBusy[sessionId] = false;
    }
  }

  async function deleteSession(sessionId: number) {
    deleteBusy[sessionId] = true;
    deleteError[sessionId] = "";

    try {
      await adminFetch(`/api/cms/street-delivery/admin/sessions/${sessionId}`, {
        method: "DELETE",
      });

      sessions.value = sessions.value.filter((session) => session.id !== sessionId);
      latestBatch.value = latestBatch.value.filter((session) => session.id !== sessionId);
      delete drafts[sessionId];
    } catch (error: unknown) {
      deleteError[sessionId] =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not delete code.")
          : "Could not delete code.";
    } finally {
      deleteBusy[sessionId] = false;
    }
  }

  async function copyRequestMessage(session: CmsStreetDeliveryAdminSessionSummary) {
    const text = fillMessageTemplate(siteSettings.value.streetDeliveryRequestMessageTemplate, {
      formLink: cardUrl(session),
    });

    await navigator.clipboard.writeText(text);
    copyFeedback[session.id] = "Request message copied.";
  }

  function prepareReprint(session: CmsStreetDeliveryAdminSessionSummary) {
    latestBatch.value = [session];
    batchMessage.value = `Queued ${session.code} for reprint.`;
  }

  async function refreshQrCodes() {
    const batch = latestBatch.value;

    if (!batch.length || !displayBaseUrl.value) {
      return;
    }

    await Promise.all(
      batch.map(async (session) => {
        const targetUrl = cardUrl(session);

        if (qrByCode[session.code]) {
          return;
        }

        try {
          qrByCode[session.code] = await QRCode.toDataURL(targetUrl, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 520,
            color: {
              dark: "#111111",
              light: "#ffffff",
            },
          });
        } catch {
          qrByCode[session.code] = "";
        }
      })
    );
  }

  function buildPrintPages(items: CmsStreetDeliveryAdminSessionSummary[]) {
    const pages: PrintPage[] = [];

    for (let offset = 0; offset < items.length; offset += CARDS_PER_PAGE) {
      const pageItems = items.slice(offset, offset + CARDS_PER_PAGE);
      const padded = [...pageItems];

      while (padded.length < CARDS_PER_PAGE) {
        padded.push(null as unknown as CmsStreetDeliveryAdminSessionSummary);
      }

      const front = padded.map((item) => item || null);
      const back: Array<CmsStreetDeliveryAdminSessionSummary | null> = [];

      for (let row = 0; row < PRINT_ROWS; row += 1) {
        const rowStart = row * PRINT_COLUMNS;
        const rowItems = front.slice(rowStart, rowStart + PRINT_COLUMNS);
        back.push(...(printMirrorBacks.value ? [...rowItems].reverse() : rowItems));
      }

      pages.push({ front, back });
    }

    return pages;
  }

  const printablePages = computed(() => buildPrintPages(latestBatch.value));
  const filteredSessions = computed(() => {
    if (distributionStateFilter.value === "all") {
      return sessions.value;
    }

    return sessions.value.filter((session) => session.distributionState === distributionStateFilter.value);
  });
  const availableCount = computed(() => sessions.value.filter((session) => session.distributionState === "available").length);
  const printedCount = computed(() => sessions.value.filter((session) => session.distributionState === "printed").length);
  const sentCount = computed(() => sessions.value.filter((session) => session.distributionState === "sent").length);
  const latestBatchAllPrinted = computed(
    () => latestBatch.value.length > 0 && latestBatch.value.every((session) => session.distributionState === "printed")
  );

  const printInstruction = computed(() =>
    printMirrorBacks.value
      ? "Print double-sided on A4 at 100% scale and flip on the long edge."
      : "Print double-sided on A4 at 100% scale with your preferred duplex setting."
  );

  async function printLatestBatch() {
    if (!latestBatch.value.length) {
      return;
    }

    const unprintedBatch = latestBatch.value.filter((session) => session.distributionState === "available");

    if (unprintedBatch.length) {
      await Promise.all(unprintedBatch.map((session) => setDistributionState(session.id, "printed")));
    }

    window.print();
  }

  watch(
    () => latestBatch.value.map((session) => `${session.id}:${cardUrl(session)}:${session.distributionState}`).join("|"),
    () => {
      void refreshQrCodes();
    }
  );

  onMounted(async () => {
    origin.value = window.location.origin;
    const storedToken = localStorage.getItem(STORAGE_KEY);

    if (storedToken) {
      authToken.value = storedToken;
      await refreshSessions();
    }
  });
</script>

<template>
  <main class="studio-page">
    <section class="studio-shell">
      <div class="studio-header no-print">
        <div>
          <p class="studio-kicker">Studio</p>
          <h1>Street Delivery</h1>
          <p class="studio-lede">
            Generate secure QR cards, print front and back sheets that line up on A4, and manage delivery without bouncing
            between tools.
          </p>
        </div>
        <button
          v-if="authToken"
          class="studio-secondary"
          type="button"
          @click="logout"
        >
          Log out
        </button>
      </div>

      <section v-if="!authToken" class="studio-login no-print">
        <div class="login-copy">
          <p class="studio-eyebrow">Directus Auth</p>
          <h2>Sign in to your photo handoff studio</h2>
          <p>Use your Directus account. The dashboard respects Directus permissions instead of inventing a second auth system.</p>
        </div>

        <form class="studio-form" @submit.prevent="login">
          <label class="studio-field">
            <span>Email</span>
            <input v-model="email" type="email" autocomplete="username" required>
          </label>
          <label class="studio-field">
            <span>Password</span>
            <input v-model="password" type="password" autocomplete="current-password" required>
          </label>
          <p v-if="loginError" class="studio-error">{{ loginError }}</p>
          <button class="studio-primary" :disabled="loginBusy" type="submit">
            {{ loginBusy ? "Signing in…" : "Sign in" }}
          </button>
        </form>
      </section>

      <template v-else>
        <section class="studio-tools no-print">
          <div class="studio-panel">
            <div class="studio-panel-head">
              <div>
                <p class="studio-eyebrow">Create</p>
                <h2>New card batch</h2>
              </div>
              <button
                class="studio-secondary"
                type="button"
                :disabled="loadingSessions"
                @click="refreshSessions"
              >
                {{ loadingSessions ? "Refreshing…" : "Refresh list" }}
              </button>
            </div>

            <form class="studio-grid-form" @submit.prevent="createBatch">
              <label class="studio-field">
                <span>How many cards?</span>
                <input v-model.number="batchCount" type="number" min="1" max="200" required>
              </label>
              <label class="studio-field">
                <span>Optional prefix</span>
                <input v-model="batchPrefix" placeholder="AMS or KINGSDAY if you want a visible batch marker">
              </label>
              <p class="studio-hint studio-grid-full">
                Cards are created blank on purpose. Add location and photo date later, once the shoot has happened.
              </p>
              <p v-if="batchError" class="studio-error studio-grid-full">{{ batchError }}</p>
              <p v-else-if="batchMessage" class="studio-success studio-grid-full">{{ batchMessage }}</p>
              <div class="studio-actions studio-grid-full">
                <button class="studio-primary" :disabled="batchBusy" type="submit">
                  {{ batchBusy ? "Creating…" : "Create secure QR batch" }}
                </button>
                <button
                  class="studio-secondary"
                  type="button"
                  :disabled="!latestBatch.length"
                  @click="printLatestBatch"
                >
                  Print card sheets
                </button>
              </div>
            </form>
          </div>
        </section>

        <section v-if="latestBatch.length" class="studio-panel studio-print-panel">
          <div class="studio-panel-head no-print">
            <div>
              <p class="studio-eyebrow">Print</p>
              <h2>Front / Back A4 sheets</h2>
            </div>
            <p class="studio-hint">
              {{ latestBatch.length }} cards ready · {{ latestBatchAllPrinted ? "reprint batch" : "available batch" }}
            </p>
          </div>

          <div class="print-options no-print">
            <label class="studio-toggle is-inline">
              <input v-model="printIncludeBacks" type="checkbox">
              <span>Include back pages</span>
            </label>
            <label class="studio-toggle is-inline">
              <input v-model="printMirrorBacks" type="checkbox">
              <span>Mirror backs for long-edge duplex printing</span>
            </label>
          </div>

          <p class="studio-hint no-print">
            {{ printInstruction }} Cut directly on the card borders. The sheets are laid out as 2 columns × 5 rows on A4.
            Display URL: {{ displayBaseUrl || "set NUXT_PUBLIC_SITE_URL_DISPLAY to use your production domain here" }}.
          </p>

          <div class="sheet-stack">
            <div
              v-for="(page, pageIndex) in printablePages"
              :key="`sheet-${pageIndex}`"
              class="sheet-group"
            >
              <section class="sheet-card">
                <div class="sheet-caption no-print">
                  <strong>Front {{ pageIndex + 1 }}</strong>
                  <span>Page {{ pageIndex + 1 }} of {{ printablePages.length }}</span>
                </div>

                <div class="sheet-grid">
                  <article
                    v-for="(session, slotIndex) in page.front"
                    :key="`front-${pageIndex}-${slotIndex}`"
                    class="print-card print-card-front"
                    :class="{ 'is-empty': !session }"
                  >
                    <template v-if="session">
                      <div class="card-topline">
                        <p class="print-brand">veryCrunchy</p>
                        <p class="print-type">street delivery</p>
                      </div>

                      <div class="card-front-body">
                        <div class="qr-shell">
                          <img
                            v-if="qrByCode[session.code]"
                            :src="qrByCode[session.code]"
                            :alt="`QR code for ${cardUrl(session)}`"
                            class="card-qr"
                          >
                        </div>

                        <div class="card-front-copy">
                          <h3>I photographed you today.</h3>
                          <p>Scan the QR code to request your photos for free.</p>
                          <p class="print-url">{{ cardUrl(session) }}</p>
                          <p class="print-code">{{ session.code }}</p>
                        </div>
                      </div>
                    </template>
                  </article>
                </div>
              </section>

              <section v-if="printIncludeBacks" class="sheet-card">
                <div class="sheet-caption no-print">
                  <strong>Back {{ pageIndex + 1 }}</strong>
                  <span>{{ printMirrorBacks ? "Mirrored for duplex" : "Direct order" }}</span>
                </div>

                <div class="sheet-grid">
                  <article
                    v-for="(session, slotIndex) in page.back"
                    :key="`back-${pageIndex}-${slotIndex}`"
                    class="print-card print-card-back"
                    :class="{ 'is-empty': !session }"
                  >
                    <template v-if="session">
                      <div class="card-back-layout">
                        <div class="card-back-copy">
                          <p class="print-brand">veryCrunchy</p>
                          <h3>Get your photos</h3>
                          <ol class="back-steps">
                            <li>Scan the front of this card</li>
                            <li>Leave one way to reach you</li>
                            <li>I’ll send the photos once I’ve sorted them</li>
                          </ol>
                          <p class="print-foot">No spam. Just your photos.</p>
                        </div>

                        <div class="card-back-meta">
                          <p class="print-code">{{ session.code }}</p>
                          <p class="print-url">{{ cardUrl(session) }}</p>
                          <p v-if="session.location" class="back-meta-line">{{ session.location }}</p>
                          <p v-if="formatDisplayDate(session.photographedAt)" class="back-meta-line">
                            {{ formatDisplayDate(session.photographedAt) }}
                          </p>
                        </div>
                      </div>
                    </template>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section class="studio-panel no-print">
          <div class="studio-panel-head">
            <div>
              <p class="studio-eyebrow">Manage</p>
              <h2>Sessions</h2>
            </div>
            <p class="studio-hint">{{ sessions.length }} total · {{ availableCount }} available · {{ printedCount }} printed · {{ sentCount }} sent</p>
          </div>

          <div class="session-toolbar">
            <label class="studio-field session-filter">
              <span>Code state</span>
              <select v-model="distributionStateFilter">
                <option value="all">All sessions</option>
                <option value="available">Available only</option>
                <option value="printed">Printed only</option>
                <option value="sent">Sent only</option>
              </select>
            </label>
          </div>

          <p class="studio-hint">Request and delivery message templates are configurable in Directus under site settings.</p>

          <div class="session-list">
            <article
              v-for="session in filteredSessions"
              :key="session.id"
              class="session-card"
            >
              <div class="session-head">
                <div class="session-id">
                  <p class="session-code">{{ session.code }}</p>
                  <p class="session-meta">
                    <span
                      :class="{
                        'is-printed': session.distributionState === 'printed',
                        'is-available': session.distributionState === 'available',
                        'is-sent': session.distributionState === 'sent',
                      }"
                      class="session-print-badge"
                    >
                      {{ distributionStateLabel(session.distributionState) }}
                    </span>
                    <span>{{ session.contactCount }} {{ session.contactCount === 1 ? 'contact' : 'contacts' }}</span>
                    <span>{{ session.photoCount }} {{ session.photoCount === 1 ? 'photo' : 'photos' }}</span>
                  </p>
                </div>
                <div class="session-links">
                  <a :href="session.publicPath" target="_blank" rel="noopener">Request page</a>
                  <a
                    v-if="session.galleryPath"
                    :href="session.galleryPath"
                    target="_blank"
                    rel="noopener"
                  >
                    Gallery
                  </a>
                </div>
              </div>

              <div class="studio-grid-form session-grid">
                <label class="studio-field">
                  <span>Status</span>
                  <select v-model="drafts[session.id].status">
                    <option value="new">New</option>
                    <option value="matched">Matched</option>
                    <option value="delivered">Delivered</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label class="studio-field">
                  <span>Location</span>
                  <input v-model="drafts[session.id].location" placeholder="Optional">
                </label>
                <label class="studio-field">
                  <span>Photographed at</span>
                  <input v-model="drafts[session.id].photographedAtLocal" type="datetime-local">
                </label>
                <label class="studio-field">
                  <span>Code state</span>
                  <select v-model="drafts[session.id].distributionState">
                    <option value="available">Available</option>
                    <option value="printed">Printed</option>
                    <option value="sent">Sent</option>
                  </select>
                </label>
                <label class="studio-toggle">
                  <input v-model="drafts[session.id].publicEnabled" type="checkbox">
                  <span>Public page enabled</span>
                </label>
              </div>

              <p v-if="session.latestContact" class="session-contact">
                <span class="session-contact-label">Latest contact</span>
                {{ session.latestContact.method }} · {{ session.latestContact.value }}
                <span v-if="session.latestContact.description"> · {{ session.latestContact.description }}</span>
              </p>

              <p v-if="saveError[session.id]" class="studio-error">{{ saveError[session.id] }}</p>
              <p v-if="deleteError[session.id]" class="studio-error">{{ deleteError[session.id] }}</p>
              <p v-if="copyFeedback[session.id]" class="studio-success">{{ copyFeedback[session.id] }}</p>

              <div class="session-actions">
                <div class="session-actions-primary">
                  <button
                    class="studio-primary"
                    :disabled="saveBusy[session.id]"
                    type="button"
                    @click="saveSession(session.id)"
                  >
                    {{ saveBusy[session.id] ? "Saving…" : "Save" }}
                  </button>
                  <NuxtLink class="studio-secondary session-workspace-link" :to="`/studio/street-delivery-session/${session.id}`">
                    Open workspace
                  </NuxtLink>
                </div>
                <div class="session-actions-secondary">
                  <button
                    class="studio-secondary"
                    :disabled="saveBusy[session.id]"
                    type="button"
                    @click="saveSession(session.id, true)"
                  >
                    Regenerate token
                  </button>
                  <button
                    class="studio-secondary"
                    :disabled="saveBusy[session.id]"
                    type="button"
                    @click="setDistributionState(session.id, session.distributionState === 'sent' ? 'available' : 'sent')"
                  >
                    {{ session.distributionState === "sent" ? "Mark available" : "Mark sent" }}
                  </button>
                  <button
                    class="studio-secondary"
                    :disabled="session.distributionState === 'sent'"
                    type="button"
                    @click="prepareReprint(session)"
                  >
                    Reprint
                  </button>
                  <button
                    class="studio-secondary"
                    type="button"
                    @click="copyRequestMessage(session)"
                  >
                    Copy request message
                  </button>
                  <button
                    class="studio-secondary is-danger"
                    :disabled="deleteBusy[session.id] || session.distributionState !== 'available' || session.contactCount > 0 || session.photoCount > 0"
                    type="button"
                    @click="deleteSession(session.id)"
                  >
                    {{ deleteBusy[session.id] ? "Deleting…" : "Delete" }}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
  :global(.street-delivery-studio-body) {
    background: rgb(7, 9, 13);
  }

  .studio-page {
    min-height: 100dvh;
    padding: 5.5rem 1.25rem 2rem;
    background:
      radial-gradient(circle at top, rgba(251, 191, 36, 0.12), transparent 30%),
      linear-gradient(180deg, rgba(9, 11, 15, 0.98), rgb(7, 9, 13));
    color: #f4f4f5;
  }

  .studio-shell {
    max-width: 82rem;
    margin: 0 auto;
    display: grid;
    gap: 1.25rem;
  }

  .studio-header,
  .studio-panel-head,
  .session-head,
  .studio-actions,
  .print-options,
  .session-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .studio-kicker,
  .studio-eyebrow {
    margin: 0 0 0.55rem;
    font-size: 0.76rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(212, 212, 216, 0.66);
  }

  h1,
  h2,
  h3 {
    margin: 0;
    letter-spacing: -0.03em;
  }

  h1 {
    font-family: "Syne", sans-serif;
    font-size: clamp(2rem, 4vw, 3.6rem);
  }

  .studio-lede,
  .studio-login p,
  .studio-hint,
  .session-meta,
  .session-contact,
  .print-foot,
  .back-meta-line {
    color: #b8b8c0;
    line-height: 1.55;
  }

  .studio-panel,
  .studio-login {
    border: 1px solid rgba(161, 161, 170, 0.2);
    border-radius: 1.4rem;
    padding: 1.2rem;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
      rgba(17, 18, 22, 0.94);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  }

  .studio-login {
    display: grid;
    gap: 1rem;
    max-width: 34rem;
  }

  .studio-form,
  .studio-grid-form {
    display: grid;
    gap: 0.9rem;
  }

  @media (min-width: 900px) {
    .studio-grid-form {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .studio-grid-full {
    grid-column: 1 / -1;
  }

  .session-toolbar {
    margin: 0 0 1rem;
  }

  .session-filter {
    max-width: 16rem;
  }

  .studio-field {
    display: grid;
    gap: 0.45rem;
  }

  .studio-field span,
  .studio-toggle span {
    font-size: 0.88rem;
  }

  .studio-field input,
  .studio-field select {
    width: 100%;
    border: 1px solid rgba(113, 113, 122, 0.42);
    border-radius: 0.95rem;
    background: rgba(9, 11, 15, 0.88);
    padding: 0.9rem 1rem;
    color: #f4f4f5;
    font: inherit;
  }

  .studio-toggle {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding-top: 2rem;
  }

  .studio-toggle.is-inline {
    padding-top: 0;
  }

  .studio-primary,
  .studio-secondary {
    min-height: 2.85rem;
    border-radius: 999px;
    padding: 0.82rem 1.05rem;
    font: inherit;
    cursor: pointer;
  }

  .studio-primary {
    border: none;
    background: linear-gradient(135deg, rgb(251, 191, 36), rgb(245, 158, 11));
    color: rgb(25, 18, 5);
    font-weight: 700;
  }

  .studio-secondary {
    border: 1px solid rgba(161, 161, 170, 0.28);
    background: transparent;
    color: #f4f4f5;
  }

  .studio-secondary.is-danger {
    border-color: rgba(248, 113, 113, 0.42);
    color: #fecaca;
  }

  .session-workspace-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  .studio-primary:disabled,
  .studio-secondary:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .studio-error {
    margin: 0;
    color: #fca5a5;
  }

  .studio-success {
    margin: 0;
    color: #a7f3d0;
  }

  .sheet-stack {
    display: grid;
    gap: 1.8rem;
    margin-top: 1rem;
  }

  .sheet-group {
    display: grid;
    gap: 1rem;
  }

  .sheet-card {
    display: grid;
    gap: 0.75rem;
  }

  .sheet-caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    color: #d4d4d8;
    font-size: 0.9rem;
  }

  .sheet-grid {
    width: min(100%, 210mm);
    min-height: 297mm;
    margin: 0 auto;
    padding: 11mm 10mm;
    display: grid;
    grid-template-columns: repeat(2, 85mm);
    grid-template-rows: repeat(5, 55mm);
    justify-content: center;
    align-content: center;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
      rgba(11, 12, 16, 0.9);
    border: 1px solid rgba(161, 161, 170, 0.14);
    border-radius: 1.3rem;
    overflow: hidden;
  }

  .print-card {
    position: relative;
    border: 0.35mm solid rgba(40, 40, 44, 0.95);
    overflow: hidden;
    background: #f8f8f5;
    color: #111111;
  }

  .print-card.is-empty {
    background: transparent;
  }

  .print-card-front::before,
  .print-card-back::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .print-card-front::before {
    background:
      radial-gradient(circle at top right, rgba(245, 158, 11, 0.14), transparent 36%),
      linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(17, 17, 17, 0.035));
  }

  .print-card-back::before {
    background:
      linear-gradient(120deg, rgba(17, 17, 17, 0.04), transparent 32%),
      linear-gradient(180deg, rgba(245, 158, 11, 0.08), transparent 52%);
  }

  .card-topline,
  .card-back-layout {
    position: relative;
    z-index: 1;
  }

  .card-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 4mm 4.2mm 0;
  }

  .print-brand,
  .print-type,
  .print-url,
  .print-code,
  .print-foot,
  .back-meta-line {
    margin: 0;
  }

  .print-brand,
  .print-type {
    font-size: 3.1mm;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .print-brand {
    font-weight: 700;
  }

  .print-type {
    color: #9a5c00;
  }

  .card-front-body {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 22mm 1fr;
    gap: 3.8mm;
    padding: 3mm 4.2mm 4mm;
    align-items: center;
    height: calc(100% - 7mm);
  }

  .qr-shell {
    width: 22mm;
    height: 22mm;
    border: 0.3mm solid rgba(17, 17, 17, 0.9);
    display: grid;
    place-items: center;
    background: white;
  }

  .card-qr {
    display: block;
    width: 19mm;
    height: 19mm;
  }

  .card-front-copy h3,
  .card-back-copy h3 {
    font-size: 5.1mm;
    line-height: 0.96;
    margin: 0;
    letter-spacing: -0.05em;
  }

  .card-front-copy {
    display: grid;
    gap: 1.45mm;
  }

  .card-front-copy p,
  .card-back-copy p {
    margin: 0;
    font-size: 2.8mm;
    line-height: 1.28;
  }

  .print-url {
    font-size: 2.35mm;
    word-break: break-all;
    color: #3c3c40;
  }

  .print-code {
    font-family: "IBM Plex Mono", monospace;
    font-size: 3.25mm;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .card-back-layout {
    display: grid;
    grid-template-columns: 1.25fr 0.9fr;
    gap: 3.4mm;
    height: 100%;
    padding: 4mm 4.2mm;
  }

  .card-back-copy {
    display: grid;
    align-content: start;
    gap: 1.4mm;
  }

  .back-steps {
    margin: 0;
    padding-left: 4mm;
    display: grid;
    gap: 1.2mm;
    font-size: 2.75mm;
    line-height: 1.28;
  }

  .card-back-meta {
    display: grid;
    align-content: end;
    gap: 1.1mm;
    padding-left: 3mm;
    border-left: 0.3mm solid rgba(17, 17, 17, 0.22);
  }

  .session-list {
    display: grid;
    gap: 1rem;
    margin-top: 1rem;
  }

  .session-card {
    border: 1px solid rgba(161, 161, 170, 0.12);
    border-radius: 1.1rem;
    padding: 1.1rem;
    background: rgba(9, 11, 15, 0.65);
    display: grid;
    gap: 0.9rem;
  }

  .session-id {
    display: grid;
    gap: 0.25rem;
  }

  .session-meta {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
    font-size: 0.88rem;
    color: #b8b8c0;
    align-items: center;
  }

  .session-print-badge {
    font-size: 0.8rem;
    font-weight: 600;
  }

  .session-print-badge.is-printed {
    color: #a7f3d0;
  }

  .session-print-badge.is-available {
    color: #fcd34d;
  }

  .session-print-badge.is-sent {
    color: #93c5fd;
  }

  .session-actions {
    display: grid;
    gap: 0.5rem;
  }

  .session-actions-primary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }

  .session-actions-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .session-actions-secondary .studio-secondary {
    min-height: 2.35rem;
    padding: 0.55rem 0.85rem;
    font-size: 0.82rem;
  }

  .session-links {
    display: flex;
    gap: 0.85rem;
    flex-wrap: wrap;
  }

  .session-code {
    margin: 0;
    font-family: "IBM Plex Mono", monospace;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fef3c7;
  }

  .session-links a {
    color: #fde68a;
    font-size: 0.88rem;
  }

  .session-grid {
    border-top: 1px solid rgba(161, 161, 170, 0.1);
    padding-top: 0.75rem;
  }

  .session-contact {
    margin: 0;
    color: #b8b8c0;
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .session-contact-label {
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(212, 212, 216, 0.5);
    margin-right: 0.25rem;
  }

  @media (max-width: 900px) {
    .sheet-grid {
      width: 100%;
      min-height: auto;
      aspect-ratio: 210 / 297;
      padding: 4.8%;
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(5, 1fr);
    }
  }

  @media (max-width: 720px) {
    .studio-header,
    .studio-panel-head,
    .session-head,
    .studio-actions,
    .print-options,
    .session-toolbar {
      flex-direction: column;
      align-items: start;
    }

    .studio-toggle {
      padding-top: 0.4rem;
    }

    .card-front-body,
    .card-back-layout {
      grid-template-columns: 1fr;
    }

    .card-back-meta {
      padding-left: 0;
      border-left: none;
      border-top: 0.3mm solid rgba(17, 17, 17, 0.22);
      padding-top: 2.4mm;
    }
  }

  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }

    :global(.site-nav) {
      display: none !important;
    }

    .studio-page {
      background: white;
      color: black;
      padding: 0;
    }

    .no-print,
    .studio-panel:not(.studio-print-panel) {
      display: none !important;
    }

    .studio-shell,
    .studio-print-panel,
    .sheet-stack,
    .sheet-group,
    .sheet-card {
      gap: 0;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      box-shadow: none;
    }

    .sheet-grid {
      width: 210mm;
      min-height: 297mm;
      margin: 0;
      padding: 11mm 10mm;
      border: none;
      border-radius: 0;
      background: white;
      break-after: page;
      page-break-after: always;
    }

    .sheet-card:last-child .sheet-grid:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    .print-card {
      border-color: #111111;
      background: white;
      box-shadow: none;
    }

    .print-card.is-empty {
      border-color: rgba(17, 17, 17, 0.16);
      background: white;
    }

    .print-card-front::before,
    .print-card-back::before {
      background: none;
    }

    .print-type,
    .print-url,
    .print-foot,
    .back-meta-line {
      color: #222222;
    }
  }
</style>
