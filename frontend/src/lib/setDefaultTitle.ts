// Sets the browser tab title for routes that don't render their own
// <AppMeta>/<title> (see App.tsx's AppRoutes and admin/AdminLayout.tsx).
// Plain `document.title = x` was observed to sometimes leave TWO <title>
// elements in the document (one still reading the old/blank value, which is
// the one `document.title`'s getter returns per spec — first element wins)
// rather than updating the single existing one, in this app's specific
// combination of React 19's native head management and CRA's dev server.
// Root cause not fully chased down (cosmetic, not a functional/security
// issue — see GECE-LOG.md) — worked around by being explicit: find every
// <title> in <head>, reuse the first as the canonical one, remove any
// others, and set ITS textContent directly rather than trusting the
// `document.title` setter to resolve the ambiguity itself.
export function setDefaultTitle(title: string): void {
  const titles = Array.from(document.head.querySelectorAll('title'));
  if (titles.length === 0) {
    const el = document.createElement('title');
    el.textContent = title;
    document.head.appendChild(el);
    return;
  }
  titles[0].textContent = title;
  for (let i = 1; i < titles.length; i++) titles[i].remove();
}
