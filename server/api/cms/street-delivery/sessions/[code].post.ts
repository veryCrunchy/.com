import { createError, getHeader, readBody, readMultipartFormData } from "h3";

import {
  submitStreetDeliveryInquiry,
  type StreetDeliverySubmissionInput,
} from "~/server/utils/street-delivery";

function parseBooleanValue(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function getTextPart(
  parts: Awaited<ReturnType<typeof readMultipartFormData>>,
  fieldName: string
) {
  const part = parts?.find((entry) => entry.name === fieldName);

  if (!part || part.filename) {
    return "";
  }

  return new TextDecoder().decode(part.data).trim();
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing session code.",
    });
  }

  const contentType = getHeader(event, "content-type") || "";
  let input: StreetDeliverySubmissionInput;

  if (contentType.includes("multipart/form-data")) {
    const parts = await readMultipartFormData(event);

    if (!parts) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing form payload.",
      });
    }

    const selfie = parts.find((entry) => entry.name === "selfie" && entry.filename && entry.data?.length);

    input = {
      contactMethod: getTextPart(parts, "contactMethod") as StreetDeliverySubmissionInput["contactMethod"],
      contactValue: getTextPart(parts, "contactValue"),
      firstName: getTextPart(parts, "firstName") || null,
      description: getTextPart(parts, "description") || null,
      consentSend: parseBooleanValue(getTextPart(parts, "consentSend")),
      consentPublish: parseBooleanValue(getTextPart(parts, "consentPublish")),
      selfie: selfie
        ? {
            filename: selfie.filename,
            type: selfie.type,
            data: selfie.data,
          }
        : null,
    };
  } else {
    const body = await readBody<{
      contactMethod?: string;
      contactValue?: string;
      firstName?: string | null;
      description?: string | null;
      consentSend?: boolean;
      consentPublish?: boolean;
    }>(event);

    input = {
      contactMethod: String(body?.contactMethod || "") as StreetDeliverySubmissionInput["contactMethod"],
      contactValue: String(body?.contactValue || ""),
      firstName: body?.firstName || null,
      description: body?.description || null,
      consentSend: Boolean(body?.consentSend),
      consentPublish: Boolean(body?.consentPublish),
      selfie: null,
    };
  }

  const result = await submitStreetDeliveryInquiry(event, code, input);

  return result;
});
