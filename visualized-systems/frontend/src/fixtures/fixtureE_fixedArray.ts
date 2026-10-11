import { ExecutionTrace } from '@visualized-gdb/execution-trace';

export const fixtureE_fixedArray: ExecutionTrace = {
  schemaVersion: '0.2',
  traceId: 'fixture-e-fixed-array',
  source: {
    language: 'cpp',
    standard: 'c++20',
    text: `int main() {
    int arr[3] = {1, 2, 3};
    arr[1] = 9;
    return 0;
}`,
  },
  producer: {
    kind: 'fixture',
    name: 'canonical-fixture-e',
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
        description: 'Array initialized on stack',
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
              id: 'var-main-arr',
              name: { value: 'arr', provenance: 'fixture-authored' },
              type: { value: 'int[3]', provenance: 'fixture-authored' },
              role: 'local',
              value: {
                kind: 'array',
                extent: { value: 3, provenance: 'fixture-authored' },
                elements: [
                  {
                    id: 'var-main-arr-0',
                    name: { value: '[0]', provenance: 'fixture-authored' },
                    type: { value: 'int', provenance: 'fixture-authored' },
                    role: 'element',
                    storageId: 'storage-main-arr-0',
                    address: { value: '0x2000', provenance: 'fixture-authored' },
                    value: {
                      kind: 'scalar',
                      display: '1',
                      availability: { status: 'available' },
                      provenance: 'fixture-authored',
                    },
                  },
                  {
                    id: 'var-main-arr-1',
                    name: { value: '[1]', provenance: 'fixture-authored' },
                    type: { value: 'int', provenance: 'fixture-authored' },
                    role: 'element',
                    storageId: 'storage-main-arr-1',
                    address: { value: '0x2004', provenance: 'fixture-authored' },
                    value: {
                      kind: 'scalar',
                      display: '2',
                      availability: { status: 'available' },
                      provenance: 'fixture-authored',
                    },
                  },
                  {
                    id: 'var-main-arr-2',
                    name: { value: '[2]', provenance: 'fixture-authored' },
                    type: { value: 'int', provenance: 'fixture-authored' },
                    role: 'element',
                    storageId: 'storage-main-arr-2',
                    address: { value: '0x2008', provenance: 'fixture-authored' },
                    value: {
                      kind: 'scalar',
                      display: '3',
                      availability: { status: 'available' },
                      provenance: 'fixture-authored',
                    },
                  },
                ],
                availability: { status: 'available' },
                provenance: 'fixture-authored',
              },
            },
          ],
        },
      ],
      storage: [
        {
          id: 'storage-main-arr-0',
          kind: 'stack',
          address: { value: '0x2000', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '1',
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
        {
          id: 'storage-main-arr-1',
          kind: 'stack',
          address: { value: '0x2004', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '2',
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
        {
          id: 'storage-main-arr-2',
          kind: 'stack',
          address: { value: '0x2008', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '3',
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: ['Contiguous stack memory allocated for arr[3].'],
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
        description: 'arr[1] = 9 index mutation',
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
              id: 'var-main-arr',
              name: { value: 'arr', provenance: 'fixture-authored' },
              type: { value: 'int[3]', provenance: 'fixture-authored' },
              role: 'local',
              value: {
                kind: 'array',
                extent: { value: 3, provenance: 'fixture-authored' },
                elements: [
                  {
                    id: 'var-main-arr-0',
                    name: { value: '[0]', provenance: 'fixture-authored' },
                    type: { value: 'int', provenance: 'fixture-authored' },
                    role: 'element',
                    storageId: 'storage-main-arr-0',
                    address: { value: '0x2000', provenance: 'fixture-authored' },
                    value: {
                      kind: 'scalar',
                      display: '1',
                      availability: { status: 'available' },
                      provenance: 'fixture-authored',
                    },
                  },
                  {
                    id: 'var-main-arr-1',
                    name: { value: '[1]', provenance: 'fixture-authored' },
                    type: { value: 'int', provenance: 'fixture-authored' },
                    role: 'element',
                    storageId: 'storage-main-arr-1',
                    address: { value: '0x2004', provenance: 'fixture-authored' },
                    value: {
                      kind: 'scalar',
                      display: '9',
                      availability: { status: 'available' },
                      provenance: 'fixture-authored',
                    },
                  },
                  {
                    id: 'var-main-arr-2',
                    name: { value: '[2]', provenance: 'fixture-authored' },
                    type: { value: 'int', provenance: 'fixture-authored' },
                    role: 'element',
                    storageId: 'storage-main-arr-2',
                    address: { value: '0x2008', provenance: 'fixture-authored' },
                    value: {
                      kind: 'scalar',
                      display: '3',
                      availability: { status: 'available' },
                      provenance: 'fixture-authored',
                    },
                  },
                ],
                availability: { status: 'available' },
                provenance: 'fixture-authored',
              },
            },
          ],
        },
      ],
      storage: [
        {
          id: 'storage-main-arr-0',
          kind: 'stack',
          address: { value: '0x2000', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '1',
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
        {
          id: 'storage-main-arr-1',
          kind: 'stack',
          address: { value: '0x2004', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '9',
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
        {
          id: 'storage-main-arr-2',
          kind: 'stack',
          address: { value: '0x2008', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '3',
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: ['arr[1] mutated from 2 to 9.'],
      },
    },
  ],
  diagnostics: [],
};
