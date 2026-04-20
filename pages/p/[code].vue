<script setup lang="ts">
  import { computed, onMounted, ref, watch } from "vue";

  import { DEFAULT_CMS_SITE_SETTINGS } from "~/types/directus";
  import type {
    CmsStreetDeliveryContactMethod,
    CmsStreetDeliverySessionPublic,
    CmsStreetDeliverySubmissionResult,
  } from "~/types/directus";

  type StreetLocale = "en" | "nl";

  definePageMeta({
    layout: false,
  });

  const route = useRoute();
  const { data: shell } = await useCmsShell();

  const site = computed(() => shell.value?.site || DEFAULT_CMS_SITE_SETTINGS);
  const sessionCode = computed(() => String(route.params.code || "").trim().toUpperCase());

  const copy = {
    en: {
      languageLabel: "Language",
      languageOptionEn: "English",
      languageOptionNl: "Nederlands",
      kicker: "Private Photo Delivery",
      title: "I photographed you recently.",
      intro:
        "Use this short form so I can match the right photos to the right person and send you a private download link once everything is ready.",
      loadingTitle: "Loading session…",
      loadingBody: "Checking your link now.",
      notFoundTitle: "This link is not active",
      notFoundBody:
        "That code does not seem to be available right now. If the link is fresh, try again in a moment or message",
      successTitle: "You’re all set.",
      successBody:
        "I’ve received your details. Once I finish sorting the photos, I’ll send you a private link where you can view and download them in full quality.",
      successNote: "No spam. Just your photos.",
      viewGallery: "Open gallery",
      readyLabel: "Your gallery is already ready.",
      readyAction: "Open private gallery",
      formTitle: "A few details",
      formIntro:
        "Everything below is just to help me identify your photos properly. The public sharing preference is optional and does not affect delivery.",
      methodLabel: "How should I contact you?",
      valueEmail: "Email address",
      valueInstagram: "Instagram",
      valuePhone: "Phone number",
      nameLabel: "First name",
      nameOptional: "optional",
      namePlaceholder: "Your name",
      descriptionLabel: "Anything that helps me recognise you",
      descriptionPlaceholder: "For example: silver bike, striped shirt, white dog, red scarf…",
      selfieLabel: "Selfie reference",
      selfieHint: "optional but helpful",
      selfieHelp: "A quick selfie can make matching much faster, especially after a busy shoot day.",
      publishConsent: "You may publish recognisable photos of me",
      publishHelp: "Optional. You’ll still receive your photos either way.",
      submit: "Send details",
      submitting: "Sending…",
      footerNote: "You’ll receive a private pickup link once the gallery is ready.",
      methodEmailLabel: "Email",
      methodInstagramLabel: "Instagram",
      methodPhoneLabel: "Phone",
      methodEmailPlaceholder: "you@example.com",
      methodInstagramPlaceholder: "@yourhandle",
      methodPhonePlaceholder: "+31 6 12345678",
      defaultError: "Something went wrong. Please try again.",
    },
    nl: {
      languageLabel: "Taal",
      languageOptionEn: "English",
      languageOptionNl: "Nederlands",
      kicker: "Privé fotolevering",
      title: "Ik heb je onlangs gefotografeerd.",
      intro:
        "Vul dit korte formulier in zodat ik de juiste foto’s aan de juiste persoon kan koppelen en je daarna een privé downloadlink kan sturen zodra alles klaarstaat.",
      loadingTitle: "Sessie laden…",
      loadingBody: "Ik controleer je link nu.",
      notFoundTitle: "Deze link is niet actief",
      notFoundBody:
        "Deze code lijkt op dit moment niet beschikbaar. Als de link nieuw is, probeer het zo nog eens of stuur een bericht naar",
      successTitle: "Alles staat goed.",
      successBody:
        "Ik heb je gegevens ontvangen. Zodra ik de foto’s heb uitgezocht, stuur ik je een privélink waarmee je alles in volledige kwaliteit kunt bekijken en downloaden.",
      successNote: "Geen spam. Alleen je foto’s.",
      viewGallery: "Galerij openen",
      readyLabel: "Je galerij staat al klaar.",
      readyAction: "Open privégalerij",
      formTitle: "Een paar details",
      formIntro:
        "Alles hieronder helpt me alleen om jouw foto’s goed te herkennen. Je voorkeur voor openbare publicatie is optioneel en heeft geen invloed op de levering.",
      methodLabel: "Hoe wil je dat ik contact opneem?",
      valueEmail: "E-mailadres",
      valueInstagram: "Instagram",
      valuePhone: "Telefoonnummer",
      nameLabel: "Voornaam",
      nameOptional: "optioneel",
      namePlaceholder: "Je naam",
      descriptionLabel: "Alles wat helpt om je te herkennen",
      descriptionPlaceholder: "Bijvoorbeeld: zilveren fiets, gestreept shirt, witte hond, rode sjaal…",
      selfieLabel: "Selfie ter referentie",
      selfieHint: "optioneel maar handig",
      selfieHelp: "Een snelle selfie helpt vaak om sneller de juiste foto’s te koppelen, vooral na een drukke shootdag.",
      publishConsent: "Je mag herkenbare foto’s van mij openbaar publiceren",
      publishHelp: "Optioneel. Je ontvangt je foto’s hoe dan ook.",
      submit: "Gegevens versturen",
      submitting: "Versturen…",
      footerNote: "Je ontvangt een privélink zodra de galerij klaarstaat.",
      methodEmailLabel: "E-mail",
      methodInstagramLabel: "Instagram",
      methodPhoneLabel: "Telefoon",
      methodEmailPlaceholder: "jij@voorbeeld.nl",
      methodInstagramPlaceholder: "@jouwaccount",
      methodPhonePlaceholder: "+31 6 12345678",
      defaultError: "Er ging iets mis. Probeer het opnieuw.",
    },
  } as const;

  const initialLocale = (() => {
    const queryLocale = String(route.query.lang || "").trim().toLowerCase();
    return queryLocale === "nl" ? "nl" : "en";
  })();

  const locale = ref<StreetLocale>(initialLocale);

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
  const consentPublish = ref(true);
  const selfieFile = ref<File | null>(null);
  const submitting = ref(false);
  const submitError = ref("");
  const submitSuccess = ref<CmsStreetDeliverySubmissionResult | null>(null);

  const activeCopy = computed(() => copy[locale.value]);

  const contactMethodOptions = computed<Array<{
    value: CmsStreetDeliveryContactMethod;
    label: string;
    placeholder: string;
    valueLabel: string;
  }>>(() => [
    {
      value: "email",
      label: activeCopy.value.methodEmailLabel,
      placeholder: activeCopy.value.methodEmailPlaceholder,
      valueLabel: activeCopy.value.valueEmail,
    },
    {
      value: "instagram",
      label: activeCopy.value.methodInstagramLabel,
      placeholder: activeCopy.value.methodInstagramPlaceholder,
      valueLabel: activeCopy.value.valueInstagram,
    },
    {
      value: "phone",
      label: activeCopy.value.methodPhoneLabel,
      placeholder: activeCopy.value.methodPhonePlaceholder,
      valueLabel: activeCopy.value.valuePhone,
    },
  ]);

  const activeMethod = computed(
    () => contactMethodOptions.value.find((option) => option.value === contactMethod.value) || contactMethodOptions.value[0]
  );

  const activeAutocomplete = computed(() => {
    if (contactMethod.value === "email") return "email";
    if (contactMethod.value === "phone") return "tel";
    return "username";
  });

  const seoTitle = computed(() =>
    locale.value === "nl"
      ? `${site.value.siteName} heeft je onlangs gefotografeerd`
      : `${site.value.siteName} photographed you recently`
  );
  const seoDescription = computed(() =>
    locale.value === "nl"
      ? `Laat je gegevens achter om je foto’s van ${site.value.siteName} te ontvangen.`
      : `Share your details to receive your photos from ${site.value.siteName}.`
  );

  onMounted(() => {
    const saved = window.localStorage.getItem("street-delivery-locale");

    if (saved === "en" || saved === "nl") {
      locale.value = saved;
      return;
    }

    if (initialLocale === "en") {
      const preferred = window.navigator.language.toLowerCase();

      if (preferred.startsWith("nl")) {
        locale.value = "nl";
      }
    }
  });

  watch(locale, (value) => {
    if (import.meta.client) {
      window.localStorage.setItem("street-delivery-locale", value);
      document.documentElement.lang = value;
    }
  }, { immediate: true });

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
      form.set("consentSend", "true");
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
          ? String((error as { statusMessage?: string }).statusMessage || activeCopy.value.defaultError)
          : activeCopy.value.defaultError;
    } finally {
      submitting.value = false;
    }
  }

  useSeoMeta({
    title: () => seoTitle.value,
    description: () => seoDescription.value,
  });
</script>

<template>
  <main class="street-page">
    <section class="street-shell">
      <div class="street-copy">
        <div class="street-topbar">
          <p class="street-kicker">{{ activeCopy.kicker }}</p>
          <div class="street-language" :aria-label="activeCopy.languageLabel">
            <button
              class="street-language-button"
              :class="{ 'is-active': locale === 'en' }"
              type="button"
              @click="locale = 'en'"
            >
              EN
            </button>
            <button
              class="street-language-button"
              :class="{ 'is-active': locale === 'nl' }"
              type="button"
              @click="locale = 'nl'"
            >
              NL
            </button>
          </div>
        </div>

        <h1>{{ activeCopy.title }}</h1>
        <p class="street-lede">
          {{ activeCopy.intro }}
        </p>
      </div>

      <div class="street-card">
        <template v-if="pending">
          <div class="street-state">
            <h2>{{ activeCopy.loadingTitle }}</h2>
            <p>{{ activeCopy.loadingBody }}</p>
          </div>
        </template>

        <template v-else-if="notFound">
          <div class="street-state">
            <h2>{{ activeCopy.notFoundTitle }}</h2>
            <p>
              {{ activeCopy.notFoundBody }}
              <a href="https://instagram.com/verycrunchy" target="_blank" rel="noopener">@verycrunchy</a>.
            </p>
          </div>
        </template>

        <template v-else-if="submitSuccess">
          <div class="street-state">
            <h2>{{ activeCopy.successTitle }}</h2>
            <p>{{ activeCopy.successBody }}</p>
            <p class="street-note">{{ activeCopy.successNote }}</p>
            <NuxtLink
              v-if="submitSuccess.galleryUrl"
              :to="submitSuccess.galleryUrl"
              class="street-primary"
            >
              {{ activeCopy.viewGallery }}
            </NuxtLink>
          </div>
        </template>

        <template v-else>
          <div v-if="session?.galleryReady && session.galleryToken" class="street-ready">
            <p>{{ activeCopy.readyLabel }}</p>
            <NuxtLink :to="`/g/${session.galleryToken}`">{{ activeCopy.readyAction }}</NuxtLink>
          </div>

          <form class="street-form" @submit.prevent="submitRequest">
            <div class="street-form-head">
              <h2>{{ activeCopy.formTitle }}</h2>
              <p>{{ activeCopy.formIntro }}</p>
            </div>

            <label class="street-field">
              <span>{{ activeCopy.methodLabel }}</span>
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
              <span>{{ activeMethod.valueLabel }}</span>
              <input
                v-model="contactValue"
                :placeholder="activeMethod.placeholder"
                :autocomplete="activeAutocomplete"
                required
              >
            </label>

            <label class="street-field">
              <span>{{ activeCopy.nameLabel }} <small>({{ activeCopy.nameOptional }})</small></span>
              <input
                v-model="firstName"
                :placeholder="activeCopy.namePlaceholder"
                autocomplete="given-name"
              >
            </label>

            <label class="street-field">
              <span>{{ activeCopy.descriptionLabel }} <small>({{ activeCopy.nameOptional }})</small></span>
              <textarea
                v-model="description"
                rows="3"
                :placeholder="activeCopy.descriptionPlaceholder"
              />
            </label>

            <label class="street-field">
              <span>{{ activeCopy.selfieLabel }} <small>({{ activeCopy.selfieHint }})</small></span>
              <input
                type="file"
                accept="image/*"
                @change="onSelfieSelected"
              >
              <small class="street-file-help">{{ activeCopy.selfieHelp }}</small>
              <small v-if="selfieFile" class="street-file">{{ selfieFile.name }}</small>
            </label>

            <label class="street-check">
              <input v-model="consentPublish" type="checkbox">
              <span>{{ activeCopy.publishConsent }}</span>
            </label>

            <p class="street-consent-note">{{ activeCopy.publishHelp }}</p>

            <p v-if="submitError" class="street-error">{{ submitError }}</p>

            <button class="street-primary" :disabled="submitting" type="submit">
              {{ submitting ? activeCopy.submitting : activeCopy.submit }}
            </button>

            <p class="street-note">{{ activeCopy.footerNote }}</p>
          </form>
        </template>
      </div>
    </section>
  </main>
</template>

<style scoped>
  .street-page {
    min-height: 100dvh;
    padding: 4.75rem 1.25rem 2.5rem;
    background:
      radial-gradient(circle at top, rgba(199, 133, 58, 0.16), transparent 30%),
      radial-gradient(circle at bottom left, rgba(92, 125, 172, 0.18), transparent 34%),
      linear-gradient(180deg, rgb(12, 13, 16), rgb(8, 9, 12));
    color: #f5f1ea;
  }

  .street-shell {
    max-width: 72rem;
    margin: 0 auto;
    display: grid;
    gap: 2rem;
  }

  @media (min-width: 980px) {
    .street-shell {
      grid-template-columns: minmax(auto, 1.08fr) minmax(20rem, 31rem);
      align-items: start;
    }
  }

  .street-copy {
    padding-top: 0.75rem;
  }

  .street-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .street-kicker {
    margin: 0;
    font-size: 0.78rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(234, 226, 215, 0.72);
  }

  .street-language {
    display: inline-flex;
    gap: 0.35rem;
    padding: 0.25rem;
    border: 1px solid rgba(226, 213, 195, 0.16);
    border-radius: 999px;
    background: rgba(19, 20, 25, 0.82);
  }

  .street-language-button {
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(234, 226, 215, 0.72);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    cursor: pointer;
    padding: 0.45rem 0.78rem;
    text-transform: uppercase;
  }

  .street-language-button.is-active {
    background: linear-gradient(135deg, rgba(214, 177, 121, 0.22), rgba(201, 138, 61, 0.42));
    color: #fff4e2;
  }

  h1 {
    margin: 0;
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(2.5rem, 5vw, 5rem);
    line-height: 1.2;
    letter-spacing: -0.04em;
    max-width: 12ch;
  }

  .street-lede {
    max-width: 38rem;
    margin: 0.75rem 0 0;
    color: #d1c8bb;
    font-size: 1.02rem;
    line-height: 1.72;
  }

  .street-card {
    border: 1px solid rgba(226, 213, 195, 0.14);
    border-radius: 1.7rem;
    padding: 1.3rem;
    background:
      linear-gradient(180deg, rgba(25, 25, 30, 0.92), rgba(13, 14, 18, 0.96));
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
  }

  .street-form,
  .street-state {
    display: grid;
    gap: 1rem;
  }

  .street-form-head {
    display: grid;
    gap: 0.45rem;
    margin-bottom: 0.15rem;
  }

  .street-form-head h2,
  .street-state h2 {
    margin: 0;
    font-size: 1.35rem;
    letter-spacing: -0.025em;
    color: #fff8ee;
  }

  .street-form-head p,
  .street-state p {
    margin: 0;
    color: #cfc6b8;
    line-height: 1.62;
  }

  .street-ready {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    border: 1px solid rgba(214, 177, 121, 0.24);
    border-radius: 1rem;
    padding: 0.95rem 1rem;
    background: rgba(201, 138, 61, 0.09);
  }

  .street-ready p {
    margin: 0;
    color: #fff3df;
  }

  .street-ready a {
    color: #f6d7ac;
    font-weight: 700;
    text-decoration: none;
  }

  .street-field {
    display: grid;
    gap: 0.52rem;
  }

  .street-field span {
    font-size: 0.9rem;
    color: #f2e7d7;
  }

  .street-field small,
  .street-file,
  .street-file-help {
    color: #9f968a;
  }

  .street-field input,
  .street-field select,
  .street-field textarea {
    width: 100%;
    border: 1px solid rgba(196, 178, 153, 0.24);
    border-radius: 1rem;
    background: rgba(10, 11, 15, 0.88);
    padding: 0.95rem 1rem;
    color: #fff8ee;
    font: inherit;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .street-field input:focus,
  .street-field select:focus,
  .street-field textarea:focus {
    outline: none;
    border-color: rgba(214, 177, 121, 0.72);
    box-shadow: 0 0 0 4px rgba(214, 177, 121, 0.12);
  }

  .street-field textarea {
    resize: vertical;
    min-height: 7rem;
  }

  .street-check {
    display: flex;
    gap: 0.8rem;
    align-items: start;
    color: #f2e7d7;
    line-height: 1.48;
  }

  .street-check input {
    margin-top: 0.18rem;
  }

  .street-consent-note,
  .street-note {
    margin: 0;
    color: #9f968a;
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .street-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 3.15rem;
    border: none;
    border-radius: 1rem;
    background: linear-gradient(135deg, rgb(228, 190, 131), rgb(193, 128, 51));
    color: rgb(21, 14, 7);
    font-weight: 800;
    padding: 0.9rem 1.35rem;
    cursor: pointer;
    text-decoration: none;
    transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
    box-shadow: 0 18px 36px rgba(193, 128, 51, 0.18);
  }

  .street-primary:hover {
    transform: translateY(-1px);
  }

  .street-primary:disabled {
    cursor: wait;
    opacity: 0.68;
    transform: none;
  }

  .street-error {
    margin: 0;
    color: #ffb4b0;
    font-size: 0.94rem;
  }
</style>
