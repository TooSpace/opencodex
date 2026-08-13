import { publicEvidenceId } from "./ids";
import type {
  PublicAdapterFamily,
  PublicRouteRegistryEntryV1,
  PublicRouteRegistryManifestV1,
} from "./types";

// Authority snapshot: the last fully green exact PR head reviewed before this
// manifest narrowing. Its tree contains both the provider authority and registry.
const PUBLIC_ROUTE_REGISTRY_SOURCE_COMMIT = "1994d9ae0c018762dbf2a694fca068db380c55d0";

const entries: PublicRouteRegistryEntryV1[] = [
  {
    providerId: "openai",
    modelId: "gpt-5.6-sol",
    adapterFamilies: ["openai-responses"],
  },
];

const manifestWithoutDigest = {
  schemaVersion: "public_route_registry_v1" as const,
  registryVersion: "2026-08-13.v2",
  sourceCommit: PUBLIC_ROUTE_REGISTRY_SOURCE_COMMIT,
  entries,
};

export const PUBLIC_ROUTE_REGISTRY_V1: PublicRouteRegistryManifestV1 = Object.freeze({
  ...manifestWithoutDigest,
  entries: Object.freeze(entries.map((entry) => Object.freeze({
    ...entry,
    adapterFamilies: Object.freeze([...entry.adapterFamilies]) as unknown as PublicAdapterFamily[],
  }))) as unknown as PublicRouteRegistryEntryV1[],
  manifestDigest: publicEvidenceId("route_registry", manifestWithoutDigest),
});

export function findPublicRouteRegistryEntry(
  providerId: string,
  modelId: string,
): PublicRouteRegistryEntryV1 | undefined {
  return PUBLIC_ROUTE_REGISTRY_V1.entries.find(
    (entry) => entry.providerId === providerId && entry.modelId === modelId,
  );
}
