import { ExecutionTrace } from '@visualized-gdb/execution-trace';

export const fixtureA_basicMutation: ExecutionTrace = {
  schemaVersion: '0.2',
  traceId: 'fixture-a-basic-mutation',
  source: {
    language: 'cpp',
    standard: 'c++20',
    text: `int main() {
    int x = 5;
    x = 10;
    return 0;
}`,
  },
  producer: {
    kind: 'fixture',
    name: 'canonical-fixture-a',
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
        description: 'Before x assignment: uninitialized stack allocation',
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
                kind: 'unavailable',
                availability: {
                  status: 'unknown',
                  reason: 'Source declares no initializer yet; indeterminate runtime value',
                },
                provenance: 'unknown',
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
            kind: 'unavailable',
            availability: {
              status: 'unknown',
              reason: 'Uninitialized stack storage',
            },
            provenance: 'unknown',
          },
        },
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: ['x declared on stack frame with uninitialized indeterminate value.'],
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
        description: 'x initialized with 5',
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
        notes: ['x is initialized to 5 at 0x1000.'],
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
        description: 'x mutated to 10',
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
      ],
      stdout: '',
      stderr: '',
      observations: {
        completeness: 'partial',
        notes: ['x value changed from 5 to 10.'],
      },
    },
  ],
  diagnostics: [],
};
