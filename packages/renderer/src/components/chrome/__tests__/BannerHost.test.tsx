import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BannerHost } from '../BannerHost';

describe('BannerHost', () => {
  it('shows nothing when every slot is empty', () => {
    const { container } = render(<BannerHost banners={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('prefers blocking over offline, usage, and update', () => {
    render(
      <BannerHost
        banners={{
          blocking: <span>blocking</span>,
          offline: <span>offline</span>,
          usage: <span>usage</span>,
          update: <span>update</span>,
        }}
      />
    );
    expect(screen.getByTestId('chrome-banners')).toHaveAttribute('data-banner-kind', 'blocking');
    expect(screen.getByText('blocking')).toBeInTheDocument();
    expect(screen.queryByText('offline')).not.toBeInTheDocument();
  });

  it('falls through blocking error > offline > usage limit > update', () => {
    const { rerender } = render(
      <BannerHost
        banners={{
          offline: <span>offline</span>,
          usage: <span>usage</span>,
          update: <span>update</span>,
        }}
      />
    );
    expect(screen.getByTestId('chrome-banners')).toHaveAttribute('data-banner-kind', 'offline');

    rerender(
      <BannerHost
        banners={{
          usage: <span>usage</span>,
          update: <span>update</span>,
        }}
      />
    );
    expect(screen.getByTestId('chrome-banners')).toHaveAttribute('data-banner-kind', 'usage');

    rerender(<BannerHost banners={{ update: <span>update</span> }} />);
    expect(screen.getByTestId('chrome-banners')).toHaveAttribute('data-banner-kind', 'update');
  });
});
