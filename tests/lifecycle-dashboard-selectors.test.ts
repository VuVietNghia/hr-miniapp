import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterLifecycleProfiles,
  getAvailableCandidates,
  mergeIncompleteProfiles,
} from '../src/ui/lifecycle/lifecycle-dashboard-selectors';
import type { EmployeeProfile, PassedCandidate } from '../src/ui/lifecycle/types';

const profiles: EmployeeProfile[] = [
  { _id: 'employee-1', name: 'An Nguyen', status: 'Official', department: 'Engineering', email: 'an@example.com' },
  { _id: 'employee-2', name: 'Binh Tran', status: 'Probation', department: 'Finance', phone: '0900000000' },
];

test('merges an incomplete employee snapshot without dropping previously loaded records', () => {
  const result = mergeIncompleteProfiles(profiles, [
    { ...profiles[0], status: 'Active' },
  ]);

  assert.deepEqual(result.map((profile) => profile._id), ['employee-1', 'employee-2']);
  assert.equal(result[0].status, 'Active');
});

test('filters profiles by department, status and search term', () => {
  const result = filterLifecycleProfiles(profiles, {
    department: 'Engineering',
    status: 'Official',
    searchTerm: 'an@example.com',
    viewMode: 'list',
  });

  assert.deepEqual(result.map((profile) => profile._id), ['employee-1']);
});

test('excludes candidates already onboarded by source id or legacy name match', () => {
  const candidates: PassedCandidate[] = [
    { _id: 'candidate-1', name: 'An Nguyen', listName: 'Batch', listId: 'list-1' },
    { _id: 'candidate-2', name: 'Binh Tran', listName: 'Batch', listId: 'list-1' },
    { _id: 'candidate-3', name: 'Chi Le', listName: 'Batch', listId: 'list-1' },
  ];
  const onboardedProfiles = [
    { ...profiles[0], sourceCandidateId: 'candidate-1' },
    profiles[1],
  ];

  assert.deepEqual(
    getAvailableCandidates(candidates, onboardedProfiles).map((candidate) => candidate._id),
    ['candidate-3'],
  );
});
