import { describe, expect, it } from 'vitest';
import { redactSecretValues } from '../secrets';

describe('redactSecretValues', () => {
  it('replaces known provider tokens with their names', () => {
    const text = [
      'export ANTHROPIC_API_KEY=sk-ant-abcdefghijklmnop',
      'OPENAI=sk-abcdefghijklmnopqrstuvwxyz123456',
      'auth ghp_abcdefghijklmnopqrstuvwxyz1234567890',
    ].join('\n');

    const redacted = redactSecretValues(text);
    expect(redacted).toContain('ANTHROPIC_API_KEY');
    expect(redacted).toContain('OPENAI_API_KEY');
    expect(redacted).toContain('GITHUB_TOKEN');
    expect(redacted).not.toMatch(/sk-ant-abcdefghijklmnop/);
    expect(redacted).not.toMatch(/sk-abcdefghijklmnopqrstuvwxyz123456/);
    expect(redacted).not.toMatch(/ghp_abcdefghijklmnopqrstuvwxyz1234567890/);
  });

  it('keeps secret names in key=value pairs and drops the value', () => {
    const redacted = redactSecretValues('api_key=supersecretvalue');
    expect(redacted).toContain('api_key=');
    expect(redacted).toContain('<secret-name>');
    expect(redacted).not.toContain('supersecretvalue');
  });
});
