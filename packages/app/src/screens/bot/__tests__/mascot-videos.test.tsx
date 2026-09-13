import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import type { Mascot } from '../../../state/bot-map.ts';
import { BotVideosScreen } from '../mascot-detail-screens.tsx';

const mascot: Mascot = {
  id: 'mst_1',
  name: 'Scout',
  look: 'amber',
  face: 'wink',
  unread: false,
  createdAt: 1,
  computer: { id: 'pc_1', mascotId: 'mst_1', status: 'hibernated' },
  messages: [],
  videos: [],
};

describe('BotVideosScreen', () => {
  it('does not name a competitor in the Videos subtitle', () => {
    render(() => (
      <BotVideosScreen mascot={mascot} onBack={vi.fn()} onGo={vi.fn()} />
    ));

    expect(screen.getByRole('heading', { name: 'Videos' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Claude|Opus|Grok|Cursor/i);
    expect(screen.getByText(/Pointer and click-zoom recordings/)).toBeInTheDocument();
  });
});
