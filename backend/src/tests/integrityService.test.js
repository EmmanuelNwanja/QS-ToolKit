const { canonicalize, hashDocument } = require('../services/integrityService');
const crypto = require('crypto');

describe('canonicalize', () => {
  test('produces consistent output regardless of key order', () => {
    const a = { z: 1, a: 2, m: { b: 3, a: 1 } };
    const b = { a: 2, m: { a: 1, b: 3 }, z: 1 };
    expect(canonicalize(a)).toEqual(canonicalize(b));
  });

  test('handles nested objects', () => {
    const obj = { level1: { level2: { level3: 'value' } } };
    const result = canonicalize(obj);
    expect(result.level1.level2.level3).toBe('value');
  });

  test('handles arrays', () => {
    const obj = { items: [3, 1, 2] };
    const result = canonicalize(obj);
    expect(result.items).toEqual([3, 1, 2]);
  });

  test('handles null and undefined', () => {
    const obj = { a: null, b: undefined, c: 'value' };
    const result = canonicalize(obj);
    expect(result.a).toBeNull();
    expect(result.b).toBeUndefined();
    expect(result.c).toBe('value');
  });
});

describe('hashDocument', () => {
  test('produces a valid SHA-256 hex string', () => {
    const hash = hashDocument('test data');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('is deterministic', () => {
    const h1 = hashDocument('hello world');
    const h2 = hashDocument('hello world');
    expect(h1).toBe(h2);
  });

  test('different inputs produce different hashes', () => {
    const h1 = hashDocument('input A');
    const h2 = hashDocument('input B');
    expect(h1).not.toBe(h2);
  });

  test('matches manual SHA-256', () => {
    const data = 'canonical test data';
    const expected = crypto.createHash('sha256').update(data).digest('hex');
    expect(hashDocument(data)).toBe(expected);
  });
});
