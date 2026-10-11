import { ExecutionTrace } from '@visualized-gdb/execution-trace';

export const fixtureH_newDelete: ExecutionTrace = {
  schemaVersion: '0.2',
  traceId: 'fixture-h-new-delete',
  source: {
    language: 'cpp',
    standard: 'c++20',
    text: `int main() {
    int* p = new int(42);
    delete p;
    p = nullptr;
    return 0;
}`,
  },
  producer: {
    kind: 'fixture',
    name: 'canonical-fixture-h',
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
        description: 'After new int(42) heap allocation',
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
              id: 'var-main-p',
              name: { value: 'p', provenance: 'fixture-authored' },
              type: { value: 'int*', provenance: 'fixture-authored' },
              role: 'local',
              storageId: 'storage-main-p',
              address: { value: '0x1000', provenance: 'fixture-authored' },
              value: {
                kind: 'pointer',
                display: '0x3000',
                addressValue: { value: '0x3000', provenance: 'fixture-authored' },
                resolution: {
                  status: 'resolved',
                  targetStorageId: 'storage-heap-0',
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
          id: 'storage-main-p',
          kind: 'stack',
          address: { value: '0x1000', provenance: 'fixture-authored' },
          sizeBytes: { value: 8, provenance: 'fixture-authored' },
          type: { value: 'int*', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'pointer',
            display: '0x3000',
            addressValue: { value: '0x3000', provenance: 'fixture-authored' },
            resolution: {
              status: 'resolved',
              targetStorageId: 'storage-heap-0',
              offsetBytes: 0,
              provenance: 'fixture-authored',
            },
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
        {
          id: 'storage-heap-0',
          kind: 'heap',
          address: { value: '0x3000', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'scalar',
            display: '42',
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
        notes: [
          'Heap block allocated with new int(42); p points to storage-heap-0 at 0x3000.',
        ],
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
        description: 'After delete p: heap block lifetime ended, p is dangling',
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
              id: 'var-main-p',
              name: { value: 'p', provenance: 'fixture-authored' },
              type: { value: 'int*', provenance: 'fixture-authored' },
              role: 'local',
              storageId: 'storage-main-p',
              address: { value: '0x1000', provenance: 'fixture-authored' },
              value: {
                kind: 'pointer',
                display: '0x3000',
                addressValue: { value: '0x3000', provenance: 'fixture-authored' },
                resolution: {
                  status: 'expired-by-observed-lifetime',
                  targetStorageId: 'storage-heap-0',
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
          id: 'storage-main-p',
          kind: 'stack',
          address: { value: '0x1000', provenance: 'fixture-authored' },
          sizeBytes: { value: 8, provenance: 'fixture-authored' },
          type: { value: 'int*', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'pointer',
            display: '0x3000',
            addressValue: { value: '0x3000', provenance: 'fixture-authored' },
            resolution: {
              status: 'expired-by-observed-lifetime',
              targetStorageId: 'storage-heap-0',
              provenance: 'fixture-authored',
            },
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
        {
          id: 'storage-heap-0',
          kind: 'heap',
          address: { value: '0x3000', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'ended', // Ended by delete p!
          provenance: 'fixture-authored',
          value: {
            kind: 'unavailable',
            availability: {
              status: 'unavailable',
              reason: 'Memory deallocated by delete p',
            },
            provenance: 'fixture-authored',
          },
        },
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: [
          'delete p deallocated storage-heap-0; pointer p target lifetime has ended (dangling pointer).',
        ],
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
        description: 'After p = nullptr: pointer zeroed, dangling pointer cleared',
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
              id: 'var-main-p',
              name: { value: 'p', provenance: 'fixture-authored' },
              type: { value: 'int*', provenance: 'fixture-authored' },
              role: 'local',
              storageId: 'storage-main-p',
              address: { value: '0x1000', provenance: 'fixture-authored' },
              value: {
                kind: 'pointer',
                display: '0x0',
                addressValue: { value: '0x0', provenance: 'fixture-authored' },
                resolution: {
                  status: 'null',
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
          id: 'storage-main-p',
          kind: 'stack',
          address: { value: '0x1000', provenance: 'fixture-authored' },
          sizeBytes: { value: 8, provenance: 'fixture-authored' },
          type: { value: 'int*', provenance: 'fixture-authored' },
          lifetime: 'live',
          provenance: 'fixture-authored',
          value: {
            kind: 'pointer',
            display: '0x0',
            addressValue: { value: '0x0', provenance: 'fixture-authored' },
            resolution: {
              status: 'null',
              provenance: 'fixture-authored',
            },
            availability: { status: 'available' },
            provenance: 'fixture-authored',
          },
        },
        {
          id: 'storage-heap-0',
          kind: 'heap',
          address: { value: '0x3000', provenance: 'fixture-authored' },
          sizeBytes: { value: 4, provenance: 'fixture-authored' },
          type: { value: 'int', provenance: 'fixture-authored' },
          lifetime: 'ended',
          provenance: 'fixture-authored',
          value: {
            kind: 'unavailable',
            availability: {
              status: 'unavailable',
              reason: 'Memory deallocated by delete p',
            },
            provenance: 'fixture-authored',
          },
        },
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: [
          'p assigned nullptr (0x0); null resolution evidenced by addressValue 0x0.',
        ],
      },
    },
  ],
  diagnostics: [],
};
