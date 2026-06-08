import { prisma } from "@/platform/db";

/**
 * Centralised environment configuration. Throws early if a required secret is
 * missing so misconfiguration fails fast at startup rather than at request time.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtlSeconds: intEnv("ACCESS_TOKEN_TTL", 900),
    refreshTtlSeconds: intEnv("REFRESH_TOKEN_TTL", 2_592_000),
  },
  propertyId: process.env.PROPERTY_ID ?? "",
};

/**
 * Resolve the "current property" for the single-property MVP.
 *
 * Multi-property seam: when PROPERTY_ID is set we honour it; otherwise we fall back
 * to the single seeded property. A multi-property deployment would resolve this
 * per-request (e.g. from the authenticated staff's propertyId) instead.
 */
let cachedPropertyId: string | null = null;
export async function getCurrentPropertyId(): Promise<string> {
  if (config.propertyId) return config.propertyId;
  if (cachedPropertyId) return cachedPropertyId;

  const property = await prisma.property.findFirst({ orderBy: { createdAt: "asc" } });
  if (!property) {
    throw new Error("No Property found. Run the seed script (npm run seed).");
  }
  cachedPropertyId = property.id;
  return property.id;
}
