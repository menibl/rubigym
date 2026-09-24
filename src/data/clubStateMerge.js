const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const valuesEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/**
 * Rebase an entity collection after an optimistic-lock conflict.
 *
 * Fields changed locally since the last synchronized snapshot are retained.
 * Fields that were not changed locally take their newest server value. This
 * prevents an old manager/browser snapshot from erasing profile photos and
 * demographic data that a trainee updated on another device.
 */
export const mergeEntityCollectionById = (baseValue, localValue, remoteValue) => {
  const base = Array.isArray(baseValue) ? baseValue : [];
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(remoteValue) ? remoteValue : [];
  const baseById = new Map(base.map(item => [String(item?.id || ''), item]));
  const remoteById = new Map(remote.map(item => [String(item?.id || ''), item]));

  const merged = local.flatMap(localItem => {
    const id = String(localItem?.id || '');
    if (!id) return [localItem];

    const baseItem = baseById.get(id);
    const remoteItem = remoteById.get(id);
    remoteById.delete(id);

    if (!baseItem) return [localItem];
    if (!remoteItem) return valuesEqual(localItem, baseItem) ? [] : [localItem];

    const result = {};
    const keys = new Set([
      ...Object.keys(baseItem),
      ...Object.keys(localItem),
      ...Object.keys(remoteItem)
    ]);

    for (const key of keys) {
      const changedLocally = !hasOwn(baseItem, key)
        ? hasOwn(localItem, key)
        : !hasOwn(localItem, key) || !valuesEqual(localItem[key], baseItem[key]);

      if (changedLocally) {
        if (hasOwn(localItem, key)) result[key] = localItem[key];
      } else if (hasOwn(remoteItem, key)) {
        result[key] = remoteItem[key];
      }
    }

    return [result];
  });

  // Remote-only entities (for example a newly registered trainee) must not be
  // lost when an already-open browser retries its own save.
  return [
    ...merged,
    ...[...remoteById.entries()]
      .filter(([id]) => !id || !baseById.has(id))
      .map(([, item]) => item)
  ];
};
