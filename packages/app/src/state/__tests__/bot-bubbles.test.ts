import { describe, expect, it } from 'vitest';

import { splitEmployeeBubbles } from '../bot-bubbles.ts';

describe('splitEmployeeBubbles', () => {
  it('splits on blank lines and drops empty parts', () => {
    expect(splitEmployeeBubbles('One.\n\nTwo.\n\n\nThree.')).toEqual(['One.', 'Two.', 'Three.']);
  });

  it('keeps a single paragraph as one bubble', () => {
    expect(splitEmployeeBubbles('  Ready.  ')).toEqual(['Ready.']);
  });

  it('returns nothing for whitespace', () => {
    expect(splitEmployeeBubbles('  \n\n  ')).toEqual([]);
  });
});
