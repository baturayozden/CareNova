import React, { createContext, useCallback, useContext, useState } from 'react';

// GECE-2-BRIEFI.md Bölüm C.10 🔴 güvenlik kuralları:
//   - sadece super_admin başlatabilir (enforced by AdminProtectedRoute already
//     gating everything that renders this context's consumers)
//   - başlarken gerekçe zorunlu
//   - aktifken sürekli görünür turuncu şerit
//   - denetim kaydına yazılır (kim, hangi klinik, ne zaman, gerekçe)
//   - yazma işlemleri engellenir (salt okunur) — bu bir destek aracı
//
// Current scope: UI state only (which clinic, since when, why). Two of the
// rules above are NOT met yet, and the screen says so instead of pretending:
//   * Nothing is written to the audit log. The earlier demo version appended an
//     invented event to an in-memory array; with the log now read from the
//     database (append-only, migration 070), a screen-only event would be a
//     record that does not exist. Writing it needs a server endpoint.
//   * No request actually runs "as" the clinic, so there is nothing to make
//     read-only yet. The server-side guard exists (middleware/auth.js,
//     blockWritesDuringImpersonation) for when requests do.

interface ImpersonationState {
  clinicId: string;
  clinicName: string;
  reason: string;
  startedAt: string;
}

interface ImpersonationContextValue {
  session: ImpersonationState | null;
  start: (clinicId: string, clinicName: string, reason: string) => void;
  stop: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextValue | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ImpersonationState | null>(null);

  const start = useCallback((clinicId: string, clinicName: string, reason: string) => {
    if (!clinicId || !reason.trim()) return;
    setSession({ clinicId, clinicName, reason, startedAt: new Date().toISOString() });
  }, []);

  const stop = useCallback(() => setSession(null), []);

  return (
    <ImpersonationContext.Provider value={{ session, start, stop }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation(): ImpersonationContextValue {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within an ImpersonationProvider');
  return ctx;
}
