/**
 * The DOM comes from vitest's `environment: 'jsdom'` (see vitest.config.ts), so
 * no explicit registration import is needed. Do not register another DOM
 * implementation from inside a test file: it would install itself *over* the
 * active jsdom document and break the two environments against each other.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';

describe('DOM environment smoke test', () => {
  it('renders a React component into jsdom', () => {
    render(React.createElement('button', null, 'Click me'));

    expect(screen.getByText('Click me')).toBeDefined();
  });
});
