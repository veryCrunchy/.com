import { randomBytes } from "node:crypto";

import {
  createDirectus,
  createItem,
  createItems,
  deleteItem,
  readItems,
  rest,
  staticToken,
  updateItem,
  uploadFiles,
} from "@directus/sdk";
import { createError, getHeader } from "h3";
import type { H3Event } from "h3";

import { getDirectusClient, normalizePhotoSummary } from "~/server/utils/directus";
import type {
  CmsPhotoSummary,
  CmsStreetDeliveryAdminContactPreview,
  CmsStreetDeliveryAdminPhotoLink,
  CmsStreetDeliveryAdminSessionDetail,
  CmsStreetDeliveryDistributionState,
  CmsStreetDeliveryAdminSessionSummary,
  CmsStreetDeliveryContactMethod,
  CmsStreetDeliveryGallery,
  CmsStreetDeliverySessionPublic,
  CmsStreetDeliverySubmissionResult,
  DirectusAsset,
  DirectusPhoto,
  DirectusSchema,
  DirectusStreetDeliveryContact,
  DirectusStreetDeliverySession,
  DirectusStreetDeliverySessionPhoto,
} from "~/types/directus";

const SESSION_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const GALLERY_TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const STREET_PHOTO_SLUG_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";
const SESSION_CODE_BODY_LENGTH = 10;
const GALLERY_TOKEN_LENGTH = 24;

const STREET_SESSION_FIELDS = [
  "id",
  "status",
  "code",
  "date_created",
  "date_updated",
  "distribution_state",
  "printed_at",
  "photographed_at",
  "location",
  "public_enabled",
  "gallery_token",
  "last_submission_at",
  "delivered_at",
  "notes",
] as const;

const STREET_SESSION_FIELDS_FALLBACK = [
  "id",
  "status",
  "code",
  "date_created",
  "date_updated",
  "photographed_at",
  "location",
  "public_enabled",
  "gallery_token",
  "last_submission_at",
  "delivered_at",
  "notes",
] as const;

const STREET_SESSION_FIELDS_WITH_DISTRIBUTION = [
  "id",
  "status",
  "code",
  "date_created",
  "date_updated",
  "distribution_state",
  "photographed_at",
  "location",
  "public_enabled",
  "gallery_token",
  "last_submission_at",
  "delivered_at",
  "notes",
] as const;

const STREET_SESSION_FIELDS_WITH_PRINTED_AT = [
  "id",
  "status",
  "code",
  "date_created",
  "date_updated",
  "printed_at",
  "photographed_at",
  "location",
  "public_enabled",
  "gallery_token",
  "last_submission_at",
  "delivered_at",
  "notes",
] as const;

const STREET_CONTACT_FIELDS = [
  "id",
  "street_delivery_sessions_id",
  "date_created",
  "method",
  "value",
  "first_name",
  "description",
  "consent_publish",
] as const;

const STREET_SESSION_PHOTO_FIELDS = [
  "id",
  "street_delivery_sessions_id",
  "photos_id",
  "sort",
] as const;

const STREET_GALLERY_LINK_FIELDS = [
  "id",
  "street_delivery_sessions_id",
  "sort",
  {
    photos_id: [
      "id",
      "slug",
      "title",
      "description",
      "published_at",
      "taken_at",
      "location",
      "camera",
      "lens",
      "tags",
      {
        image: ["id", "title", "description", "width", "height", "filename_download"],
      },
    ],
  },
] as const;

type StreetDeliveryClient = NonNullable<ReturnType<typeof getDirectusClient>>;
type DirectusTokenClient = NonNullable<ReturnType<typeof getDirectusClient>>;

type StreetDeliverySessionQueryResult = {
  sessions: DirectusStreetDeliverySession[];
  printedAtAvailable: boolean;
  distributionStateAvailable: boolean;
};

export type StreetDeliverySubmissionInput = {
  contactMethod: CmsStreetDeliveryContactMethod;
  contactValue: string;
  firstName?: string | null;
  description?: string | null;
  consentSend: boolean;
  consentPublish: boolean;
  selfie?:
    | {
        filename?: string;
        type?: string;
        data: Uint8Array;
      }
    | null;
};

export type StreetDeliveryAdminBatchCreateInput = {
  count?: number;
  prefix?: string | null;
};

export type StreetDeliveryAdminSessionUpdateInput = {
  status?: string | null;
  photographedAt?: string | null;
  location?: string | null;
  publicEnabled?: boolean;
  distributionState?: CmsStreetDeliveryDistributionState | null;
  printedAt?: string | null;
  regenerateGalleryToken?: boolean;
};

export type StreetDeliveryAdminUploadInput = {
  files: Array<{
    filename?: string;
    type?: string;
    data: Uint8Array;
  }>;
};

function requireStreetDeliveryClient(event?: H3Event): StreetDeliveryClient {
  const config = useRuntimeConfig(event);

  if (!config.directusToken) {
    throw createError({
      statusCode: 503,
      statusMessage: "Street delivery requires a server-side DIRECTUS_TOKEN.",
    });
  }

  const client = getDirectusClient(event);

  if (!client) {
    throw createError({
      statusCode: 503,
      statusMessage: "Directus is not configured.",
    });
  }

  return client;
}

function requireStreetDeliveryAdminClient(event: H3Event) {
  const directusUrl = useRuntimeConfig(event).public.directusUrl;

  if (!directusUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: "Directus is not configured.",
    });
  }

  const authHeader = getHeader(event, "authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Directus sign-in required.",
    });
  }

  return createDirectus<DirectusSchema>(directusUrl).with(rest()).with(staticToken(token));
}

function withDirectusAuthGuard(error: unknown): never {
  const statusCode =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status)
      : typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 500;

  if (statusCode === 401 || statusCode === 403) {
    throw createError({
      statusCode: 401,
      statusMessage: "Directus sign-in required.",
    });
  }

  throw error;
}

function isOptionalSessionFieldUnavailableError(
  error: unknown,
  field: "printed_at" | "distribution_state"
) {
  const fragments: string[] = [];

  const visit = (value: unknown, depth = 0) => {
    if (depth > 4 || value == null) {
      return;
    }

    if (typeof value === "string") {
      fragments.push(value);
      return;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      fragments.push(String(value));
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry, depth + 1);
      }

      return;
    }

    if (typeof value === "object") {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (key === "response" || key === "request" || key === "stack" || key === "cause") {
          continue;
        }

        visit(entry, depth + 1);
      }
    }
  };

  visit(error);

  const text = fragments.join(" | ");

  return (
    text.includes(field)
    && /(permission|access field|does not exist|unknown field|forbidden|invalid)/i.test(text)
  );
}

function createPrintedAtUnavailableError() {
  return createError({
    statusCode: 503,
    statusMessage:
      "The `printed_at` field is not available to this Directus role yet. Run the street-delivery setup and grant your admin role access to that field.",
  });
}

function createDistributionStateUnavailableError() {
  return createError({
    statusCode: 503,
    statusMessage:
      "The `distribution_state` field is not available to this Directus role yet. Run the street-delivery setup and grant your admin role access to that field.",
  });
}

function normalizeDistributionState(
  value: string | null | undefined,
  printedAt?: string | null
): CmsStreetDeliveryDistributionState {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "printed" || normalized === "sent") {
    return normalized;
  }

  if (printedAt) {
    return "printed";
  }

  return "available";
}

function stripDistributionStateFromItems(items: Array<Record<string, unknown>>) {
  return items.map(({ distribution_state: _distributionState, ...item }) => item);
}

async function readStreetDeliverySessionRecords(
  client: StreetDeliveryClient | DirectusTokenClient,
  query: Record<string, unknown>
): Promise<StreetDeliverySessionQueryResult> {
  try {
    const sessions = (await client.request(
      readItems("street_delivery_sessions", {
        ...query,
        fields: STREET_SESSION_FIELDS as never,
      })
    )) as DirectusStreetDeliverySession[];

    return {
      sessions,
      printedAtAvailable: true,
      distributionStateAvailable: true,
    };
  } catch (error) {
    if (
      !isOptionalSessionFieldUnavailableError(error, "distribution_state")
      && !isOptionalSessionFieldUnavailableError(error, "printed_at")
    ) {
      throw error;
    }
  }

  try {
    const sessions = (await client.request(
      readItems("street_delivery_sessions", {
        ...query,
        fields: STREET_SESSION_FIELDS_WITH_PRINTED_AT as never,
      })
    )) as DirectusStreetDeliverySession[];

    return {
      sessions,
      printedAtAvailable: true,
      distributionStateAvailable: false,
    };
  } catch (error) {
    if (!isOptionalSessionFieldUnavailableError(error, "printed_at")) {
      throw error;
    }
  }

  try {
    const sessions = (await client.request(
      readItems("street_delivery_sessions", {
        ...query,
        fields: STREET_SESSION_FIELDS_WITH_DISTRIBUTION as never,
      })
    )) as DirectusStreetDeliverySession[];

    return {
      sessions,
      printedAtAvailable: false,
      distributionStateAvailable: true,
    };
  } catch (error) {
    if (
      !isOptionalSessionFieldUnavailableError(error, "distribution_state")
      && !isOptionalSessionFieldUnavailableError(error, "printed_at")
    ) {
      throw error;
    }
  }

  const sessions = (await client.request(
    readItems("street_delivery_sessions", {
      ...query,
      fields: STREET_SESSION_FIELDS_FALLBACK as never,
    })
  )) as DirectusStreetDeliverySession[];

  return {
    sessions,
    printedAtAvailable: false,
    distributionStateAvailable: false,
  };
}

async function createStreetDeliverySessionRecords(
  client: DirectusTokenClient,
  items: Array<Record<string, unknown>>
): Promise<StreetDeliverySessionQueryResult> {
  try {
    const sessions = (await client.request(
      createItems("street_delivery_sessions", items, {
        fields: STREET_SESSION_FIELDS as never,
      })
    )) as DirectusStreetDeliverySession[];

    return {
      sessions,
      printedAtAvailable: true,
      distributionStateAvailable: true,
    };
  } catch (error) {
    if (!isOptionalSessionFieldUnavailableError(error, "distribution_state")) {
      throw error;
    }
  }

  try {
    const sessions = (await client.request(
      createItems("street_delivery_sessions", stripDistributionStateFromItems(items), {
        fields: STREET_SESSION_FIELDS_WITH_PRINTED_AT as never,
      })
    )) as DirectusStreetDeliverySession[];

    return {
      sessions,
      printedAtAvailable: true,
      distributionStateAvailable: false,
    };
  } catch (error) {
    if (!isOptionalSessionFieldUnavailableError(error, "printed_at")) {
      throw error;
    }
  }

  try {
    const sessions = (await client.request(
      createItems("street_delivery_sessions", items, {
        fields: STREET_SESSION_FIELDS_WITH_DISTRIBUTION as never,
      })
    )) as DirectusStreetDeliverySession[];

    return {
      sessions,
      printedAtAvailable: false,
      distributionStateAvailable: true,
    };
  } catch (error) {
    if (!isOptionalSessionFieldUnavailableError(error, "distribution_state")) {
      throw error;
    }
  }

  const sessions = (await client.request(
    createItems("street_delivery_sessions", stripDistributionStateFromItems(items), {
      fields: STREET_SESSION_FIELDS_FALLBACK as never,
    })
  )) as DirectusStreetDeliverySession[];

  return {
    sessions,
    printedAtAvailable: false,
    distributionStateAvailable: false,
  };
}

function normalizeSessionCode(rawCode: string) {
  const code = String(rawCode || "").trim().toUpperCase();

  if (!/^[A-Z0-9-]{6,32}$/.test(code)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid session code.",
    });
  }

  return code;
}

function normalizeStreetDeliverySession(
  session: DirectusStreetDeliverySession
): CmsStreetDeliverySessionPublic {
  const galleryToken =
    session.status === "delivered" && session.gallery_token
      ? session.gallery_token
      : null;

  return {
    id: session.id,
    code: session.code,
    status: session.status || null,
    photographedAt: session.photographed_at || null,
    location: session.location || null,
    galleryToken,
    galleryReady: Boolean(galleryToken),
  };
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeOptionalDatetime(value: string | null | undefined) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid datetime value.",
    });
  }

  return parsed.toISOString();
}

function normalizeContactValue(
  method: CmsStreetDeliveryContactMethod,
  value: string
) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    throw createError({
      statusCode: 400,
      statusMessage: "Contact value is required.",
    });
  }

  if (method === "email") {
    const email = trimmed.toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Enter a valid email address.",
      });
    }

    return email;
  }

  if (method === "instagram") {
    const handle = trimmed.replace(/^@+/, "").toLowerCase();

    if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Enter a valid Instagram handle.",
      });
    }

    return handle;
  }

  const compact = trimmed.replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");

  if (digits.length < 7) {
    throw createError({
      statusCode: 400,
      statusMessage: "Enter a valid phone number.",
    });
  }

  return compact;
}

function normalizeContactMethod(rawMethod: string): CmsStreetDeliveryContactMethod {
  const method = String(rawMethod || "").trim().toLowerCase();

  if (method === "email" || method === "instagram" || method === "phone") {
    return method;
  }

  throw createError({
    statusCode: 400,
    statusMessage: "Choose a valid contact method.",
  });
}

function normalizeSessionStatus(rawStatus: string | null | undefined) {
  const value = String(rawStatus || "").trim().toLowerCase();

  if (!value) {
    return null;
  }

  if (value === "new" || value === "matched" || value === "delivered" || value === "archived") {
    return value;
  }

  throw createError({
    statusCode: 400,
    statusMessage: "Invalid status.",
  });
}

function slugifyValue(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function filenameStem(filename: string) {
  return String(filename || "").replace(/\.[^.]+$/, "");
}

function filenameToTitle(filename: string) {
  const stem = filenameStem(filename)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stem) {
    return "Street Delivery Photo";
  }

  return stem
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createStreetDeliveryPhotoSlug(sessionCode: string, filename: string) {
  const base = slugifyValue(`${sessionCode} ${filenameStem(filename)}`) || slugifyValue(sessionCode) || "street-delivery";
  const suffix = randomFromAlphabet(6, STREET_PHOTO_SLUG_ALPHABET);

  return `${base.slice(0, 96)}-${suffix}`;
}

function normalizeAdminPhotoLink(
  event: H3Event | undefined,
  link: DirectusStreetDeliverySessionPhoto
): CmsStreetDeliveryAdminPhotoLink {
  return {
    id: link.id,
    sort: link.sort ?? null,
    photo:
      link.photos_id && typeof link.photos_id === "object"
        ? normalizePhotoSummary(event, link.photos_id as DirectusPhoto)
        : null,
  };
}

function randomFromAlphabet(length: number, alphabet: string) {
  const maxByte = Math.floor(256 / alphabet.length) * alphabet.length;
  let result = "";

  while (result.length < length) {
    const bytes = randomBytes(length * 2);

    for (const value of bytes) {
      if (value >= maxByte) {
        continue;
      }

      result += alphabet[value % alphabet.length];

      if (result.length === length) {
        break;
      }
    }
  }

  return result;
}

function sanitizeCodePrefix(prefix?: string | null) {
  const normalized = String(prefix || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    return "";
  }

  return normalized.slice(0, 12);
}

function formatSessionCodeBody(body: string) {
  if (body.length <= 5) {
    return body;
  }

  return `${body.slice(0, 5)}-${body.slice(5)}`;
}

function createRandomSessionCode(prefix?: string | null) {
  const safePrefix = sanitizeCodePrefix(prefix);
  const body = formatSessionCodeBody(
    randomFromAlphabet(SESSION_CODE_BODY_LENGTH, SESSION_CODE_ALPHABET)
  );

  return safePrefix ? `${safePrefix}-${body}` : body;
}

function createRandomGalleryToken() {
  return randomFromAlphabet(GALLERY_TOKEN_LENGTH, GALLERY_TOKEN_ALPHABET);
}

async function existingValuesForField(
  client: StreetDeliveryClient | DirectusTokenClient,
  collection: "street_delivery_sessions",
  field: "code" | "gallery_token",
  values: string[]
) {
  if (!values.length) {
    return new Set<string>();
  }

  const rows = (await client.request(
    readItems(collection, {
      fields: [field] as never,
      filter: {
        [field]: {
          _in: values as never,
        },
      } as never,
      limit: -1,
    })
  )) as Array<Record<string, string | null | undefined>>;

  return new Set(
    rows
      .map((row) => String(row[field] || ""))
      .filter(Boolean)
  );
}

async function generateUniqueSessionCodes(
  client: StreetDeliveryClient | DirectusTokenClient,
  count: number,
  prefix?: string | null
) {
  const codes = new Set<string>();

  while (true) {
    while (codes.size < count) {
      codes.add(createRandomSessionCode(prefix));
    }

    const existing = await existingValuesForField(
      client,
      "street_delivery_sessions",
      "code",
      [...codes]
    );

    if (!existing.size) {
      return [...codes];
    }

    for (const code of existing) {
      codes.delete(code);
    }
  }
}

async function generateUniqueGalleryTokens(
  client: StreetDeliveryClient | DirectusTokenClient,
  count: number
) {
  const tokens = new Set<string>();

  while (true) {
    while (tokens.size < count) {
      tokens.add(createRandomGalleryToken());
    }

    const existing = await existingValuesForField(
      client,
      "street_delivery_sessions",
      "gallery_token",
      [...tokens]
    );

    if (!existing.size) {
      return [...tokens];
    }

    for (const token of existing) {
      tokens.delete(token);
    }
  }
}

async function findStreetDeliverySessionByCode(
  event: H3Event | undefined,
  code: string
) {
  const client = requireStreetDeliveryClient(event);
  const { sessions } = await readStreetDeliverySessionRecords(client, {
    filter: {
      code: { _eq: normalizeSessionCode(code) },
      public_enabled: { _eq: true },
    },
    limit: 1,
  });
  const [session] = sessions;

  if (!session || session.status === "archived") {
    return null;
  }

  return session;
}

async function uploadStreetDeliverySelfie(
  event: H3Event | undefined,
  code: string,
  selfie: NonNullable<StreetDeliverySubmissionInput["selfie"]>
) {
  if (!selfie.data?.length) {
    return null;
  }

  if (selfie.data.length > 10 * 1024 * 1024) {
    throw createError({
      statusCode: 400,
      statusMessage: "Selfie uploads must be 10 MB or smaller.",
    });
  }

  const client = requireStreetDeliveryClient(event);
  const filename = String(selfie.filename || `street-delivery-${code}.jpg`)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || `street-delivery-${code}.jpg`;
  const file = new File([Buffer.from(selfie.data)], filename, {
    type: selfie.type || "application/octet-stream",
  });
  const form = new FormData();

  form.set("file", file);
  form.set("title", `Street delivery selfie ${code}`);
  form.set("description", `Optional selfie reference for session ${code}`);

  const uploaded = (await client.request(
    uploadFiles(form, {
      fields: ["id", "title", "description", "width", "height", "filename_download"] as never,
    })
  )) as DirectusAsset | DirectusAsset[];

  return Array.isArray(uploaded) ? uploaded[0] || null : uploaded;
}

function normalizeAdminContactPreview(
  contact: DirectusStreetDeliveryContact
): CmsStreetDeliveryAdminContactPreview {
  return {
    id: contact.id,
    dateCreated: contact.date_created || null,
    method: contact.method,
    value: contact.value,
    firstName: contact.first_name || null,
    description: contact.description || null,
    consentPublish: Boolean(contact.consent_publish),
  };
}

function normalizeAdminSessionSummary(
  session: DirectusStreetDeliverySession,
  contacts: DirectusStreetDeliveryContact[],
  photoCount: number
): CmsStreetDeliveryAdminSessionSummary {
  const latestContact = contacts[0] ? normalizeAdminContactPreview(contacts[0]) : null;
  const galleryReady = Boolean(session.status === "delivered" && session.gallery_token);
  const distributionState = normalizeDistributionState(session.distribution_state, session.printed_at);

  return {
    id: session.id,
    code: session.code,
    status: session.status || null,
    createdAt: session.date_created || null,
    updatedAt: session.date_updated || null,
    distributionState,
    printedAt: session.printed_at || null,
    printed: distributionState === "printed",
    photographedAt: session.photographed_at || null,
    location: session.location || null,
    publicEnabled: Boolean(session.public_enabled),
    galleryToken: session.gallery_token || null,
    galleryReady,
    lastSubmissionAt: session.last_submission_at || null,
    deliveredAt: session.delivered_at || null,
    contactCount: contacts.length,
    photoCount,
    publicPath: `/p/${encodeURIComponent(session.code)}`,
    galleryPath: galleryReady ? `/g/${encodeURIComponent(session.gallery_token || "")}` : null,
    latestContact,
  };
}

async function readAdminSessionSummaries(
  client: DirectusTokenClient,
  filter?: Record<string, unknown>
) {
  const { sessions } = await readStreetDeliverySessionRecords(client, {
    filter: filter as never,
    sort: ["-date_created", "-id"] as never,
    limit: -1,
  });

  if (!sessions.length) {
    return [];
  }

  const sessionIds = sessions.map((session) => session.id);
  const contacts = (await client.request(
    readItems("street_delivery_contacts", {
      fields: STREET_CONTACT_FIELDS as never,
      filter: {
        street_delivery_sessions_id: {
          _in: sessionIds as never,
        },
      },
      sort: ["-date_created", "-id"] as never,
      limit: -1,
    })
  )) as DirectusStreetDeliveryContact[];
  const photoLinks = (await client.request(
    readItems("street_delivery_session_photos", {
      fields: STREET_SESSION_PHOTO_FIELDS as never,
      filter: {
        street_delivery_sessions_id: {
          _in: sessionIds as never,
        },
      },
      limit: -1,
    })
  )) as DirectusStreetDeliverySessionPhoto[];

  const contactsBySessionId = new Map<number, DirectusStreetDeliveryContact[]>();
  const photoCountBySessionId = new Map<number, number>();

  for (const contact of contacts) {
    const sessionId = Number(contact.street_delivery_sessions_id);
    const group = contactsBySessionId.get(sessionId) ?? [];
    group.push(contact);
    contactsBySessionId.set(sessionId, group);
  }

  for (const link of photoLinks) {
    const sessionId = Number(link.street_delivery_sessions_id);
    photoCountBySessionId.set(sessionId, (photoCountBySessionId.get(sessionId) ?? 0) + 1);
  }

  return sessions.map((session) =>
    normalizeAdminSessionSummary(
      session,
      contactsBySessionId.get(session.id) ?? [],
      photoCountBySessionId.get(session.id) ?? 0
    )
  );
}

async function readAdminSessionDetail(
  event: H3Event,
  client: DirectusTokenClient,
  sessionId: number
): Promise<CmsStreetDeliveryAdminSessionDetail> {
  const [summary] = await readAdminSessionSummaries(client, { id: { _eq: sessionId } });

  if (!summary) {
    throw createError({
      statusCode: 404,
      statusMessage: "Session not found.",
    });
  }

  const contacts = (await client.request(
    readItems("street_delivery_contacts", {
      fields: STREET_CONTACT_FIELDS as never,
      filter: {
        street_delivery_sessions_id: { _eq: sessionId },
      },
      sort: ["-date_created", "-id"] as never,
      limit: -1,
    })
  )) as DirectusStreetDeliveryContact[];
  const photoLinks = (await client.request(
    readItems("street_delivery_session_photos", {
      fields: STREET_GALLERY_LINK_FIELDS as never,
      filter: {
        street_delivery_sessions_id: { _eq: sessionId },
      },
      sort: ["sort", "id"] as never,
      limit: -1,
    })
  )) as DirectusStreetDeliverySessionPhoto[];

  return {
    ...summary,
    contacts: contacts.map((contact) => normalizeAdminContactPreview(contact)),
    photos: photoLinks.map((link) => normalizeAdminPhotoLink(event, link)),
  };
}

export async function readStreetDeliverySessionByCode(
  event: H3Event | undefined,
  code: string
) {
  const session = await findStreetDeliverySessionByCode(event, code);

  return session ? normalizeStreetDeliverySession(session) : null;
}

export async function submitStreetDeliveryInquiry(
  event: H3Event | undefined,
  code: string,
  input: StreetDeliverySubmissionInput
): Promise<CmsStreetDeliverySubmissionResult> {
  if (!input.consentSend) {
    throw createError({
      statusCode: 400,
      statusMessage: "Consent is required before you can request your photos.",
    });
  }

  const session = await findStreetDeliverySessionByCode(event, code);

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: "Session not found.",
    });
  }

  const client = requireStreetDeliveryClient(event);
  const contactMethod = normalizeContactMethod(input.contactMethod);
  const contactValue = normalizeContactValue(contactMethod, input.contactValue);
  const firstName = normalizeOptionalText(input.firstName, 80);
  const description = normalizeOptionalText(input.description, 500);
  const selfieAsset = input.selfie
    ? await uploadStreetDeliverySelfie(event, session.code, input.selfie)
    : null;
  const [existingContact] = (await client.request(
    readItems("street_delivery_contacts", {
      fields: ["id"] as never,
      filter: {
        street_delivery_sessions_id: { _eq: session.id },
        method: { _eq: contactMethod },
        value: { _eq: contactValue },
      },
      limit: 1,
    })
  )) as Array<{ id: number }>;

  const contactPayload = {
    street_delivery_sessions_id: session.id,
    method: contactMethod,
    value: contactValue,
    first_name: firstName,
    description,
    selfie: selfieAsset?.id ?? null,
    consent_send: true,
    consent_publish: Boolean(input.consentPublish),
  };

  if (existingContact) {
    await client.request(
      updateItem("street_delivery_contacts", existingContact.id, contactPayload)
    );
  } else {
    await client.request(
      createItem("street_delivery_contacts", contactPayload)
    );
  }

  await client.request(
    updateItem("street_delivery_sessions", session.id, {
      last_submission_at: new Date().toISOString(),
    })
  );

  const normalizedSession = normalizeStreetDeliverySession(session);

  return {
    session: normalizedSession,
    galleryUrl: normalizedSession.galleryToken
      ? `/g/${normalizedSession.galleryToken}`
      : null,
  };
}

export async function readStreetDeliveryGalleryByToken(
  event: H3Event | undefined,
  token: string
): Promise<CmsStreetDeliveryGallery | null> {
  const client = requireStreetDeliveryClient(event);
  const galleryToken = String(token || "").trim();

  if (!/^[A-Za-z0-9_-]{12,128}$/.test(galleryToken)) {
    return null;
  }

  const { sessions } = await readStreetDeliverySessionRecords(client, {
    filter: {
      gallery_token: { _eq: galleryToken },
      public_enabled: { _eq: true },
      status: { _eq: "delivered" },
    },
    limit: 1,
  });
  const [session] = sessions;

  if (!session || !session.gallery_token) {
    return null;
  }

  const [contact] = (await client.request(
    readItems("street_delivery_contacts", {
      fields: ["id"] as never,
      filter: {
        street_delivery_sessions_id: { _eq: session.id },
      },
      limit: 1,
    })
  )) as Array<{ id: number }>;

  if (!contact) {
    return null;
  }

  const links = (await client.request(
    readItems("street_delivery_session_photos", {
      fields: STREET_GALLERY_LINK_FIELDS as never,
      filter: {
        street_delivery_sessions_id: { _eq: session.id },
      },
      sort: ["sort", "id"] as never,
      limit: -1,
    })
  )) as DirectusStreetDeliverySessionPhoto[];

  const photos: CmsPhotoSummary[] = links
    .filter((link) => link.photos_id && typeof link.photos_id === "object")
    .map((link) => normalizePhotoSummary(event, link.photos_id as DirectusPhoto));

  return {
    session: normalizeStreetDeliverySession(session),
    photos,
  };
}

export async function readStreetDeliveryAdminSessions(
  event: H3Event
): Promise<CmsStreetDeliveryAdminSessionSummary[]> {
  const client = requireStreetDeliveryAdminClient(event);

  try {
    return await readAdminSessionSummaries(client);
  } catch (error) {
    withDirectusAuthGuard(error);
  }
}

export async function readStreetDeliveryAdminSessionDetail(
  event: H3Event,
  sessionId: number
): Promise<CmsStreetDeliveryAdminSessionDetail> {
  const client = requireStreetDeliveryAdminClient(event);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid session id.",
    });
  }

  try {
    return await readAdminSessionDetail(event, client, sessionId);
  } catch (error) {
    withDirectusAuthGuard(error);
  }
}

export async function uploadStreetDeliveryAdminPhotos(
  event: H3Event,
  sessionId: number,
  input: StreetDeliveryAdminUploadInput
): Promise<CmsStreetDeliveryAdminSessionDetail> {
  const client = requireStreetDeliveryAdminClient(event);
  const files = (input.files || []).filter((file) => file.data?.length);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid session id.",
    });
  }

  if (!files.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose at least one photo to upload.",
    });
  }

  if (files.length > 40) {
    throw createError({
      statusCode: 400,
      statusMessage: "Upload 40 photos or fewer at a time.",
    });
  }

  try {
    const { sessions } = await readStreetDeliverySessionRecords(client, {
      filter: { id: { _eq: sessionId } },
      limit: 1,
    });
    const [session] = sessions;

    if (!session) {
      throw createError({
        statusCode: 404,
        statusMessage: "Session not found.",
      });
    }

    const existingLinks = (await client.request(
      readItems("street_delivery_session_photos", {
        fields: ["id", "sort"] as never,
        filter: {
          street_delivery_sessions_id: { _eq: sessionId },
        },
        sort: ["sort", "id"] as never,
        limit: -1,
      })
    )) as Array<{ id: number; sort?: number | null }>;
    let nextSort = existingLinks.reduce((max, link) => Math.max(max, Number(link.sort) || 0), 0) + 1;

    for (const fileEntry of files) {
      if (fileEntry.data.length > 30 * 1024 * 1024) {
        throw createError({
          statusCode: 400,
          statusMessage: "Each photo must be 30 MB or smaller.",
        });
      }

      const filename =
        String(fileEntry.filename || "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
        || `street-delivery-${session.code}-${nextSort}.jpg`;
      const file = new File([Buffer.from(fileEntry.data)], filename, {
        type: fileEntry.type || "application/octet-stream",
      });
      const form = new FormData();
      const title = filenameToTitle(filename);

      form.set("file", file);
      form.set("title", title);
      form.set("description", `Street delivery upload for session ${session.code}`);

      const uploaded = (await client.request(
        uploadFiles(form, {
          fields: ["id", "title", "description", "width", "height", "filename_download"] as never,
        })
      )) as DirectusAsset | DirectusAsset[];
      const asset = Array.isArray(uploaded) ? uploaded[0] || null : uploaded;

      if (!asset?.id) {
        throw createError({
          statusCode: 500,
          statusMessage: "Directus file upload failed.",
        });
      }

      const photo = (await client.request(
        createItem(
          "photos",
          {
            status: "draft",
            slug: createStreetDeliveryPhotoSlug(session.code, filename),
            title,
            description: `Street delivery photo for session ${session.code}`,
            image: asset.id,
            published_at: null,
            taken_at: session.photographed_at || null,
            location: session.location || null,
            camera: null,
            lens: null,
            featured: false,
            tags: ["street-delivery", slugifyValue(session.code)],
          },
          {
            fields: [
              "id",
              "slug",
              "title",
              "description",
              "published_at",
              "taken_at",
              "location",
              "camera",
              "lens",
              "tags",
              {
                image: ["id", "title", "description", "width", "height", "filename_download"],
              },
            ] as never,
          }
        )
      )) as DirectusPhoto;

      await client.request(
        createItem("street_delivery_session_photos", {
          street_delivery_sessions_id: sessionId,
          photos_id: photo.id,
          sort: nextSort,
        })
      );

      nextSort += 1;
    }

    if (session.status === "new") {
      await client.request(
        updateItem("street_delivery_sessions", sessionId, {
          status: "matched",
        })
      );
    }

    return await readAdminSessionDetail(event, client, sessionId);
  } catch (error) {
    withDirectusAuthGuard(error);
  }
}

export async function deleteStreetDeliveryAdminSessionPhotoLink(
  event: H3Event,
  linkId: number
): Promise<CmsStreetDeliveryAdminSessionDetail> {
  const client = requireStreetDeliveryAdminClient(event);

  if (!Number.isInteger(linkId) || linkId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid photo link id.",
    });
  }

  try {
    const [link] = (await client.request(
      readItems("street_delivery_session_photos", {
        fields: ["id", "street_delivery_sessions_id"] as never,
        filter: { id: { _eq: linkId } },
        limit: 1,
      })
    )) as Array<{ id: number; street_delivery_sessions_id: number }>;

    if (!link) {
      throw createError({
        statusCode: 404,
        statusMessage: "Linked photo not found.",
      });
    }

    await client.request(
      deleteItem("street_delivery_session_photos", linkId)
    );

    return await readAdminSessionDetail(event, client, Number(link.street_delivery_sessions_id));
  } catch (error) {
    withDirectusAuthGuard(error);
  }
}

export async function createStreetDeliveryAdminBatch(
  event: H3Event,
  input: StreetDeliveryAdminBatchCreateInput
): Promise<CmsStreetDeliveryAdminSessionSummary[]> {
  const client = requireStreetDeliveryAdminClient(event);
  const count = Math.max(1, Math.min(200, Number(input.count || 1)));
  const prefix = sanitizeCodePrefix(input.prefix);

  try {
    const [codes, galleryTokens] = await Promise.all([
      generateUniqueSessionCodes(client, count, prefix),
      generateUniqueGalleryTokens(client, count),
    ]);

    const { sessions: created } = await createStreetDeliverySessionRecords(
      client,
      codes.map((code, index) => ({
        code,
        status: "new",
        distribution_state: "available",
        public_enabled: true,
        gallery_token: galleryTokens[index],
      }))
    );

    return created.map((session) => normalizeAdminSessionSummary(session, [], 0));
  } catch (error) {
    withDirectusAuthGuard(error);
  }
}

export async function updateStreetDeliveryAdminSession(
  event: H3Event,
  sessionId: number,
  input: StreetDeliveryAdminSessionUpdateInput
): Promise<CmsStreetDeliveryAdminSessionSummary> {
  const client = requireStreetDeliveryAdminClient(event);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid session id.",
    });
  }

  try {
    const sessionQuery = await readStreetDeliverySessionRecords(client, {
      filter: { id: { _eq: sessionId } },
      limit: 1,
    });
    const [session] = sessionQuery.sessions;

    if (!session) {
      throw createError({
        statusCode: 404,
        statusMessage: "Session not found.",
      });
    }

    const nextStatus = normalizeSessionStatus(input.status);

    const payload: Record<string, unknown> = {};

    if (nextStatus) {
      payload.status = nextStatus;
    }

    if ("photographedAt" in input) {
      payload.photographed_at = normalizeOptionalDatetime(input.photographedAt);
    }

    if ("location" in input) {
      payload.location = normalizeOptionalText(input.location, 255);
    }

    if ("publicEnabled" in input) {
      payload.public_enabled = Boolean(input.publicEnabled);
    }

    if ("distributionState" in input) {
      const nextDistributionState = normalizeDistributionState(input.distributionState, null);

      if (sessionQuery.distributionStateAvailable) {
        payload.distribution_state = nextDistributionState;
      } else if (nextDistributionState === "available" || nextDistributionState === "printed") {
        if (!sessionQuery.printedAtAvailable) {
          throw createDistributionStateUnavailableError();
        }

        payload.printed_at = nextDistributionState === "printed" ? new Date().toISOString() : null;
      } else {
        throw createDistributionStateUnavailableError();
      }
    } else if ("printedAt" in input) {
      if (!sessionQuery.printedAtAvailable) {
        throw createPrintedAtUnavailableError();
      }

      payload.printed_at = normalizeOptionalDatetime(input.printedAt);
    }

    if (input.regenerateGalleryToken) {
      const [token] = await generateUniqueGalleryTokens(client, 1);
      payload.gallery_token = token;
    }

    if ((nextStatus === "delivered" || session.status === "delivered") && !session.gallery_token && !payload.gallery_token) {
      const [token] = await generateUniqueGalleryTokens(client, 1);
      payload.gallery_token = token;
    }

    if (nextStatus === "delivered" && !session.delivered_at) {
      payload.delivered_at = new Date().toISOString();
    }

    if (!Object.keys(payload).length) {
      return (await readAdminSessionSummaries(client, { id: { _eq: sessionId } }))[0]!;
    }

    await client.request(
      updateItem("street_delivery_sessions", sessionId, payload)
    );

    return (await readAdminSessionSummaries(client, { id: { _eq: sessionId } }))[0]!;
  } catch (error) {
    withDirectusAuthGuard(error);
  }
}

export async function deleteStreetDeliveryAdminSession(
  event: H3Event,
  sessionId: number
) {
  const client = requireStreetDeliveryAdminClient(event);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid session id.",
    });
  }

  try {
    const sessionQuery = await readStreetDeliverySessionRecords(client, {
      filter: { id: { _eq: sessionId } },
      limit: 1,
    });
    const [session] = sessionQuery.sessions;

    if (!session) {
      throw createError({
        statusCode: 404,
        statusMessage: "Session not found.",
      });
    }

    const distributionState = normalizeDistributionState(session.distribution_state, session.printed_at);

    if (distributionState !== "available") {
      throw createError({
        statusCode: 409,
        statusMessage: "Only available codes can be deleted. Reset the code state first if this was a mistake.",
      });
    }

    const [contactCountRow] = (await client.request(
      readItems("street_delivery_contacts", {
        fields: ["id"] as never,
        filter: {
          street_delivery_sessions_id: { _eq: sessionId },
        },
        limit: 1,
      })
    )) as Array<{ id: number }>;
    const [photoLinkRow] = (await client.request(
      readItems("street_delivery_session_photos", {
        fields: ["id"] as never,
        filter: {
          street_delivery_sessions_id: { _eq: sessionId },
        },
        limit: 1,
      })
    )) as Array<{ id: number }>;

    if (contactCountRow || photoLinkRow) {
      throw createError({
        statusCode: 409,
        statusMessage: "Only unused codes can be deleted. This session already has contact or photo data attached.",
      });
    }

    await client.request(
      deleteItem("street_delivery_sessions", sessionId)
    );

    return { success: true };
  } catch (error) {
    withDirectusAuthGuard(error);
  }
}

export function generateStreetDeliveryCodesForCli(
  count: number,
  prefix?: string | null
) {
  const safeCount = Math.max(1, Math.min(500, count));
  const safePrefix = sanitizeCodePrefix(prefix);
  const codes = new Set<string>();

  while (codes.size < safeCount) {
    codes.add(createRandomSessionCode(safePrefix));
  }

  return [...codes];
}
