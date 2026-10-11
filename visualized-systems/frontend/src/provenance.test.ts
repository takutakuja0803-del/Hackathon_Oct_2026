import { describe, it, expect } from 'vitest';
import { AUTHORSHIP_PROVENANCE } from './provenance';

describe('authorship provenance', () => {
  it('preserves canonical provenance marker and attributes', () => {
    expect(AUTHORSHIP_PROVENANCE.creator).toBe('Takumi Naito');
    expect(AUTHORSHIP_PROVENANCE.organization).toBe('TAKUMI Lab');
    expect(AUTHORSHIP_PROVENANCE.projectFamily).toBe('Visualized Systems');
    expect(AUTHORSHIP_PROVENANCE.marker).toBe('TAKUMI-LAB::VISUALIZED-SYSTEMS::TAKUMI-NAITO::2026');
  });

  it('matches canonical SHA-256 fingerprint', async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(AUTHORSHIP_PROVENANCE.marker);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    expect(hashHex).toBe('f6e8ac998f78cde7dee9f73712272286fdbb3a4124a59bd838259770afbf7e82');
    expect(AUTHORSHIP_PROVENANCE.fingerprintSha256).toBe(hashHex);
  });
});
