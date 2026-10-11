import { ExecutionTrace } from '@visualized-gdb/execution-trace';

export const fixtureC_derefMutation: ExecutionTrace = {
  schemaVersion: '0.2',
  traceId: 'fixture-c-deref-mutation',
  source: {
    language: 'cpp',
    standard: 'c++20',
    text: `int main() {
    int x = 5;
    int* p = &x;
    *p = 10;
    return 0;
}`,
  },
  producer: {
    kind: 'fixture',
    name: 'canonical-fixture-c',
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
        description: 'x initialized with 5',
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
        notes: ['x declared on stack with value 5.'],
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
        description: 'p points to &x',
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
        notes: ['p initialized to point to storage-main-x.'],
      },
    },
    {
      index: 2,
      location: {
        status: 'known',
        line: { value: 4, provenance: 'fixture-authored' },
      },
      stop: {
        reason: 'step',
        description: '*p = 10 dereference mutation',
      },
      frames: [
        {
          id: 'frame-main-0',
          functionName: { value: 'main', provenance: 'fixture-authored' },
          location: {
            status: 'known',
            line: { value: 4, provenance: 'fixture-authored' },
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
                display: '10',
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
            display: '10',
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
        notes: ['*p = 10 dereferenced target x; value mutated to 10.'],
      },
    },
  ],
  diagnostics: [],
};
