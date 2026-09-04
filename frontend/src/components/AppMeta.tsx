import React from 'react';

/**
 * Title + noindex for routes that are the product, not the marketing site:
 * login, password reset, payment callbacks and everything behind auth.
 *
 * React 19 hoists these into <head> natively. Deliberately no canonical and no
 * og:* — these pages are not meant to be indexed or shared, and a canonical on
 * a noindex page is a contradictory signal.
 *
 * Do NOT mount this alongside SEOMeta on the same route: both render <title>,
 * and two <title> elements mean document.title takes the first one.
 */
export default function AppMeta({ title }: { title: string }) {
  return (
    <>
      <title>{title}</title>
      <meta name="robots" content="noindex, nofollow" />
    </>
  );
}
