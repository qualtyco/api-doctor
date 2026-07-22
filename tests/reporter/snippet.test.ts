import { describe, expect, it } from 'vitest';
import { extractCodeSnippet } from '../../src/reporter/snippet.js';

const SOURCE = ['line one', 'line two', 'line three', 'line four', 'line five'].join('\n');

describe('extractCodeSnippet', () => {
  it('centers a 5-line window on the issue line', () => {
    const snippet = extractCodeSnippet(SOURCE, 3);
    expect(snippet.highlightedLine).toBe(3);
    expect(snippet.lines.map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
    expect(snippet.lines[2].text).toBe('line three');
  });

  it('clamps at the start of the file', () => {
    const snippet = extractCodeSnippet(SOURCE, 1);
    expect(snippet.highlightedLine).toBe(1);
    expect(snippet.lines.map((l) => l.number)).toEqual([1, 2, 3]);
  });

  it('clamps at the end of the file', () => {
    const snippet = extractCodeSnippet(SOURCE, 5);
    expect(snippet.highlightedLine).toBe(5);
    expect(snippet.lines.map((l) => l.number)).toEqual([3, 4, 5]);
  });

  it('preserves original indentation', () => {
    const indented = ['function f() {', '    const x = 1;', '    return x;', '}'].join('\n');
    const snippet = extractCodeSnippet(indented, 2);
    expect(snippet.lines[1].text).toBe('    const x = 1;');
  });

  it('handles a file shorter than the window', () => {
    const snippet = extractCodeSnippet('only line', 1);
    expect(snippet.lines).toEqual([{ number: 1, text: 'only line' }]);
    expect(snippet.highlightedLine).toBe(1);
  });

  it('clamps out-of-range line numbers into the file', () => {
    const snippet = extractCodeSnippet(SOURCE, 99);
    expect(snippet.highlightedLine).toBe(5);
  });
});
