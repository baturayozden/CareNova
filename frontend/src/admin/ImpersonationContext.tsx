import React, { createContext, useCallback, useContext, useState } from 'react';
import { adminAuditEvents, AdminAuditEvent, adminClinics } from '../data/adminDemoData';

// GECE-2-BRIEFI.md Bölüm C.10 🔴 güvenlik kuralları:
//   - sadece super_admin başlatabilir (enforced by AdminProtectedRoute already
//     gating everything that renders this context's consumers)
//   - başlarken gerekçe zorunlu
//   - aktifken sürekli görünür turuncu şerit
//   - denetim kaydına yazılır (kim, hangi klinik, ne zaman, gerekçe)
//   - yazma işlemleri engellenir (salt okunur) — bu bir destek aracı
//
// Demo-mode scope: this tracks IN-MEMORY UI state (which clinic, since when,
// why) and appends to the in-memory adminAuditEvents array so the Audit Log
// page reflects it — there's no real backend to actually scope API writes to
// read-only during impersonation (no real API calls happen anywhere in demo
// mode). The read-only enforcement is therefore a UI-level contract for now
// (see isImpersonating everywhere a demo "write" action — approve/suspend/
// change plan/add quota — is offered): documented, not independently
// testable against a live write path tonight.

interface ImpersonationState {
  clinicId: string;
  clinicName: string;
  reason: string;
  startedAt: string;
}

interface ImpersonationContextValue {
  session: ImpersonationState | null;
  start: (clinicId: string, reason: string) => void;
  stop: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextValue | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ImpersonationState | null>(null);

  const start = useCallback((clinicId: string, reason: string) => {
    const clinic = adminClinics.find(c => c.id === clinicId);
    if (!clinic || !reason.trim()) return;
    const startedAt = new Date().toISOString();
    setSession({ clinicId, clinicName: clinic.name, reason, startedAt });
    const event: AdminAuditEvent = {
      id: `ae-imp-start-${Date.now()}`,
      actor: 'Baturay Özden',
      action: `Klinik olarak görüntüleme başlatıldı — gerekçe: "${reason}"`,
      clinicId: clinic.id,
      clinicName: clinic.name,
      at: startedAt,
    };
    adminAuditEvents.unshift(event);
  }, []);

  const stop = useCallback(() => {
    setSession(current => {
      if (current) {
        const event: AdminAuditEvent = {
          id: `ae-imp-end-${Date.now()}`,
          actor: 'Baturay Özden',
          action: 'Klinik olarak görüntüleme sonlandırıldı',
          clinicId: current.clinicId,
          clinicName: current.clinicName,
          at: new Date().toISOString(),
        };
        adminAuditEvents.unshift(event);
      }
      return null;
    });
  }, []);

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
