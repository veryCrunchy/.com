<script setup lang="ts">
  import { computed, ref } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";
  import type {
    CmsStreetDeliveryContactMethod,
    CmsStreetDeliverySessionPublic,
    CmsStreetDeliverySubmissionResult,
  } from "~/types/directus";

  const route = useRoute();
  const { data: shell } = await useCmsShell();

  const site = computed(() => shell.value?.site || DEFAULT_CMS_SITE_SETTINGS);
  const sessionCode = computed(() => String(route.params.code || "").trim().toUpperCase());

  const { data: sessionResponse, pending } = await useAsyncData(
    `street-delivery-session-${sessionCode.value}`,
    async () => {
      try {
        return await $fetch<{ session: CmsStreetDeliverySessionPublic }>(
          `/api/cms/street-delivery/sessions/${encodeURIComponent(sessionCode.value)}`
        );
      } catch (error: unknown) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 500;

        if (statusCode === 404) {
          return null;
        }

        throw error;
      }
    }
  );

  const session = computed(() => sessionResponse.value?.session || null);
  const notFound = computed(() => !pending.value && !session.value);

  const contactMethod = ref<CmsStreetDeliveryContactMethod>("email");
  const contactValue = ref("");
  const firstName = ref("");
  const description = ref("");
  const consentSend = ref(true);
  const consentPublish = ref(false);
  const selfieFile = ref<File | null>(null);
  const submitting = ref(false);
  const submitError = ref("");
  const submitSuccess = ref<CmsStreetDeliverySubmissionResult | null>(null);

  const contactMethodOptions: Array<{
    value: CmsStreetDeliveryContactMethod;
    label: string;
    placeholder: string;
  }> = [
    { value: "email", label: "Email", placeholder: "you@example.com" },
    { value: "instagram", label: "Instagram", placeholder: "@yourhandle" },
    { value: "phone", label: "Phone", placeholder: "+31 6 12345678" },
  ];

  const activeMethod = computed(
    () => contactMethodOptions.find((option) => option.value === contactMethod.value) || contactMethodOptions[0]
  );
  const activeAutocomplete = computed(() => {
    if (contactMethod.value === "email") return "email";
    if (contactMethod.value === "phone") return "tel";
    return "username";
  });

  const formattedDate = computed(() => {
    if (!session.value?.photographedAt) {
      return null;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(session.value.photographedAt));
  });

  function onSelfieSelected(event: Event) {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0] || null;

    selfieFile.value = file;
  }

  async function submitRequest() {
    if (!session.value || submitting.value) {
      return;
    }

    submitError.value = "";
    submitting.value = true;

    try {
      const form = new FormData();
      form.set("contactMethod", contactMethod.value);
      form.set("contactValue", contactValue.value);
      form.set("firstName", firstName.value);
      form.set("description", description.value);
      form.set("consentSend", consentSend.value ? "true" : "false");
      form.set("consentPublish", consentPublish.value ? "true" : "false");

      if (selfieFile.value) {
        form.set("selfie", selfieFile.value);
      }

      const result = await $fetch<CmsStreetDeliverySubmissionResult>(
        `/api/cms/street-delivery/sessions/${encodeURIComponent(session.value.code)}`,
        {
          method: "POST",
          body: form,
        }
      );

      submitSuccess.value = result;
    } catch (error: unknown) {
      submitError.value =
        typeof error === "object" && error && "statusMessage" in error
          ? String((error as { statusMessage?: string }).statusMessage || "Something went wrong.")
          : "Something went wrong. Please try again.";
    } finally {
      submitting.value = false;
    }
  }

  useSeoMeta({
    title: () => `${site.value.siteName} photographed you today`,
    description: () =>
      `Request your photos from session ${sessionCode.value} on ${site.value.siteName}.`,
  });
</script>

<template>
  <main class="street-page">
    <section class="street-shell">
      <div class="street-copy">
        <p class="street-kicker">Street Delivery</p>
        <h1>Yaro photographed you today.</h1>
        <p class="street-lede">
          Fast handoff, no account, no spam. Leave one way to reach you and I’ll send the photos once I’ve sorted them.
        </p>

        <div class="street-meta">
          <span class="street-chip">Code: {{ sessionCode }}</span>
          <span v-if="session?.location" class="street-chip">{{ session.location }}</span>
          <span v-if="formattedDate" class="street-chip">{{ formattedDate }}</span>
        </div>
      </div>

      <div class="street-card">
        <template v-if="pending">
          <div class="street-state">
            <h2>Loading session…</h2>
            <p>Checking your card code now.</p>
          </div>
        </template>

        <template v-else-if="notFound">
          <div class="street-state">
            <h2>Card not found</h2>
            <p>
              That code doesn’t seem to be active right now. If the card is fresh, try scanning again or message
              <a href="https://instagram.com/verycrunchy" target="_blank" rel="noopener">@verycrunchy</a>.
            </p>
          </div>
        </template>

        <template v-else-if="submitSuccess">
          <div class="street-state">
            <h2>You’re all set.</h2>
            <p>I’ve got your contact details and I’ll send the photos once I’ve sorted them.</p>
            <p class="street-note">No spam. Just your photos.</p>
            <NuxtLink
              v-if="submitSuccess.galleryUrl"
              :to="submitSuccess.galleryUrl"
              class="street-primary"
            >
              View gallery
            </NuxtLink>
          </div>
        </template>

        <template v-else>
          <div v-if="session?.galleryReady && session.galleryToken" class="street-ready">
            <p>Your gallery is already ready.</p>
            <NuxtLink :to="`/g/${session.galleryToken}`">Open gallery</NuxtLink>
          </div>

          <form class="street-form" @submit.prevent="submitRequest">
            <label class="street-field">
              <span>Contact method</span>
              <select v-model="contactMethod">
                <option
                  v-for="option in contactMethodOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="street-field">
              <span>{{ activeMethod.label }}</span>
              <input
                v-model="contactValue"
                :placeholder="activeMethod.placeholder"
                :autocomplete="activeAutocomplete"
                required
              >
            </label>

            <label class="street-field">
              <span>First name <small>(optional)</small></span>
              <input
                v-model="firstName"
                placeholder="Yours"
                autocomplete="given-name"
              >
            </label>

            <label class="street-field">
              <span>Description <small>(optional)</small></span>
              <textarea
                v-model="description"
                rows="3"
                placeholder="bike, striped coat, white dog, red scarf..."
              />
            </label>

            <label class="street-field">
              <span>Selfie <small>(optional but helpful)</small></span>
              <input
                type="file"
                accept="image/*"
                @change="onSelfieSelected"
              >
              <small v-if="selfieFile" class="street-file">{{ selfieFile.name }}</small>
            </label>

            <label class="street-check">
              <input v-model="consentSend" type="checkbox" required>
              <span>Send me my photos</span>
            </label>

            <label class="street-check">
              <input v-model="consentPublish" type="checkbox">
              <span>You may publish recognizable photos of me</span>
            </label>

            <p v-if="submitError" class="street-error">{{ submitError }}</p>

            <button class="street-primary" :disabled="submitting || !consentSend" type="submit">
              {{ submitting ? "Sending…" : "Request photos" }}
            </button>

            <p class="street-note">No spam. Just your photos.</p>
          </form>
        </template>
      </div>
    </section>
  </main>
</template>

<style scoped>
  .street-page {
    min-height: 100dvh;
    padding: 6rem 1.25rem 2.5rem;
    background:
      radial-gradient(circle at top, rgba(30, 215, 96, 0.14), transparent 34%),
      linear-gradient(180deg, rgba(9, 11, 15, 0.98), rgb(7, 9, 13));
    color: #f4f4f5;
  }

  .street-shell {
    max-width: 68rem;
    margin: 0 auto;
    display: grid;
    gap: 2rem;
  }

  @media (min-width: 960px) {
    .street-shell {
      grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 28rem);
      align-items: start;
    }
  }

  .street-copy {
    padding-top: 1rem;
  }

  .street-kicker {
    margin: 0 0 0.9rem;
    font-size: 0.78rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(212, 212, 216, 0.66);
  }

  h1 {
    margin: 0;
    font-family: "Syne", sans-serif;
    font-size: clamp(2.2rem, 5vw, 4.6rem);
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  .street-lede {
    max-width: 36rem;
    margin: 1.1rem 0 0;
    color: #c4c4cb;
    font-size: 1.02rem;
    line-height: 1.65;
  }

  .street-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    margin-top: 1.35rem;
  }

  .street-chip {
    border: 1px solid rgba(161, 161, 170, 0.24);
    border-radius: 999px;
    padding: 0.45rem 0.8rem;
    font-size: 0.8rem;
    color: #d4d4d8;
    background: rgba(24, 24, 27, 0.72);
  }

  .street-card {
    border: 1px solid rgba(161, 161, 170, 0.2);
    border-radius: 1.5rem;
    padding: 1.2rem;
    background: rgba(17, 18, 22, 0.94);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
  }

  .street-form,
  .street-state {
    display: grid;
    gap: 1rem;
  }

  .street-state h2 {
    margin: 0;
    font-size: 1.35rem;
    letter-spacing: -0.02em;
  }

  .street-state p {
    margin: 0;
    color: #c4c4cb;
    line-height: 1.6;
  }

  .street-ready {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    border: 1px solid rgba(30, 215, 96, 0.24);
    border-radius: 1rem;
    padding: 0.9rem 1rem;
    background: rgba(30, 215, 96, 0.08);
  }

  .street-ready p {
    margin: 0;
    color: #e4e4e7;
  }

  .street-ready a {
    color: #a3e5bd;
    font-weight: 600;
  }

  .street-field {
    display: grid;
    gap: 0.5rem;
  }

  .street-field span {
    font-size: 0.88rem;
    color: #e4e4e7;
  }

  .street-field small {
    color: #8b8b95;
  }

  .street-field input,
  .street-field select,
  .street-field textarea {
    width: 100%;
    border: 1px solid rgba(113, 113, 122, 0.42);
    border-radius: 0.95rem;
    background: rgba(9, 11, 15, 0.88);
    padding: 0.9rem 1rem;
    color: #f4f4f5;
    font: inherit;
  }

  .street-field textarea {
    resize: vertical;
    min-height: 7rem;
  }

  .street-file {
    color: #8b8b95;
  }

  .street-check {
    display: flex;
    gap: 0.8rem;
    align-items: start;
    color: #e4e4e7;
    line-height: 1.45;
  }

  .street-check input {
    margin-top: 0.12rem;
  }

  .street-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 3rem;
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, rgb(30, 215, 96), rgb(12, 162, 68));
    color: rgb(6, 11, 7);
    font-weight: 700;
    padding: 0.85rem 1.2rem;
    cursor: pointer;
  }

  .street-primary:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .street-error {
    margin: 0;
    color: #fca5a5;
    font-size: 0.92rem;
  }

  .street-note {
    margin: 0;
    color: #8b8b95;
    font-size: 0.88rem;
  }
</style>
