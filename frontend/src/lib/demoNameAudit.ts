// Finds fabricated names rendered WITHOUT their record-level marker.
//
// The banner cannot be forgotten (see demoProvenance.ts), but a name rendered
// as a bare `{c.patientName}` can — and the brief's point is exactly that a
// cropped screenshot of a table loses the banner and keeps the name. This walks
// the rendered DOM and reports every registered demo name that is not inside a
// <DemoName> (or, where markup is impossible such as <option>, not prefixed
// with the badge text).
//
// Element-based, not text-node-based, on purpose: JSX like
// `{rec.first_name} {rec.last_name}` renders THREE text nodes ("Jonas", " ",
// "Fischer"), so a per-text-node scan never sees "Jonas Fischer" and would pass
// an unmarked name silently. Matching against the innermost element whose
// combined text contains the whole name closes that gap.
//
// Runs automatically in development after every demo screen renders, and is
// what the "scan every screen again" verification step uses.
import { getRegisteredDemoNames } from './demoProvenance';

const BADGE_PREFIX = /(ÖRNEK|SAMPLE)\]?\s*$/;
const SKIP = 'script, style, [hidden], [aria-hidden="true"]';

export interface UnmarkedName {
  name: string;
  context: string;
}

/** The deepest element whose text contains `name`, i.e. no child also contains it. */
function innermostContainers(root: Element, name: string): Element[] {
  const hits: Element[] = [];
  const visit = (el: Element) => {
    if (!(el.textContent ?? '').includes(name)) return;
    const childHit = Array.from(el.children).filter(c => (c.textContent ?? '').includes(name));
    if (childHit.length === 0) {
      hits.push(el);
    } else {
      childHit.forEach(visit);
    }
  };
  visit(root);
  return hits;
}

export function findUnmarkedDemoNames(root: Element = document.body): UnmarkedName[] {
  const names = getRegisteredDemoNames();
  const found: UnmarkedName[] = [];
  const seen = new Set<Element>();

  names.forEach(name => {
    innermostContainers(root, name).forEach(el => {
      if (el.closest(SKIP)) return;
      if (el.closest('[data-demo-name]')) return;

      const text = el.textContent ?? '';
      let from = 0;
      let idx = text.indexOf(name, from);
      let unmarked = false;
      while (idx !== -1) {
        if (!BADGE_PREFIX.test(text.slice(0, idx))) unmarked = true;
        from = idx + name.length;
        idx = text.indexOf(name, from);
      }
      // A longer name ("Dr. Ayla Çelik") already reported for this element
      // should not be reported again as the shorter one it contains.
      if (unmarked && !seen.has(el)) {
        seen.add(el);
        found.push({ name, context: text.trim().slice(0, 90) });
      }
    });
  });
  return found;
}
