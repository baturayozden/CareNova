import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminFormat } from '../lib/format';
import StatusBadge from './StatusBadge';
import { NotMeasured } from './QueryState';
import type { AdminClinic } from '../types';

// Tri-state compliance display. 'unknown' is its own neutral badge: a clinic
// nobody has assessed must read neither as compliant nor as in breach.

type C = AdminClinic['compliance'];

export function LicenseBadge({ licenseNumber, assessed }: { licenseNumber: string | null; assessed: boolean }) {
  const { t } = useTranslation('admin');
  if (licenseNumber) return <StatusBadge tone="success">{t('complianceStatus.onFile')}</StatusBadge>;
  if (!assessed) return <StatusBadge tone="neutral">{t('complianceStatus.unknown')}</StatusBadge>;
  return <StatusBadge tone="danger">{t('complianceStatus.missing')}</StatusBadge>;
}

export function InsuranceBadge({ status }: { status: C['complicationInsurance'] }) {
  const { t } = useTranslation('admin');
  const tone = status === 'active' ? 'success' : status === 'unknown' ? 'neutral' : 'danger';
  return <StatusBadge tone={tone}>{t(`complianceStatus.insurance.${status}`)}</StatusBadge>;
}

export function VerbisBadge({ status }: { status: C['verbis'] }) {
  const { t } = useTranslation('admin');
  const tone = status === 'registered' ? 'success' : status === 'unknown' ? 'neutral' : 'danger';
  return <StatusBadge tone={tone}>{t(`complianceStatus.verbis.${status}`)}</StatusBadge>;
}

export function CrossBorderBadge({ status }: { status: C['crossBorderContract'] }) {
  const { t } = useTranslation('admin');
  const tone = status === 'signed' ? 'success' : status === 'unknown' ? 'neutral' : 'danger';
  return <StatusBadge tone={tone}>{t(`complianceStatus.crossBorder.${status}`)}</StatusBadge>;
}

/** Ek-1 consent counts. Nothing records them yet, so this is "not measured" — never a number. */
export function Ek1Cell({ compliance }: { compliance: C }) {
  const { t } = useTranslation('admin');
  if (compliance.ek1ConsentsTotal == null) return <NotMeasured reason={t('complianceStatus.ek1NotMeasured')} />;
  return (
    <span className="text-ink-muted text-xs">
      {t('complianceStatus.ek1Counts', { total: compliance.ek1ConsentsTotal, revoked: compliance.ek1ConsentsRevoked ?? 0 })}
    </span>
  );
}

export function LanguageRatio({ ratio }: { ratio: number | null }) {
  const { pct } = useAdminFormat();
  if (ratio == null) return <span className="text-ink-subtle">—</span>;
  return <span className={ratio < 20 ? 'text-warning' : 'text-ink'}>{pct(ratio)}</span>;
}

const lapsed = (iso: string | null) => iso !== null && new Date(iso).getTime() < Date.now();

/** Fully compliant = assessed, and every obligation positively on file and not past its end date. */
export function isFullyCompliant(c: Pick<AdminClinic, 'licenseNumber' | 'licenseExpiry' | 'compliance'>): boolean {
  const k = c.compliance;
  return k.assessed && !!c.licenseNumber && !lapsed(c.licenseExpiry)
    && k.complicationInsurance === 'active' && !lapsed(k.complicationInsuranceExpiry)
    && k.verbis === 'registered' && k.crossBorderContract === 'signed';
}
