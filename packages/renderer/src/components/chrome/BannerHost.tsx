import type { ReactNode } from 'react';

export type BannerPriority = 'blocking' | 'offline' | 'usage' | 'update';

const ORDER: BannerPriority[] = ['blocking', 'offline', 'usage', 'update'];

/**
 * One banner under the top bar. Higher-priority kinds win.
 * blocking error > offline > usage limit > update
 */
export function BannerHost({
  banners,
}: {
  banners: Partial<Record<BannerPriority, ReactNode>>;
}) {
  const kind = ORDER.find((key) => banners[key]);
  if (!kind) return null;
  return (
    <div className="flex-shrink-0" data-testid="chrome-banners" data-banner-kind={kind}>
      {banners[kind]}
    </div>
  );
}
