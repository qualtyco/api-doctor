import { describe, expect, it } from 'vitest';
import { getUnsupportedPackages } from '../src/unsupported-packages.js';

describe('getUnsupportedPackages', () => {
  it('excludes supported provider packages', () => {
    expect(getUnsupportedPackages(['resend', 'stripe'])).toEqual(['stripe']);
  });

  it('excludes common noise packages', () => {
    expect(getUnsupportedPackages(['react', 'stripe'])).toEqual(['stripe']);
    expect(getUnsupportedPackages(['vite', 'eslint', 'stripe'])).toEqual(['stripe']);
  });

  it('excludes @types/* packages', () => {
    expect(getUnsupportedPackages(['@types/node', 'stripe'])).toEqual(['stripe']);
    expect(getUnsupportedPackages(['@types/react', 'stripe'])).toEqual(['stripe']);
  });

  it('excludes @radix-ui/* packages', () => {
    expect(getUnsupportedPackages(['@radix-ui/react-dialog', 'stripe'])).toEqual(['stripe']);
  });

  it('returns empty when only supported or excluded packages are present', () => {
    expect(getUnsupportedPackages(['resend', 'react', '@eslint/js'])).toEqual([]);
  });
});
