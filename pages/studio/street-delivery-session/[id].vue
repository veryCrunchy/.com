<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";
  import type {
    CmsStreetDeliveryAdminContactPreview,
    CmsSiteSettings,
    CmsStreetDeliveryAdminSessionDetail,
  } from "~/types/directus";

  type SessionDraft = {
    status: string;
    location: string;
    photographedAtLocal: string;
    publicEnabled: boolean;
  };

  const STORAGE_KEY = "street-delivery-directus-token";
  const runtimeConfig = useRuntimeConfig();
  const { data: siteSettings } = await useAsyncData<CmsSiteSettings>(
    "street-delivery-site-settings-session",
    async () => {
      const response = await $fetch<{ site: CmsSiteSettings }>("/api/cms/site-settings");
      return response.site;
    },
    {
      default: () => DEFAULT_CMS_SITE_SETTINGS,
    }
  );

  const route = useRoute();
  const sessionId = computed(() => Number(route.params.id));
  const origin = ref("");
  const authToken = ref("");
  const email = ref("");
  const password = ref("");
  const loginBusy = ref(false);
  const loginError = ref("");
  const loadError = ref("");
  const loadingSession = ref(false);
  const session = ref<CmsStreetDeliveryAdminSessionDetail | null>(null);
  const uploadSelection = ref<File[]>([]);
  const uploadBusy = ref(false);
  const uploadError = ref("");
  const uploadMessage = ref("");
  const saveBusy = ref(false);
  const saveError = ref("");
  const removeBusy = reactive<Record<number, boolean>>({});
  const removeError = reactive<Record<number, string>>({});
  const copyFeedback = ref("");
  const draft = reactive<SessionDraft>({
    status: "new",
    location: "",
    photographedAtLocal: "",
    publicEnabled: true,
  });

  useSeoMeta({
    title: "Street Delivery Session | veryCrunchy",
    description: "Upload, review, and deliver a street-delivery gallery.",
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

  function syncDraft(nextSession: CmsStreetDeliveryAdminSessionDetail) {
    draft.status = nextSession.status || "new";
    draft.location = nextSession.location || "";
    draft.photographedAtLocal = toLocalInputValue(nextSession.photographedAt);
    draft.publicEnabled = nextSession.publicEnabled;
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

  async function loadSession() {
    if (!authToken.value || !Number.isInteger(sessionId.value) || sessionId.value <= 0) {
      return;
    }

    loadingSession.value = true;
    loadError.value = "";

    try {
      const response = await adminFetch<{ session: CmsStreetDeliveryAdminSessionDetail }>(
        `/api/cms/street-delivery/admin/sessions/${sessionId.value}/detail`
      );

      session.value = response.session;
      syncDraft(response.session);
    } catch (error: unknown) {
      loadError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not load session.")
          : "Could not load session.";

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
      loadingSession.value = false;
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
      await loadSession();
    } catch (error: unknown) {
      loginError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Login failed.")
          : "Login failed.";
    } finally {
      loginBusy.value = false;
    }
  }

  async function saveSession(regenerateGalleryToken = false) {
    if (!session.value) {
      return;
    }

    saveBusy.value = true;
    saveError.value = "";
    copyFeedback.value = "";

    try {
      const response = await adminFetch<{ session: CmsStreetDeliveryAdminSessionDetail }>(
        `/api/cms/street-delivery/admin/sessions/${session.value.id}`,
        {
          method: "PATCH",
          body: {
            status: draft.status,
            location: draft.location || null,
            photographedAt: draft.photographedAtLocal
              ? new Date(draft.photographedAtLocal).toISOString()
              : null,
            publicEnabled: draft.publicEnabled,
            regenerateGalleryToken,
          },
        }
      );

      session.value = {
        ...session.value,
        ...response.session,
      };
      syncDraft(session.value);
    } catch (error: unknown) {
      saveError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not save session.")
          : "Could not save session.";
    } finally {
      saveBusy.value = false;
    }
  }

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement | null;
    uploadSelection.value = input?.files ? [...input.files] : [];
  }

  async function uploadPhotos() {
    if (!session.value || !uploadSelection.value.length) {
      return;
    }

    uploadBusy.value = true;
    uploadError.value = "";
    uploadMessage.value = "";

    try {
      const form = new FormData();

      for (const file of uploadSelection.value) {
        form.append("files", file, file.name);
      }

      const response = await adminFetch<{ session: CmsStreetDeliveryAdminSessionDetail }>(
        `/api/cms/street-delivery/admin/sessions/${session.value.id}/photos`,
        {
          method: "POST",
          body: form,
        }
      );

      session.value = response.session;
      syncDraft(response.session);
      uploadMessage.value = `Uploaded ${uploadSelection.value.length} photo${uploadSelection.value.length === 1 ? "" : "s"} and linked them to this gallery.`;
      uploadSelection.value = [];

      const fileInput = document.getElementById("street-delivery-upload") as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error: unknown) {
      uploadError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not upload photos.")
          : "Could not upload photos.";
    } finally {
      uploadBusy.value = false;
    }
  }

  async function unlinkPhoto(linkId: number) {
    if (!session.value) {
      return;
    }

    removeBusy[linkId] = true;
    removeError[linkId] = "";

    try {
      const response = await adminFetch<{ session: CmsStreetDeliveryAdminSessionDetail }>(
        `/api/cms/street-delivery/admin/session-photos/${linkId}`,
        {
          method: "DELETE",
        }
      );

      session.value = response.session;
      syncDraft(response.session);
    } catch (error: unknown) {
      removeError[linkId] =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Could not remove photo.")
          : "Could not remove photo.";
    } finally {
      removeBusy[linkId] = false;
    }
  }

  async function copyText(value: string, label: string) {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    copyFeedback.value = `${label} copied.`;
  }

  async function markDelivered() {
    if (!session.value) {
      return;
    }

    if (!session.value.photos.length) {
      saveError.value = "Upload at least one photo before marking this session delivered.";
      return;
    }

    draft.status = "delivered";
    await saveSession();
  }

  const primaryContact = computed<CmsStreetDeliveryAdminContactPreview | null>(
    () => session.value?.contacts?.[0] || session.value?.latestContact || null
  );
  const displayBaseUrl = computed(() =>
    String(runtimeConfig.public.siteUrlDisplay || origin.value || "").replace(/\/$/, "")
  );
  const requestUrl = computed(() =>
    session.value?.publicPath ? `${displayBaseUrl.value}${session.value.publicPath}` : ""
  );
  const resolvedGalleryPath = computed(() =>
    session.value?.galleryToken ? `/g/${encodeURIComponent(session.value.galleryToken)}` : null
  );
  const galleryUrl = computed(() =>
    resolvedGalleryPath.value && displayBaseUrl.value ? `${displayBaseUrl.value}${resolvedGalleryPath.value}` : ""
  );
  const sessionLabel = computed(() =>
    session.value ? `${session.value.code}${session.value.location ? ` · ${session.value.location}` : ""}` : "your session"
  );
  const requestMessage = computed(() => {
    if (!session.value || !requestUrl.value) {
      return "";
    }

    return fillMessageTemplate(siteSettings.value.streetDeliveryRequestMessageTemplate, {
      formLink: requestUrl.value,
    });
  });
  const deliveryMessage = computed(() => {
    if (!session.value || !galleryUrl.value) {
      return "";
    }

    return fillMessageTemplate(siteSettings.value.streetDeliveryReadyMessageTemplate, {
      galleryLink: galleryUrl.value,
    });
  });

  onMounted(async () => {
    origin.value = window.location.origin;
    const storedToken = localStorage.getItem(STORAGE_KEY);

    if (storedToken) {
      authToken.value = storedToken;
      await loadSession();
    }
  });
</script>

<template>
  <main class="studio-page">
    <section class="studio-shell">
      <div class="studio-header">
        <div>
          <p class="studio-kicker">Session Workspace</p>
          <h1>{{ session?.code || "Street delivery" }}</h1>
          <p class="studio-lede">
            Upload photos, check the gallery, and send the delivery link without leaving the studio.
          </p>
        </div>
        <NuxtLink class="studio-secondary" to="/studio/street-delivery">
          Back to dashboard
        </NuxtLink>
      </div>

      <section v-if="!authToken" class="studio-login">
        <div class="login-copy">
          <p class="studio-eyebrow">Directus Auth</p>
          <h2>Sign in to open this session</h2>
          <p>Use the same Directus account you use for the main studio dashboard.</p>
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
        <section class="studio-panel">
          <div class="studio-panel-head">
            <div>
              <p class="studio-eyebrow">Overview</p>
              <h2>{{ sessionLabel }}</h2>
            </div>
            <button class="studio-secondary" type="button" :disabled="loadingSession" @click="loadSession">
              {{ loadingSession ? "Refreshing…" : "Refresh" }}
            </button>
          </div>

          <p v-if="loadError" class="studio-error">{{ loadError }}</p>
          <p v-else-if="loadingSession && !session" class="studio-hint">Loading this session…</p>

          <template v-if="session">
            <div class="overview-grid">
              <div class="overview-card">
                <p class="overview-label">Status</p>
                <strong>{{ session.status || "new" }}</strong>
              </div>
              <div class="overview-card">
                <p class="overview-label">Contacts</p>
                <strong>{{ session.contactCount }}</strong>
              </div>
              <div class="overview-card">
                <p class="overview-label">Gallery photos</p>
                <strong>{{ session.photos.length }}</strong>
              </div>
              <div class="overview-card">
                <p class="overview-label">Last request</p>
                <strong>{{ formatDisplayDate(session.lastSubmissionAt) || "No submission yet" }}</strong>
              </div>
            </div>

            <div class="studio-grid">
              <section class="studio-panel panel-section">
                <div class="studio-panel-head">
                  <div>
                    <p class="studio-eyebrow">Session</p>
                    <h2>Settings</h2>
                  </div>
                </div>

                <div class="studio-grid-form">
                  <label class="studio-field">
                    <span>Status</span>
                    <select v-model="draft.status">
                      <option value="new">New</option>
                      <option value="matched">Matched</option>
                      <option value="delivered">Delivered</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <label class="studio-field">
                    <span>Location</span>
                    <input v-model="draft.location" placeholder="Optional location">
                  </label>
                  <label class="studio-field">
                    <span>Photographed at</span>
                    <input v-model="draft.photographedAtLocal" type="datetime-local">
                  </label>
                  <label class="studio-toggle">
                    <input v-model="draft.publicEnabled" type="checkbox">
                    <span>Public request page enabled</span>
                  </label>
                </div>

                <div class="session-links">
                  <a :href="session.publicPath" target="_blank" rel="noopener">Open request page</a>
                  <a v-if="galleryUrl" :href="resolvedGalleryPath || undefined" target="_blank" rel="noopener">Open gallery</a>
                </div>

                <div class="delivery-card">
                  <p class="overview-label">Request message</p>
                  <textarea :value="requestMessage" readonly />
                  <div class="studio-actions">
                    <button class="studio-secondary" :disabled="!requestUrl" type="button" @click="copyText(requestUrl, 'Request form link')">
                      Copy form link
                    </button>
                    <button class="studio-secondary" :disabled="!requestMessage" type="button" @click="copyText(requestMessage, 'Request message')">
                      Copy request message
                    </button>
                  </div>
                  <p class="studio-hint">Edit this template in Directus under <strong>site_settings</strong> → <em>street_delivery_request_message_template</em>.</p>
                </div>

                <p v-if="saveError" class="studio-error">{{ saveError }}</p>

                <div class="studio-actions">
                  <button class="studio-primary" :disabled="saveBusy" type="button" @click="saveSession()">
                    {{ saveBusy ? "Saving…" : "Save settings" }}
                  </button>
                  <button class="studio-secondary" :disabled="saveBusy" type="button" @click="saveSession(true)">
                    Regenerate gallery token
                  </button>
                </div>
              </section>

              <section class="studio-panel panel-section">
                <div class="studio-panel-head">
                  <div>
                    <p class="studio-eyebrow">Subject</p>
                    <h2>Contacts</h2>
                  </div>
                </div>

                <div v-if="session.contacts.length" class="contact-stack">
                  <article v-for="contact in session.contacts" :key="contact.id" class="contact-card">
                    <div class="contact-row">
                      <strong>{{ contact.method }}</strong>
                      <span>{{ formatDisplayDate(contact.dateCreated) || "Unknown time" }}</span>
                    </div>
                    <p>{{ contact.value }}</p>
                    <p v-if="contact.firstName" class="contact-muted">Name: {{ contact.firstName }}</p>
                    <p v-if="contact.description" class="contact-muted">{{ contact.description }}</p>
                    <p class="contact-muted">
                      {{ contact.consentPublish ? "Publish consent granted" : "No publish consent granted" }}
                    </p>
                  </article>
                </div>
                <p v-else class="studio-hint">No subject has claimed this card yet.</p>
              </section>
            </div>
          </template>
        </section>

        <template v-if="session">
          <section class="studio-panel">
            <div class="studio-panel-head">
              <div>
                <p class="studio-eyebrow">Upload</p>
                <h2>Add photos to this gallery</h2>
              </div>
            </div>

            <p class="studio-hint">
              Uploaded files become private draft photo records in Directus and are linked to this session gallery only.
            </p>

            <div class="upload-box">
              <label class="upload-picker" for="street-delivery-upload">
                <span>Select photos</span>
                <input id="street-delivery-upload" type="file" accept="image/*" multiple @change="onFileChange">
              </label>

              <div v-if="uploadSelection.length" class="upload-list">
                <p>{{ uploadSelection.length }} file{{ uploadSelection.length === 1 ? "" : "s" }} selected</p>
                <p class="upload-files">{{ uploadSelection.map((file) => file.name).join(", ") }}</p>
              </div>

              <p v-if="uploadError" class="studio-error">{{ uploadError }}</p>
              <p v-else-if="uploadMessage" class="studio-success">{{ uploadMessage }}</p>

              <div class="studio-actions">
                <button class="studio-primary" :disabled="uploadBusy || !uploadSelection.length" type="button" @click="uploadPhotos">
                  {{ uploadBusy ? "Uploading…" : "Upload selected photos" }}
                </button>
              </div>
            </div>
          </section>

          <section class="studio-panel">
            <div class="studio-panel-head">
              <div>
                <p class="studio-eyebrow">Gallery</p>
                <h2>Linked photos</h2>
              </div>
              <p class="studio-hint">{{ session.photos.length }} linked</p>
            </div>

            <div v-if="session.photos.length" class="photo-grid">
              <article v-for="link in session.photos" :key="link.id" class="photo-card">
                <a
                  v-if="link.photo?.image?.fallbackUrl || link.photo?.image?.url"
                  class="photo-thumb"
                  :href="link.photo?.image?.fallbackUrl || link.photo?.image?.url || undefined"
                  target="_blank"
                  rel="noopener"
                >
                  <img
                    :src="link.photo?.image?.previewUrl || link.photo?.image?.url || ''"
                    :alt="link.photo?.title || 'Street delivery photo'"
                  >
                </a>
                <div class="photo-copy">
                  <strong>{{ link.photo?.title || "Untitled photo" }}</strong>
                  <p>{{ link.photo?.slug || "No slug" }}</p>
                  <p v-if="link.photo?.takenAt" class="contact-muted">
                    {{ formatDisplayDate(link.photo?.takenAt || null) }}
                  </p>
                </div>
                <p v-if="removeError[link.id]" class="studio-error">{{ removeError[link.id] }}</p>
                <button class="studio-secondary" :disabled="removeBusy[link.id]" type="button" @click="unlinkPhoto(link.id)">
                  {{ removeBusy[link.id] ? "Removing…" : "Remove from gallery" }}
                </button>
              </article>
            </div>
            <p v-else class="studio-hint">No photos linked yet. Upload a few and this gallery will populate immediately.</p>
          </section>

          <section class="studio-panel">
            <div class="studio-panel-head">
              <div>
                <p class="studio-eyebrow">Deliver</p>
                <h2>Send the gallery</h2>
              </div>
            </div>

            <div class="delivery-grid">
              <div class="delivery-card">
                <p class="overview-label">Gallery link</p>
                <p class="delivery-link">{{ galleryUrl || "Generate or keep a gallery token to prepare delivery." }}</p>
                <div class="studio-actions">
                  <button class="studio-secondary" :disabled="!galleryUrl" type="button" @click="copyText(galleryUrl, 'Gallery link')">
                    Copy gallery link
                  </button>
                  <button class="studio-primary" :disabled="saveBusy || !session.photos.length" type="button" @click="markDelivered">
                    {{ saveBusy && draft.status === "delivered" ? "Saving…" : "Mark delivered" }}
                  </button>
                </div>
              </div>

              <div class="delivery-card">
                <p class="overview-label">Suggested message</p>
                <textarea :value="deliveryMessage" readonly />
                <div class="studio-actions">
                  <button class="studio-secondary" :disabled="!deliveryMessage" type="button" @click="copyText(deliveryMessage, 'Delivery message')">
                    Copy message
                  </button>
                </div>
                <p class="studio-hint">Edit this template in Directus under <strong>site_settings</strong> → <em>street_delivery_ready_message_template</em>.</p>
                <p v-if="copyFeedback" class="studio-success">{{ copyFeedback }}</p>
              </div>
            </div>

            <p class="studio-hint">
              Delivery stays manual for now, which means you can DM, email, or text the exact same gallery link depending on how the subject contacted you.
            </p>
          </section>
        </template>
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
  .studio-actions,
  .contact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .studio-kicker,
  .studio-eyebrow,
  .overview-label {
    margin: 0 0 0.55rem;
    font-size: 0.76rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(212, 212, 216, 0.66);
  }

  h1,
  h2 {
    margin: 0;
    letter-spacing: -0.03em;
  }

  h1 {
    font-family: "Syne", sans-serif;
    font-size: clamp(2rem, 4vw, 3.3rem);
  }

  .studio-lede,
  .studio-hint,
  .contact-muted,
  .delivery-link,
  .upload-files,
  .photo-copy p {
    color: #b8b8c0;
    line-height: 1.55;
  }

  .studio-panel,
  .studio-login,
  .overview-card,
  .contact-card,
  .photo-card,
  .delivery-card {
    border: 1px solid rgba(161, 161, 170, 0.2);
    border-radius: 1.4rem;
    padding: 1.2rem;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
      rgba(17, 18, 22, 0.94);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  }

  .studio-form,
  .studio-grid-form,
  .studio-grid,
  .contact-stack,
  .upload-box,
  .photo-grid,
  .delivery-grid {
    display: grid;
    gap: 1rem;
  }

  .studio-grid {
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
    margin-top: 1rem;
  }

  .studio-grid-form {
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .studio-field {
    display: grid;
    gap: 0.45rem;
  }

  .studio-field input,
  .studio-field select,
  textarea {
    width: 100%;
    border: 1px solid rgba(113, 113, 122, 0.42);
    border-radius: 0.95rem;
    background: rgba(9, 11, 15, 0.88);
    padding: 0.9rem 1rem;
    color: #f4f4f5;
    font: inherit;
  }

  textarea {
    min-height: 8rem;
    resize: vertical;
  }

  .studio-toggle {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding-top: 2rem;
  }

  .studio-primary,
  .studio-secondary,
  .upload-picker {
    min-height: 2.85rem;
    border-radius: 999px;
    padding: 0.82rem 1.05rem;
    font: inherit;
  }

  .studio-primary,
  .upload-picker {
    border: none;
    background: linear-gradient(135deg, rgb(251, 191, 36), rgb(245, 158, 11));
    color: rgb(25, 18, 5);
    font-weight: 700;
    cursor: pointer;
  }

  .studio-secondary {
    border: 1px solid rgba(161, 161, 170, 0.28);
    background: transparent;
    color: #f4f4f5;
    cursor: pointer;
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

  .overview-grid,
  .photo-grid,
  .delivery-grid {
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  }

  .overview-card strong,
  .contact-card strong,
  .photo-copy strong {
    display: block;
    color: #f4f4f5;
  }

  .session-links {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1rem;
  }

  .session-links a {
    color: #f7c14d;
    text-decoration: none;
  }

  .upload-picker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
  }

  .upload-picker input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .photo-card,
  .delivery-card,
  .panel-section {
    display: grid;
    gap: 1rem;
  }

  .photo-thumb {
    display: block;
    overflow: hidden;
    border-radius: 1rem;
    aspect-ratio: 4 / 3;
    background: rgba(255, 255, 255, 0.03);
  }

  .photo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .photo-copy p,
  .contact-card p,
  .delivery-link,
  .upload-list p {
    margin: 0;
  }

  @media (max-width: 720px) {
    .studio-page {
      padding-top: 4.75rem;
    }

    .studio-header,
    .studio-panel-head,
    .studio-actions,
    .contact-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
