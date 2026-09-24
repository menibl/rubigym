import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEntityCollectionById } from '../src/data/clubStateMerge.js';

test('keeps remote profile fields that were not changed locally', () => {
  const base = [{ id: 'boaz', name: 'בועז', gender: 'ALL', age: 0, avatarUrl: '' }];
  const local = [{ id: 'boaz', name: 'בועז מלניק', gender: 'ALL', age: 0, avatarUrl: '' }];
  const remote = [{ id: 'boaz', name: 'בועז', gender: 'MALE', age: 42, avatarUrl: 'data:image/webp;base64,new' }];

  assert.deepEqual(mergeEntityCollectionById(base, local, remote), [{
    id: 'boaz',
    name: 'בועז מלניק',
    gender: 'MALE',
    age: 42,
    avatarUrl: 'data:image/webp;base64,new'
  }]);
});

test('preserves local and remote additions while preferring explicit local field edits', () => {
  const base = [{ id: 'existing', status: 'OLD', note: '' }];
  const local = [
    { id: 'existing', status: 'LOCAL', note: '' },
    { id: 'local-only', status: 'NEW' }
  ];
  const remote = [
    { id: 'existing', status: 'REMOTE', note: 'server update' },
    { id: 'remote-only', status: 'NEW' }
  ];

  assert.deepEqual(mergeEntityCollectionById(base, local, remote), [
    { id: 'existing', status: 'LOCAL', note: 'server update' },
    { id: 'local-only', status: 'NEW' },
    { id: 'remote-only', status: 'NEW' }
  ]);
});

test('retains intentional local deletions and accepts unchanged remote deletions', () => {
  const base = [
    { id: 'deleted-locally', value: 'old' },
    { id: 'deleted-remotely', value: 'old' }
  ];
  const local = [{ id: 'deleted-remotely', value: 'old' }];
  const remote = [{ id: 'deleted-locally', value: 'remote edit' }];

  assert.deepEqual(mergeEntityCollectionById(base, local, remote), []);
});
