'use strict';
/**
 * De-duplicate blog post source images: 9 Pexels photos are currently reused
 * across 2-7 posts each (27 posts total sharing 9 images). Each group keeps
 * its image on one post; every other post gets a distinct, topic-relevant
 * replacement — sourced from the Pexels API, verified by eye (not guessed),
 * never colliding with any image already in use across the blog.
 *
 * Run from backend/ directory:
 *   node scripts/dedup-blog-images.js          <- dry-run (SELECT + diff only)
 *   node scripts/dedup-blog-images.js --apply  <- apply changes
 */

require('dotenv').config();
const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');
const pool  = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// slug -> { id, alt } — every post NOT listed here keeps its current image.
const REPLACEMENTS = {
  'bank-holiday-monday-dental-enquiry-surge-whatsapp-ai-closed-reception-revenue-uk-2025':
    { id: 6627725, alt: 'dental tools clinic setting' },
  'polish-speaking-dental-enquiries-whatsapp-translation-revenue-uk-2025':
    { id: 6812426, alt: 'dental office reception notebook' },
  'after-hours-5pm-9am-dental-enquiries-whatsapp-ai-revenue-loss-uk':
    { id: 6502543, alt: 'dental chair setup close-up' },
  'dental-lead-scoring-software-vs-manual-qualification-revenue-uk-2025':
    { id: 6812527, alt: 'dentists discussing dental software' },
  'romanian-bulgarian-dental-enquiries-whatsapp-translation-revenue-uk':
    { id: 7580908, alt: 'hand dialing office phone' },
  'staff-shortage-sick-days-dental-enquiry-revenue-loss-uk':
    { id: 6812436, alt: 'receptionist writing notes dental office' },
  'thursday-evening-6-8pm-dental-enquiry-peak-whatsapp-ai-closed-reception-revenue-uk':
    { id: 38055773, alt: 'modern dental office reception area' },
  'tuesday-3pm-dental-enquiry-surge-whatsapp-ai-phone-queue-revenue-uk':
    { id: 6812453, alt: 'modern dental clinic interior' },
  'lunch-hour-12-2pm-dental-enquiry-whatsapp-recovery-voicemail-revenue-loss-uk':
    { id: 305566, alt: 'dental office setup tools ready' },
  'annual-leave-holiday-rota-gaps-dental-enquiry-revenue-loss-uk':
    { id: 6170644, alt: 'planning schedule on desk calendar' },
  'french-speaking-dental-enquiries-whatsapp-translation-revenue-uk-2025':
    { id: 6812434, alt: 'smiling receptionist dental clinic lobby' },
  '60-second-whatsapp-response-time-dental-implant-conversion-uk':
    { id: 32959143, alt: 'hand holding smartphone with notifications' },
  'dental-patient-journey-software-vs-whatsapp-lead-recovery-uk-2025':
    { id: 5355731, alt: 'dentist analyzing dental x-ray on tablet' },
  'romanian-speaking-dental-enquiries-whatsapp-translation-revenue-uk-2025':
    { id: 39192394, alt: 'doctors reviewing medical information on tablet' },
  'first-time-caller-returning-patient-dental-lead-priority-revenue-loss-uk':
    { id: 7820322, alt: 'receptionist wearing mask talking on phone' },
  'dental-appointment-cancellation-late-notice-revenue-loss-uk':
    { id: 7789620, alt: 'clean medical examination room equipment' },
  'price-shopping-objection-dental-implant-enquiry-revenue-loss-uk':
    { id: 7108398, alt: 'doctor discussing prescription with patient' },
  'same-day-vs-next-day-dental-enquiry-response-revenue-loss-uk':
    { id: 34007073, alt: 'dental professionals attending patients modern clinic' },
};

function pexelsUrl(id) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940`;
}

(async () => {
  const { rows: posts } = await pool.query(
    `SELECT id, slug, image_url, image_alt FROM blog_posts WHERE is_published = TRUE`,
  );
  const bySlug = Object.fromEntries(posts.map(p => [p.slug, p]));

  const missing = Object.keys(REPLACEMENTS).filter(s => !bySlug[s]);
  if (missing.length) {
    console.error('Slugs not found in DB:', missing);
    await pool.end();
    process.exit(1);
  }

  console.log(`\n${Object.keys(REPLACEMENTS).length} post(s) to update:\n`);
  for (const [slug, r] of Object.entries(REPLACEMENTS)) {
    const post = bySlug[slug];
    console.log(`  ${slug}`);
    console.log(`    old: ${post.image_url}`);
    console.log(`    new: ${pexelsUrl(r.id)}`);
    console.log(`    alt: "${post.image_alt}" -> "${r.alt}"`);
  }

  if (!APPLY) {
    console.log('\n--- DRY RUN — pass --apply to execute ---');
    await pool.end();
    return;
  }

  console.log('\n--- APPLYING ---');
  let updated = 0;
  for (const [slug, r] of Object.entries(REPLACEMENTS)) {
    await pool.query(
      `UPDATE blog_posts SET image_url = $1, image_alt = $2 WHERE slug = $3`,
      [pexelsUrl(r.id), r.alt, slug],
    );
    updated++;
  }
  console.log(`\nUpdated ${updated} post(s).`);
  await pool.end();
})();
