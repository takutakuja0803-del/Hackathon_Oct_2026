export const AUTHORSHIP_PROVENANCE = {
  creator: "Takumi Naito",
  organization: "TAKUMI Lab",
  projectFamily: "Visualized Systems",
  marker: "TAKUMI-LAB::VISUALIZED-SYSTEMS::TAKUMI-NAITO::2026",
  fingerprintSha256: "f6e8ac998f78cde7dee9f73712272286fdbb3a4124a59bd838259770afbf7e82",
  year: 2026,
} as const;

export type AuthorshipProvenance = typeof AUTHORSHIP_PROVENANCE;
