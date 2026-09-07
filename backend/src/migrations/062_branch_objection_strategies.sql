-- Migration 062: objection_strategies column + retire pre-taxonomy objection
-- labels (GECE-4-BRIEFI.md Bölüm D.1, CARENOVA-STRATEJI.md M0.7).
--
-- Migration 058 seeded branch_objections with ad-hoc labels written before
-- the 11-value health-tourism objection taxonomy existed:
-- hair_transplant had 'donor_damage'/'graft_count_dispute',
-- dental had 'material_brand_dispute' — none of which are real
-- OBJECTION_TYPES keys in services/ai.js. This migration replaces them
-- with real taxonomy keys and adds objection_strategies (per-branch reply
-- guidance text, TR — read by services/promptCompiler.js's objection
-- layer) for the 3 fully-authored system branches.
--
-- NOT executed tonight (no reachable database — see BLOKAJLAR.md B2).
BEGIN;

ALTER TABLE branch_templates ADD COLUMN IF NOT EXISTS objection_strategies JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN branch_templates.objection_strategies IS
  'Map of objection-type key (services/ai.js OBJECTION_TYPES) -> TR reply guidance for that branch, injected into the compiled prompt when that objection is detected in the patient''s message. Falls back to a generic instruction (promptCompiler.js) for any objection type not present here.';

UPDATE branch_templates SET
  branch_objections = '["trust_surgeon", "safety_fear", "price_shock"]'::jsonb,
  objection_strategies = '{
    "trust_surgeon": "Doktorun adını, tescil numarasını ve deneyimini paylaş; doktor kimlik kartı linkini gönder ve 10 dakikalık video konsültasyon öner. Kendi başına ikna etmeye çalışma.",
    "safety_fear": "Endişeyi önce kabul et, sonra kliniğin komplikasyon sigortası ve doktorun deneyimini belirt; video konsültasyon öner. Kesin sonuç veya risk yok garantisi verme.",
    "price_shock": "Fiyatın neyi kapsadığını (operasyon, konaklama, transfer, kontroller) kalem kalem hatırlat; kesin fiyat için ücretsiz konsültasyon öner.",
    "trust_clinic": "Kliniğin lisans/tescil bilgilerini ve kaç yıldır faaliyette olduğunu paylaş; hasta yorumu PAYLAŞMA (Tanıtım Yönetmeliği yasağı).",
    "aftercare_fear": "Dönüş sonrası D+1den D+365e kadar süren bakım hattını ve komplikasyon durumunda anında doktora ulaşma imkanını anlat.",
    "travel_friction": "Vize/uçuş/transfer/tercüman süreçlerinin klinik tarafından koordine edildiğini, hastanın sadece uçuşunu ayarlaması gerektiğini anlat.",
    "timing": "Baskı yapma; ne zaman hazır olursa süreci sürdürebileceklerini, teklifin geçerlilik süresi içinde beklemekte özgür olduklarını söyle.",
    "comparison_shopping": "Fiyat kıyaslamasına girme; kliniğin kilitli teklif ve doktor onay sürecinin farkını (fiyat garantisi) vurgula.",
    "language_barrier": "Kendi dillerinde 7/24 iletişim kurabileceklerini ve klinikte tercüman eşliğinde görüşeceklerini belirt.",
    "partner_approval": "Eşinin/ailesinin de sürece dahil olabileceğini, birlikte bir görüşme ayarlanabileceğini öner.",
    "financing": "Taksitli ödeme seçeneklerinin olup olmadığını klinik bilgi bankasından kontrol et; bilgi bankasında yoksa konsültasyonda görüşüleceğini söyle."
  }'::jsonb
WHERE key = 'hair_transplant';

UPDATE branch_templates SET
  branch_objections = '["trust_surgeon", "price_shock", "trust_clinic"]'::jsonb,
  objection_strategies = '{
    "trust_surgeon": "Doktorun adını, tescil numarasını ve deneyimini paylaş; doktor kimlik kartı linkini gönder ve video konsültasyon öner.",
    "price_shock": "İmplant/zirkonya materyalinin markasını (bilgi bankasında varsa) ve fiyata dahil olan kontrolleri hatırlat; panoramik/CBCT olmadan kesin fiyat verilemeyeceğini nazikçe belirt.",
    "trust_clinic": "Kullanılan materyal markalarını (SADECE bilgi bankasında geçenleri) ve kliniğin lisans bilgisini paylaş; hasta yorumu PAYLAŞMA."
  }'::jsonb
WHERE key = 'dental';

UPDATE branch_templates SET
  objection_strategies = '{
    "safety_fear": "Endişeyi kabul et; anestezi uygunluk değerlendirmesinin doktor tarafından yapılacağını, cerrahi riskin konsültasyonda açıkça konuşulacağını söyle. Güvenlik garantisi verme.",
    "trust_surgeon": "Doktorun adını, tescil numarasını ve deneyimini paylaş; video konsültasyon öner.",
    "aftercare_fear": "D+1den D+180e kadar süren bakım hattını ve komplikasyon durumunda triyaj sürecini anlat."
  }'::jsonb
WHERE key = 'aesthetic_surgery';

COMMIT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- BEGIN;
-- ALTER TABLE branch_templates DROP COLUMN IF EXISTS objection_strategies;
-- -- branch_objections values are not reversible to their pre-migration
-- -- ad-hoc labels (not preserved anywhere) — restore from a pre-migration
-- -- backup if needed.
-- COMMIT;
