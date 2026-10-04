// Thin-line isometric illustration ("Hairline"): a cube Bot on a plinth.
export const Hairline = ({ size = 160 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 160 160" fill="none" stroke="var(--t2)" strokeWidth="0.75" strokeLinejoin="round" aria-hidden>
    <path d="M80 118 128 92 80 66 32 92Z" /><path d="M32 92v6l48 26 48-26v-6" /><path d="M80 118v6" />
    <path d="M80 34 112 51v36L80 104 48 87V51Z" /><path d="M48 51l32 17 32-17M80 68v36" />
    <path d="M60 70v8M68 74v8" strokeWidth="1.5" strokeLinecap="round" stroke="var(--t1)" />
    <path d="M80 34V22" /><circle cx="80" cy="19" r="3" />
    {[0, 1, 2, 3].map((i) => <path key={i} d={`M${44 + i * 12} ${100 + i * 6}l${48} -26`} strokeDasharray="1 3" opacity=".6" />)}
  </svg>
);
