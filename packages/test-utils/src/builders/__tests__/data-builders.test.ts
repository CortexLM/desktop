import { describe, expect, it } from 'vitest';

import { AIMessageBuilder, FileBuilder, UserBuilder } from '../data-builders';

describe('patched test-data dependency compatibility', () => {
  it('builds users, messages and files without evaluating template strings', () => {
    const user = new UserBuilder().withAdmin().build();
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.email).toContain('@');
    expect(user.role).toBe('admin');

    const content = '{{constructor.constructor("return process")()}}';
    expect(new AIMessageBuilder().withContent(content).build().content).toBe(content);
    const file = new FileBuilder().build();
    expect(file.path.length).toBeGreaterThan(0);
    expect(file.content.length).toBeGreaterThan(0);
  });
});
