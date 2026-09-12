#!/usr/bin/env node
'use strict';

// Generates scripts/demo-platform-seed-data.json FROM
// frontend/src/data/adminDemoData.ts — the admin console's demo platform.
//
// The data is compiled from the TypeScript source, not retyped, so the seeded
// database and the dataset the panel was designed around cannot drift apart.
// (The earlier demo-seed-data.json was described as generated from caseData.ts,
// but the step that produced it was never committed — this one is.)
//
// Every timestamp is stored as an OFFSET from the dataset's fixed reference
// time (DEMO_NOW_MS), not as an absolute date. The seeder re-bases offsets onto
// the moment it runs. Absolute dates would age out: "last 24 hours" and "this
// month" figures derived from the rows would be empty a day after seeding.
//
//   node backend/scripts/generate-admin-seed-data.js           # write the JSON
//   node backend/scripts/generate-admin-seed-data.js --check   # fail if it is stale

const fs = require('fs');
const os = require('os');
const path = require('path');

const FRONTEND = path.join(__dirname, '..', '..', 'frontend');
const OUT = path.join(__dirname, 'demo-platform-seed-data.json');
const ts = require(path.join(FRONTEND, 'node_modules', 'typescript'));

function compileDataModule() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-admin-seed-'));
  const sources = {
    'data/adminDemoData': path.join(FRONTEND, 'src/data/adminDemoData.ts'),
    'lib/demoProvenance': path.join(FRONTEND, 'src/lib/demoProvenance.ts'),
  };
  for (const [rel, file] of Object.entries(sources)) {
    const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
    });
    const dest = path.join(work, `${rel}.js`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, outputText);
  }
  // demoProvenance only touches `window` when tracking is enabled, which it never is here.
  const mod = require(path.join(work, 'data/adminDemoData.js'));
  fs.rmSync(work, { recursive: true, force: true });
  return mod;
}

function build() {
  const d = compileDataModule();
  const REF = d.DEMO_NOW_MS;
  const off = iso => (iso ? REF - new Date(iso).getTime() : null); // ms BEFORE the reference (negative = future)

  // Spreading copies out of the Proxy wrappers into plain data.
  return {
    _generatedFrom: 'frontend/src/data/adminDemoData.ts — do not edit by hand; re-run generate-admin-seed-data.js',
    _timeModel: 'All *Offset fields are milliseconds before the seed moment (negative = in the future).',
    onboardingSteps: [...d.ONBOARDING_STEPS],
    clinics: [...d.adminClinics].map(c => ({
      key: c.id,
      name: c.name,
      legalName: c.legalName,
      city: c.city,
      branches: [...c.branches],
      plan: c.plan,
      status: c.status,
      userCount: c.userCount,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      timezone: c.timezone,
      currency: c.currency,
      licenseNumber: c.licenseNumber,
      licenseExpiryOffset: off(c.licenseExpiry),
      onboarding: { step: c.onboarding.step, stepStartedOffset: off(c.onboarding.stepStartedAt), stuck: c.onboarding.stuck },
      whatsapp: { ...c.whatsapp, lastWebhookSuccessOffset: off(c.whatsapp.lastWebhookSuccessAt), lastWebhookSuccessAt: undefined },
      aiUsage: { monthlyQuota: c.aiUsage.monthlyQuota, usedThisMonth: c.aiUsage.usedThisMonth, overagePolicy: c.aiUsage.overagePolicy },
      compliance: {
        licenseOnFile: c.compliance.licenseOnFile,
        complicationInsurance: c.compliance.complicationInsurance,
        complicationInsuranceExpiryOffset: off(c.compliance.complicationInsuranceExpiry),
        verbisRegistered: c.compliance.verbisRegistered,
        foreignLanguageStaffRatio: c.compliance.foreignLanguageStaffRatio,
        crossBorderNotified: c.compliance.crossBorderNotified,
        crossBorderNotifiedOffset: off(c.compliance.crossBorderNotifiedAt),
        // ek1TotalConsents / ek1RevokedConsents / ek1HasUnconsentedMedia are
        // deliberately NOT carried over: there are no consent records behind
        // them, and a count with nothing behind it is a fabricated consent claim.
      },
      billing: { periodicity: c.billing.periodicity, status: c.billing.status, nextChargeOffset: off(c.billing.nextChargeAt) },
    })),
    clinicUsers: [...d.adminClinicUsers].map(u => ({
      name: u.name, email: u.email, clinicKey: u.clinicId, role: u.role, lastLoginOffset: off(u.lastLoginAt),
    })),
    demoRequests: [...d.adminDemoRequests].map(r => ({
      name: r.name, email: r.email, clinicName: r.clinic, city: r.city, branchKey: r.branch,
      phone: r.phone, status: r.status, notes: r.note || null, createdOffset: off(r.createdAt),
    })),
    // adminAuditEvents deliberately NOT carried over: audit_logs is append-only
    // (migration 070), so a seeded fabricated event could never be purged.
    healthErrors: [...d.adminHealth.recentErrors].map(e => ({
      clinicName: e.clinicName, message: e.message, atOffset: off(e.at),
    })),
  };
}

const json = `${JSON.stringify(build(), null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== json) {
    console.error('demo-platform-seed-data.json is STALE: adminDemoData.ts changed. Re-run generate-admin-seed-data.js.');
    process.exit(1);
  }
  console.log('demo-platform-seed-data.json is up to date.');
} else {
  fs.writeFileSync(OUT, json);
  const data = JSON.parse(json);
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${data.clinics.length} clinics, ${data.clinicUsers.length} named users, ${data.demoRequests.length} demo requests.`);
}
