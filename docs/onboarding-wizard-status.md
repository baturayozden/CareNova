# `OnboardingWizard.tsx` — disconnected, not deleted

**Status (Gece 3, GECE-3-BRIEFI.md Bölüm B):** no longer rendered anywhere.
`frontend/src/components/OnboardingWizard.tsx` still exists on disk but has
zero remaining references in the app.

## Why it was disconnected

It's CareDental's inherited onboarding flow — a full-screen modal that
auto-opened on every visit to `/dashboard` (see `Dashboard.tsx`, which
used to render `<OnboardingWizard />` unconditionally at the bottom) plus a
persistent bottom-right "Finish setting up your AI" pill when dismissed.
Its 3 steps (Availability hours, AI voice/tone) are CareDental's dental-
booking setup, entirely in English, and don't correspond to any step of
CareNova's own onboarding (CARENOVA-STRATEJI.md Bölüm 7/M11 — 7 steps:
clinic info, branch selection, WhatsApp connection, doctor cards,
knowledge base, pricing/authority approval, KVKK texts, test → live).

A clinic user's very first view of the product was a CareDental-branded,
English-only modal blocking the screen — reported as Bulgu 2 in
GECE-3-BRIEFI.md.

## What replaced it

Nothing yet, functionally — a dismissible "Kurulumu tamamla" card was
planned for the dashboard (brief's own Bölüm B.2), but since Bölüm C
rebuilds the entire dashboard in the same session, that card was built
directly into the new case-centric dashboard instead of into the old
lead-board dashboard that Bölüm C was about to delete anyway (see
GECE-LOG.md Bölüm B/C for that sequencing decision). It links to
`/settings/onboarding`, which is an honest "Coming Soon" page — CareNova's
own 7-step wizard itself is not built tonight.

## Why not delete the file

The brief's own instruction: disconnect, don't delete. CareNova's real
onboarding wizard will likely reuse parts of this component's UI shell
(the step-indicator dots, the modal chrome) even though none of its
content applies — deleting it now would mean rebuilding that chrome from
scratch later for no reason. If CareNova's onboarding wizard is built and
ends up sharing nothing with this file, delete it then, not now.
