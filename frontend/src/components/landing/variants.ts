export const ease = [0.16, 1, 0.3, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.5, ease } },
};

export const stagger = (delay = 0.1, children = 0.1) => ({
  hidden: {},
  show:   { transition: { staggerChildren: delay, delayChildren: children } },
});

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.5, ease } },
};

// Reusable section header styles — CareNova brand tokens (Bölüm 4 palette)
export const sectionHeading =
  'font-display text-4xl md:text-5xl font-normal text-ink leading-tight';

export const sectionSubheading =
  'text-ink-muted text-lg max-w-2xl leading-relaxed';
