import { ExecutionTrace } from '@visualized-gdb/execution-trace';

export const fixtureD_referenceBinding: ExecutionTrace = {
  schemaVersion: '0.2',
  traceId: 'fixture-d-reference-binding',
  source: {
    language: 'cpp',
    standard: 'c++20',
    text: `int main() {
    int x = 5;
    int& r = x;
    r = 20;
    return 0;
}`,
  },
  producer: {
    kind: 'fixture',
    name: 'canonical-fixture-d',
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
        description: 'After reference binding int& r = x',
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
              id: 'var-main-r',
              name: { value: 'r', provenance: 'fixture-authored' },
              type: { value: 'int&', provenance: 'fixture-authored' },
              role: 'local',
              storageId: 'storage-main-x',
              value: {
                kind: 'reference',
                display: 'aliases x',
                target: {
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
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: ['Reference r bound as an alias to storage-main-x.'],
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
        description: 'After mutation through reference r = 20',
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
                display: '20',
                encoding: 'decimal',
                availability: { status: 'available' },
                provenance: 'fixture-authored',
              },
            },
            {
              id: 'var-main-r',
              name: { value: 'r', provenance: 'fixture-authored' },
              type: { value: 'int&', provenance: 'fixture-authored' },
              role: 'local',
              storageId: 'storage-main-x',
              value: {
                kind: 'reference',
                display: 'aliases x',
                target: {
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
            display: '20',
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
        notes: ['Mutating r modified underlying storage-main-x to 20.'],
      },
    },
  ],
  diagnostics: [],
};
