import { ExecutionTrace } from '@visualized-gdb/execution-trace';
import { fixtureA_basicMutation } from './fixtureA_basicMutation';
import { fixtureB_pointerToVar } from './fixtureB_pointerToVar';
import { fixtureC_derefMutation } from './fixtureC_derefMutation';
import { fixtureD_referenceBinding } from './fixtureD_referenceBinding';
import { fixtureE_fixedArray } from './fixtureE_fixedArray';
import { fixtureF_functionCall } from './fixtureF_functionCall';
import { fixtureG_pointerSwap } from './fixtureG_pointerSwap';
import { fixtureH_newDelete } from './fixtureH_newDelete';

export interface FixtureDescriptor {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string;
  trace: ExecutionTrace;
}

export const GOLDEN_FIXTURES: FixtureDescriptor[] = [
  {
    id: 'fixture-a',
    key: 'A',
    name: 'Basic Variable Mutation',
    category: 'Fundamentals',
    description: 'Stack scalar allocation (int x = 5) and value reassignment (x = 10).',
    trace: fixtureA_basicMutation,
  },
  {
    id: 'fixture-b',
    key: 'B',
    name: 'Pointer to Variable',
    category: 'Pointers',
    description: 'Address-of operator (&x) binding an int* pointer to a stack variable.',
    trace: fixtureB_pointerToVar,
  },
  {
    id: 'fixture-c',
    key: 'C',
    name: 'Pointer Dereference Mutation',
    category: 'Pointers',
    description: 'Indirect memory mutation through pointer dereference (*p = 10).',
    trace: fixtureC_derefMutation,
  },
  {
    id: 'fixture-d',
    key: 'D',
    name: 'Reference Binding & Aliasing',
    category: 'References',
    description: 'C++ reference alias (int& r = x) sharing storage with the target variable.',
    trace: fixtureD_referenceBinding,
  },
  {
    id: 'fixture-e',
    key: 'E',
    name: 'Fixed Array and Indexing',
    category: 'Memory Layout',
    description: 'Stack-allocated contiguous array int arr[3] with element update arr[1] = 9.',
    trace: fixtureE_fixedArray,
  },
  {
    id: 'fixture-f',
    key: 'F',
    name: 'Function Call (Stack Push / Pop)',
    category: 'Call Stack',
    description: 'Activation record creation, argument passing, and stack frame unwinding.',
    trace: fixtureF_functionCall,
  },
  {
    id: 'fixture-g',
    key: 'G',
    name: 'Pointer-Based Swap',
    category: 'Pointers & Stack',
    description: 'Inter-frame memory manipulation in swap(int* a, int* b).',
    trace: fixtureG_pointerSwap,
  },
  {
    id: 'fixture-h',
    key: 'H',
    name: 'Heap Allocation & Lifetime (new / delete)',
    category: 'Dynamic Memory',
    description: 'Heap allocation with new, dangling pointer detection on delete, and nullptr clearing.',
    trace: fixtureH_newDelete,
  },
];

export const FIXTURES_MAP: Record<string, ExecutionTrace> = {
  'fixture-a': fixtureA_basicMutation,
  'fixture-b': fixtureB_pointerToVar,
  'fixture-c': fixtureC_derefMutation,
  'fixture-d': fixtureD_referenceBinding,
  'fixture-e': fixtureE_fixedArray,
  'fixture-f': fixtureF_functionCall,
  'fixture-g': fixtureG_pointerSwap,
  'fixture-h': fixtureH_newDelete,
};

export {
  fixtureA_basicMutation,
  fixtureB_pointerToVar,
  fixtureC_derefMutation,
  fixtureD_referenceBinding,
  fixtureE_fixedArray,
  fixtureF_functionCall,
  fixtureG_pointerSwap,
  fixtureH_newDelete,
};
