// Demo-data provenance: marks every screen that SHOWS fabricated records, with
// no per-screen code.
//
// WHY THIS SHAPE (DEMO-VERI-ISARETLEME.md Görev 1). The obvious alternatives
// all fail the brief's criterion — "a new page that imports demo data must be
// impossible to leave unmarked":
//
//  • A banner placed by hand on each screen: forgotten on screen #23.
//  • "This file imports data/*": wrong in both directions. Those modules also
//    export legitimate constants (CASE_STATUS_LABELS, BRANCH_LABELS,
//    DEMO_NOW_MS) that a real-data screen can import freely; and
//    PatientsListPage imports only a type from caseData while its RECORDS
//    arrive through demoAdapter. Import is not use.
//  • Prefixing names inside the data ("[ÖRNEK] Jonas Fischer"): corrupts
//    derived data. commissionDemoData does `consultant.name.split(' ')` to
//    build first/last names and e-mails, and joins cases to consultants BY
//    NAME — a prefix turns the first name into "[ÖRNEK]".
//  • The REACT_APP_DEMO_MODE flag: the direct imports never pass through it.
//
// What is left is to mark the data at the one place it is created. Each
// fabricated collection is exported through demoSource(), a Proxy that reports
// "this path read fabricated records" whenever anything reads it — a page
// rendering it, or demoAdapter building a response from it. The app and admin
// shells show the banner whenever the current path has reported. A new screen
// that renders `cases` is marked the moment it reads the array; it cannot
// opt out, because there is no unbranded copy to import.

type Listener = () => void;

const readsByPath = new Map<string, Set<string>>();
const listeners = new Set<Listener>();
let tracking = false;
let notifyQueued = false;

/**
 * Turns tracking on. Called in index.tsx immediately before the first render,
 * so that reads performed while modules are merely LOADING — e.g.
 * commissionDemoData deriving its deals from `cases` at import time, which
 * happens on every page because demoAdapter imports it — are not attributed to
 * whatever page happened to be opened first.
 */
export function enableDemoTracking(): void {
  tracking = true;
}

function report(source: string): void {
  if (!tracking) return;
  const path = window.location.pathname;
  let sources = readsByPath.get(path);
  if (!sources) {
    sources = new Set();
    readsByPath.set(path, sources);
  }
  // Idempotent: a path is marked once per source. Without this every array
  // index read inside a .map() would re-notify, and re-render the banner.
  if (sources.has(source)) return;
  sources.add(source);

  // Reads happen DURING a page's render. Notifying synchronously there would
  // update the shell's banner while a different component is rendering, which
  // React rejects. A microtask runs right after the commit, before paint.
  if (!notifyQueued) {
    notifyQueued = true;
    queueMicrotask(() => {
      notifyQueued = false;
      listeners.forEach(listener => listener());
    });
  }
}

/**
 * Wrap a fabricated collection at its export. Reading it — indexing, .map,
 * .length, spreading — marks the current path as showing demo data.
 * Type-transparent: a Proxy of an array is still an array (Array.isArray,
 * iteration, JSON.stringify all behave normally).
 */
export function demoSource<T extends object>(source: string, data: T): T {
  return new Proxy(data, {
    get(target, prop, receiver) {
      report(source);
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function subscribeDemoProvenance(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Number of distinct fabricated sources the given path has read. */
export function demoSourceCount(path: string): number {
  return readsByPath.get(path)?.size ?? 0;
}

// ── Record-level names (Görev 3) ────────────────────────────────────────────
// Every fabricated person/clinic name, registered by the data module that
// invents it. Used by the development audit below to catch a name rendered
// WITHOUT its <DemoName> marker — the record-level equivalent of the banner
// being impossible to forget.
const demoNames = new Set<string>();

// Real people who appear INSIDE fabricated records and must never be labelled
// "sample". The admin audit log invents events ("Klinik askıya alındı") but
// attributes them to the actual platform owner, and adminPlatformUsers lists
// his real account. The EVENT is fictional; the PERSON is not — stamping his
// name "ÖRNEK" would be a false statement about a real individual. Those
// screens still get the page banner, which describes the records, not him.
const REAL_PEOPLE = new Set(['Baturay Özden', 'Baturay Ozden']);

export function registerDemoNames(names: Array<string | null | undefined>): void {
  names.forEach(name => {
    const clean = name?.trim();
    if (clean && clean.length >= 3 && !REAL_PEOPLE.has(clean)) demoNames.add(clean);
  });
}

/** True for a name that is fabricated — used by call sites that render mixed lists. */
export function isDemoName(name: string | null | undefined): boolean {
  return !!name && demoNames.has(name.trim());
}

export function getRegisteredDemoNames(): string[] {
  // Longest first, so "Dr. Ayla Çelik" is matched before a shorter name it contains.
  return Array.from(demoNames).sort((a, b) => b.length - a.length);
}
