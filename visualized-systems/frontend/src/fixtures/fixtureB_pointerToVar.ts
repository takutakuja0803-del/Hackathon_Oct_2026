import { ExecutionTrace } from '@visualized-gdb/execution-trace';

export const fixtureB_pointerToVar: ExecutionTrace = {
  schemaVersion: '0.2',
  traceId: 'fixture-b-pointer-to-var',
  source: {
    language: 'cpp',
    standard: 'c++20',
    text: `int main() {
    int x = 5;
    int* p = &x;
    return 0;
}`,
  },
  producer: {
    kind: 'fixture',
    name: 'canonical-fixture-b',
    version: '1',
  },
  outcome: 'completed',
  steps: [
    {
      index: 0,
      location: {
        status: 'known',
        line: { value: 2, provenance: 'fixture-authored' },
      },
      stop: {
        reason: 'breakpoint',
        description: 'After x initialization',
      },
      frames: [
        {
          id: 'frame-main-0',
          functionName: { value: 'main', provenance: 'fixture-authored' },
          location: {
            status: 'known',
            line: { value: 2, provenance: 'fixture-authored' },
          },
          variables: [
            {
              id: 'var-main-x',
              name: { value: 'x', provenance: 'fixture-authored' },
              type: { value: 'int', provenance: 'fixture-authored' },
              role: 'local',
              storageId: 'storage-main-x',
              address: { value: '0x1000', provenance: 'fixture-authored' },
              value: {
                kind: 'scalar',
                display: '5',
                encoding: 'decimal',
                availability: { status: 'available' },
                provenance: 'fixture-authored',
              },
            },
          ],
        },
      ],
      storage: [
        {
          id: 'storage-main-x',
          kind: 'stack',
          address: { value: '0x1000', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '5',
            encoding: 'decimal',
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: ['x allocated on stack with value 5.'],
      },
    },
    {
      index: 1,
      location: {
        status: 'known',
        line: { value: 3, provenance: 'fixture-authored' },
      },
      stop: {
        reason: 'step',
        description: 'After pointer initialization p = &x',
      },
      frames: [
        {
          id: 'frame-main-0',
          functionName: { value: 'main', provenance: 'fixture-authored' },
          location: {
            status: 'known',
            line: { value: 3, provenance: 'fixture-authored' },
          },
          variables: [
            {
              id: 'var-main-x',
              name: { value: 'x', provenance: 'fixture-authored' },
              type: { value: 'int', provenance: 'fixture-authored' },
              role: 'local',
              storageId: 'storage-main-x',
              address: { value: '0x1000', provenance: 'fixture-authored' },
              value: {
                kind: 'scalar',
                display: '5',
                encoding: 'decimal',
                availability: { status: 'available' },
                provenance: 'fixture-authored',
              },
            },
            {
              id: 'var-main-p',
              name: { value: 'p', provenance: 'fixture-authored' },
              type: { value: 'int*', provenance: 'fixture-authored' },
              role: 'local',
              storageId: 'storage-main-p',
              address: { value: '0x1008', provenance: 'fixture-authored' },
              value: {
                kind: 'pointer',
                display: '0x1000',
                addressValue: { value: '0x1000', provenance: 'fixture-authored' },
                resolution: {
                  status: 'resolved',
                  targetStorageId: 'storage-main-x',
                  offsetBytes: 0,
                  provenance: 'fixture-authored',
                },
                availability: { status: 'available' },
                provenance: 'fixture-authored',
              },
            },
          ],
        },
      ],
      storage: [
        {
          id: 'storage-main-x',
          kind: 'stack',
          address: { value: '0x1000', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '5',
            encoding: 'decimal',
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
        {
          id: 'storage-main-p',
          kind: 'stack',
          address: { value: '0x1008', provenance: 'fixture-authored' },
          sizeBytes: { value: 8, provenance: 'fixture-authored' },
          type: { value: 'int*', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'pointer',
            display: '0x1000',
            addressValue: { value: '0x1000', provenance: 'fixture-authored' },
            resolution: {
              status: 'resolved',
              targetStorageId: 'storage-main-x',
              offsetBytes: 0,
              provenance: 'fixture-authored',
            },
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: ['p stores 0x1000 and resolves to storage-main-x.'],
      },
    },
  ],
  diagnostics: [],
};
