import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProfileImage } from '../src/utils/profileImage';

test('profile photos are resized without uploading originals and object URLs are released', async t => {
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: (type: string, quality: number) => `${type}:${quality}` };
  let revoked = '';
  t.mock.method(URL, 'createObjectURL', () => 'blob:photo');
  t.mock.method(URL, 'revokeObjectURL', value => { revoked = value; });
  const oldImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  class MockImage {
    naturalWidth = 4000;
    naturalHeight = 2000;
    onload = () => {};
    set src(_value: string) { this.onload(); }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  try {
    assert.equal(await prepareProfileImage(new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })), 'image/jpeg:0.82');
    assert.equal(canvas.width, 512);
    assert.equal(canvas.height, 256);
    assert.equal(revoked, 'blob:photo');
    revoked = '';
    await assert.rejects(prepareProfileImage(new File(['text'], 'text.txt', { type: 'text/plain' })));
    assert.equal(revoked, '');
    canvas.getContext = () => null;
    await assert.rejects(prepareProfileImage(new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })));
    assert.equal(revoked, 'blob:photo');
  } finally {
    if (oldImage) Object.defineProperty(globalThis, 'Image', oldImage); else Reflect.deleteProperty(globalThis, 'Image');
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});
