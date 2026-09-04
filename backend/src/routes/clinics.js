const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const https    = require('https');
const { pool } = require('../db/index');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');

// Generates a readable 14-char temporary password with at least one uppercase,
// one lowercase, and one digit. Excludes ambiguous chars (0/O, 1/l/I).
function generateTempPassword() {
  const upper  = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all    = upper + lower + digits;

  let password = '';
  // Guarantee one of each required class at fixed positions
  password += upper [crypto.randomInt(upper.length)];
  password += lower [crypto.randomInt(lower.length)];
  password += digits[crypto.randomInt(digits.length)];
  // Fill remaining 11 characters from the full set
  for (let i = 3; i < 14; i++) {
    password += all[crypto.randomInt(all.length)];
  }
  // Shuffle so the guaranteed chars don't always sit at positions 0-2
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function isSuperAdmin(req)  { return req.user?.role === 'super_admin'; }
function isClinicAdmin(req) {
  return ['clinic_admin', 'director'].includes(req.user?.role) || isSuperAdmin(req);
}

// Role name → DB id map (after migrate-roles.js)
const ROLE_IDS = {
  director:               2,
  clinic_admin:           3,
  receptionist:           4,
  dentist:                5,
  treatment_coordinator:  6,
  sales:                  9,
};

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Super admin only' });
  next();
}
function requireClinicAdmin(req, res, next) {
  if (!isClinicAdmin(req)) return res.status(403).json({ error: 'Clinic admin or above required' });
  next();
}

// ---------------------------------------------------------------------------
// Shared row mapper
// ---------------------------------------------------------------------------
function mapTenant(r) {
  return {
    id:          r.id,
    name:        r.name,
    slug:        r.slug,
    status:      r.status,
    planTier:    r.plan_tier,
    address:     r.address    || null,
    phone:       r.phone      || null,
    email:       r.email      || null,
    website:     r.website    || null,
    logoUrl:     r.logo_url   || null,
    timezone:    r.timezone,
    country:     r.country    || null,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Slug generator
// ---------------------------------------------------------------------------
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

async function uniqueSlug(base) {
  let slug = base;
  let attempt = 0;
  while (true) {
    const { rows } = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [slug]
    );
    if (rows.length === 0) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

// ---------------------------------------------------------------------------
// GET /api/clinics  — list all (super admin sees all; clinic user sees own)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const superAdmin = isSuperAdmin(req);
    const whereClause = superAdmin
      ? 'WHERE t.deleted_at IS NULL'
      : 'WHERE t.deleted_at IS NULL AND t.id = $1';
    const params = superAdmin ? [] : [req.user.tenantId];

    const { rows } = await pool.query(`
      SELECT
        t.id, t.name, t.slug, t.status, t.plan_tier,
        t.address, t.phone, t.email, t.website, t.logo_url,
        t.timezone, t.country, t.created_at, t.updated_at,

        (SELECT COALESCE(tbp.finance_enabled, TRUE)
         FROM tenant_billing_profiles tbp
         WHERE tbp.tenant_id = t.id)                               AS finance_enabled,

        COUNT(DISTINCT l.id)                                       AS total_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'booked')   AS booked_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'attended') AS attended_leads,
        COALESCE(SUM(l.treatment_value) FILTER (
          WHERE l.status IN ('booked','attended')
        ), 0)                                                       AS mrr_pipeline,
        ROUND(
          COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('booked','attended'))::numeric
          / NULLIF(COUNT(DISTINCT l.id), 0) * 100
        , 1)                                                        AS booking_rate,
        COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL)   AS staff_count

      FROM tenants t
      LEFT JOIN leads l ON l.tenant_id = t.id AND l.deleted_at IS NULL
      LEFT JOIN users u ON u.tenant_id = t.id AND u.deleted_at IS NULL
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `, params);

    const clinics = rows.map(r => ({
      ...mapTenant(r),
      financeEnabled: r.finance_enabled !== false,
      totalLeads:  parseInt(r.total_leads,   10),
      bookedLeads: parseInt(r.booked_leads,  10) + parseInt(r.attended_leads, 10),
      bookingRate: parseFloat(r.booking_rate) || 0,
      mrrPipeline: parseFloat(r.mrr_pipeline) || 0,
      staffCount:  parseInt(r.staff_count,   10),
    }));

    res.json({ clinics, total: clinics.length });
  } catch (err) {
    console.error('[Clinics] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch clinics' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/clinics  — create new clinic (super admin only)
// ---------------------------------------------------------------------------
router.post('/', requireSuperAdmin, async (req, res) => {
  const { name, address, phone, email, website, planTier = 'starter' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Clinic name is required' });

  const DEFAULT_PASSWORD = 'CareNova2026!';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create tenant
    const slug = await uniqueSlug(slugify(name));
    const { rows: [tenant] } = await client.query(`
      INSERT INTO tenants (name, slug, status, plan_tier, address, phone, email, website, country, timezone)
      VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, 'TR', 'Europe/Istanbul')
      RETURNING *
    `, [name.trim(), slug, planTier, address || null, phone || null, email || null, website || null]);

    // 2. Derive admin email from supplied email or slug
    const adminEmail = email?.trim() || `admin@${slug}.carenova.ai`;

    // 3. Create clinic_admin user (role_id = 3)
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const nameParts  = name.trim().split(' ');
    const firstName  = nameParts[0];
    const lastName   = nameParts.slice(1).join(' ') || 'Admin';

    const { rows: [user] } = await client.query(`
      INSERT INTO users
        (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
      VALUES ($1, 3, $2, $3, $4, $5, TRUE)
      RETURNING id, email, first_name, last_name
    `, [tenant.id, adminEmail, hash, firstName, lastName]);

    await client.query('COMMIT');

    console.log(`[Clinics] Created "${tenant.name}" (${tenant.id}) + admin ${user.email}`);
    res.status(201).json({
      clinic: {
        ...mapTenant(tenant),
        totalLeads: 0, bookedLeads: 0, bookingRate: 0, mrrPipeline: 0, staffCount: 1,
      },
      admin: {
        email:     user.email,
        firstName: user.first_name,
        lastName:  user.last_name,
        password:  DEFAULT_PASSWORD,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Clinics] POST / error:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'A clinic with that slug already exists' });
    res.status(500).json({ error: 'Failed to create clinic' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// GET /api/clinics/:id  — full detail with stats + staff + whatsapp + onboarding
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const clinicId  = req.params.id;
    // Non-super-admins can only see their own clinic
    if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Clinic + stats
    const { rows } = await pool.query(`
      SELECT
        t.*,
        COUNT(DISTINCT l.id)                                        AS total_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'booked')    AS booked_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'attended')  AS attended_leads,
        COALESCE(SUM(l.treatment_value) FILTER (
          WHERE l.status IN ('booked','attended')
        ), 0)                                                        AS mrr_pipeline,
        ROUND(
          COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('booked','attended'))::numeric
          / NULLIF(COUNT(DISTINCT l.id), 0) * 100
        , 1)                                                         AS booking_rate,
        -- average AI response gap (seconds)
        ROUND(AVG(
          EXTRACT(EPOCH FROM (
            (SELECT m2.created_at FROM messages m2
             WHERE m2.lead_id = l.id AND m2.direction = 'outbound'
               AND m2.created_at > m1_agg.first_in
             ORDER BY m2.created_at LIMIT 1)
             - m1_agg.first_in
          ))
        ))                                                           AS avg_response_secs
      FROM tenants t
      LEFT JOIN leads l ON l.tenant_id = t.id AND l.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT MIN(m.created_at) AS first_in
        FROM messages m
        WHERE m.lead_id = l.id AND m.direction = 'inbound'
      ) m1_agg ON TRUE
      WHERE t.id = $1 AND t.deleted_at IS NULL
      GROUP BY t.id
    `, [clinicId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
    const r = rows[0];

    // Staff — via user_tenants so multi-tenant users appear in each clinic they belong to
    const { rows: staffRows } = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
             u.last_login_at, u.created_at, r.name AS role, ut.role_id
      FROM user_tenants ut
      JOIN users u ON u.id = ut.user_id
      JOIN roles r ON r.id = ut.role_id
      WHERE ut.tenant_id = $1 AND u.deleted_at IS NULL
      ORDER BY u.created_at ASC
    `, [clinicId]);

    // WhatsApp configs
    const { rows: waRows } = await pool.query(`
      SELECT id, display_name, phone_number_id, is_active, created_at
      FROM whatsapp_configs
      WHERE tenant_id = $1
    `, [clinicId]);

    // Onboarding state
    const profileComplete     = !!(r.address || r.phone || r.email);
    const whatsappConnected   = waRows.some(w => w.is_active);
    const firstLeadReceived   = parseInt(r.total_leads, 10) > 0;
    const firstBookingMade    = (parseInt(r.booked_leads, 10) + parseInt(r.attended_leads, 10)) > 0;

    // AI quota usage this month
    const { rows: aiCountRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM messages
       WHERE tenant_id = $1 AND direction = 'outbound' AND ai_generated = TRUE
         AND created_at >= DATE_TRUNC('month', NOW())`,
      [clinicId]
    );
    const thisMonthAiMessages = parseInt(aiCountRows[0]?.cnt || 0, 10);

    res.json({
      clinic: {
        ...mapTenant(r),
        aiMonthlyLimit:    parseInt(r.ai_monthly_limit  || 500, 10),
        aiOveragePolicy:   r.ai_overage_policy           || 'notify',
        thisMonthAiMessages,
        totalLeads:       parseInt(r.total_leads,   10),
        bookedLeads:      parseInt(r.booked_leads,  10) + parseInt(r.attended_leads, 10),
        bookingRate:      parseFloat(r.booking_rate) || 0,
        mrrPipeline:      parseFloat(r.mrr_pipeline) || 0,
        avgResponseSecs:  r.avg_response_secs ? parseInt(r.avg_response_secs, 10) : null,
        staffCount:       staffRows.length,
        staff: staffRows.map(s => ({
          id:          s.id,
          email:       s.email,
          firstName:   s.first_name,
          lastName:    s.last_name,
          phone:       s.phone || null,
          role:        s.role,
          roleId:      s.role_id,
          isActive:    s.is_active,
          lastLoginAt: s.last_login_at,
          createdAt:   s.created_at,
        })),
        whatsapp: {
          connected: whatsappConnected,
          configs: waRows.map(w => ({
            id:            w.id,
            displayName:   w.display_name,
            phoneNumberId: w.phone_number_id,
            isActive:      w.is_active,
            createdAt:     w.created_at,
          })),
        },
        onboarding: {
          profileComplete,
          whatsappConnected,
          firstLeadReceived,
          firstBookingMade,
        },
      },
    });
  } catch (err) {
    console.error('[Clinics] GET /:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch clinic' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/clinics/:id  — update profile (clinic_admin or super_admin)
// ---------------------------------------------------------------------------
router.put('/:id', requireClinicAdmin, async (req, res) => {
  const clinicId = req.params.id;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, address, phone, email, website, planTier, timezone } = req.body;

  try {
    const { rows } = await pool.query(`
      UPDATE tenants SET
        name      = COALESCE($2, name),
        address   = COALESCE($3, address),
        phone     = COALESCE($4, phone),
        email     = COALESCE($5, email),
        website   = COALESCE($6, website),
        plan_tier = COALESCE($7, plan_tier),
        timezone  = COALESCE($8, timezone),
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `, [clinicId, name || null, address || null, phone || null,
        email || null, website || null, planTier || null, timezone || null]);

    if (rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
    res.json({ clinic: mapTenant(rows[0]) });
  } catch (err) {
    console.error('[Clinics] PUT /:id error:', err.message);
    res.status(500).json({ error: 'Failed to update clinic' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/clinics/:id/suspend  — suspend clinic (super_admin only)
// ---------------------------------------------------------------------------
router.patch('/:id/suspend', requireSuperAdmin, async (req, res) => {
  const clinicId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE tenants SET status = 'suspended', updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING *
    `, [clinicId]);
    if (rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Clinic not found' }); }

    // Disable all users in this clinic
    await client.query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [clinicId]
    );
    await client.query('COMMIT');
    res.json({ clinic: mapTenant(rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Clinics] PATCH /suspend error:', err.message);
    res.status(500).json({ error: 'Failed to suspend clinic' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/clinics/:id/activate  — reactivate suspended clinic (super_admin)
// ---------------------------------------------------------------------------
router.patch('/:id/activate', requireSuperAdmin, async (req, res) => {
  const clinicId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE tenants SET status = 'active', updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING *
    `, [clinicId]);
    if (rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Clinic not found' }); }

    // Re-enable all users
    await client.query(
      `UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [clinicId]
    );
    await client.query('COMMIT');
    res.json({ clinic: mapTenant(rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Clinics] PATCH /activate error:', err.message);
    res.status(500).json({ error: 'Failed to activate clinic' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/clinics/:id  — soft delete (super_admin only)
// ---------------------------------------------------------------------------
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const clinicId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE tenants SET deleted_at = NOW(), status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING id, name
    `, [clinicId]);
    if (rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Clinic not found' }); }

    // Soft-delete all users
    await client.query(
      `UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE tenant_id = $1`,
      [clinicId]
    );
    await client.query('COMMIT');
    res.json({ success: true, deleted: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Clinics] DELETE /:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete clinic' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// GET /api/clinics/:id/staff  — staff list
// ---------------------------------------------------------------------------
router.get('/:id/staff', async (req, res) => {
  const clinicId = req.params.id;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
             u.last_login_at, u.created_at, r.name AS role, ut.role_id
      FROM user_tenants ut
      JOIN users u ON u.id = ut.user_id
      JOIN roles r ON r.id = ut.role_id
      WHERE ut.tenant_id = $1 AND u.deleted_at IS NULL
      ORDER BY u.created_at ASC
    `, [clinicId]);

    res.json({
      staff: rows.map(s => ({
        id:          s.id,
        email:       s.email,
        firstName:   s.first_name,
        lastName:    s.last_name,
        phone:       s.phone || null,
        role:        s.role,
        roleId:      s.role_id,
        isActive:    s.is_active,
        lastLoginAt: s.last_login_at,
        createdAt:   s.created_at,
      })),
    });
  } catch (err) {
    console.error('[Clinics] GET /:id/staff error:', err.message);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/clinics/:id/sales-users — list active assignable users for the
// assignment dropdown: treatment coordinators + sales, plus clinic admins
// (clinic_admin / director / admin) so a case can be assigned to the clinic's
// admin account as a fallback owner and re-assigned later.
// ---------------------------------------------------------------------------
const ASSIGNABLE_ROLES = ['treatment_coordinator', 'sales', 'clinic_admin', 'director', 'admin'];

router.get('/:id/sales-users', async (req, res) => {
  const clinicId = req.params.id;
  if (!isClinicAdmin(req)) return res.status(403).json({ error: 'Access denied' });
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    // Assignable users come from two membership models, so UNION both:
    //  1. user_tenants — multi-tenant staff (TC / sales added via staff mgmt).
    //  2. users.tenant_id/role_id — the clinic's original admin, created at
    //     clinic-creation time with NO user_tenants row. Without this branch the
    //     clinic admin (e.g. info@vestadent) never appears in the dropdown.
    const { rows } = await pool.query(`
      SELECT id, first_name, last_name, email FROM (
        SELECT u.id, u.first_name, u.last_name, u.email
        FROM user_tenants ut
        JOIN users u ON u.id = ut.user_id
        JOIN roles  r ON r.id = ut.role_id
        WHERE ut.tenant_id = $1 AND r.name = ANY($2)
          AND u.deleted_at IS NULL AND u.is_active = TRUE
        UNION
        SELECT u.id, u.first_name, u.last_name, u.email
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.tenant_id = $1 AND r.name = ANY($2)
          AND u.deleted_at IS NULL AND u.is_active = TRUE
      ) merged
      ORDER BY first_name ASC, last_name ASC
    `, [clinicId, ASSIGNABLE_ROLES]);
    res.json({
      salesUsers: rows.map(u => ({
        id:        u.id,
        firstName: u.first_name,
        lastName:  u.last_name,
        email:     u.email,
      })),
    });
  } catch (err) {
    console.error('[Clinics] GET /:id/sales-users error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sales users.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/clinics/:id/staff  — add staff member
// ---------------------------------------------------------------------------
router.post('/:id/staff', requireClinicAdmin, async (req, res) => {
  const clinicId = req.params.id;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { email, firstName, lastName, role = 'receptionist' } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!firstName?.trim()) return res.status(400).json({ error: 'First name is required' });

  const roleId = ROLE_IDS[role] || ROLE_IDS.receptionist;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { rows: tenantRows } = await pool.query(
      'SELECT name FROM tenants WHERE id = $1 AND deleted_at IS NULL',
      [clinicId]
    );
    if (tenantRows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
    const clinicName = tenantRows[0].name;

    const { rows: roleRows } = await pool.query('SELECT name FROM roles WHERE id = $1', [roleId]);
    const roleName = roleRows[0]?.name || role;

    // Global email dedup — check across ALL tenants before any INSERT
    const { rows: existingUsers } = await pool.query(
      'SELECT id, tenant_id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];

      // Case A: same clinic → conflict
      if (existing.tenant_id === clinicId) {
        return res.status(409).json({ error: 'A user with that email already exists in this clinic' });
      }

      // Case B: different tenant → link to this clinic via user_tenants only (no new users row)
      await pool.query(
        `INSERT INTO user_tenants (user_id, tenant_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, tenant_id) DO NOTHING`,
        [existing.id, clinicId, roleId]
      );

      const { rows: ud } = await pool.query(
        'SELECT id, email, first_name, last_name, role_id, is_active, created_at, last_login_at FROM users WHERE id = $1',
        [existing.id]
      );
      const u = ud[0];
      return res.status(200).json({
        addedToClinic: true,
        staff: {
          id:          u.id,
          email:       u.email,
          firstName:   u.first_name,
          lastName:    u.last_name,
          role:        roleName,
          roleId,
          isActive:    u.is_active,
          lastLoginAt: u.last_login_at || null,
          createdAt:   u.created_at,
        },
      });
    }

    // Case C: brand-new user — wrap users INSERT + user_tenants INSERT in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tempPassword = generateTempPassword();
      const hash = await bcrypt.hash(tempPassword, 12);

      const { rows } = await client.query(`
        INSERT INTO users
          (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING id, email, first_name, last_name, role_id, is_active, created_at
      `, [clinicId, roleId, normalizedEmail, hash, firstName.trim(), (lastName || '').trim()]);

      await client.query(
        `INSERT INTO user_tenants (user_id, tenant_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, tenant_id) DO NOTHING`,
        [rows[0].id, clinicId, roleId]
      );

      await client.query('COMMIT');

      sendWelcomeEmail({
        to:        rows[0].email,
        firstName: rows[0].first_name,
        clinicName,
        password:  tempPassword,
        loginUrl:  process.env.APP_URL || 'http://localhost:3000',
      }).catch(err => console.error('[Email] Welcome email failed:', err.message));

      return res.status(201).json({
        staff: {
          id:          rows[0].id,
          email:       rows[0].email,
          firstName:   rows[0].first_name,
          lastName:    rows[0].last_name,
          role:        roleName,
          roleId:      rows[0].role_id,
          isActive:    rows[0].is_active,
          lastLoginAt: null,
          createdAt:   rows[0].created_at,
        },
        password: tempPassword,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Clinics] POST /:id/staff error:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'A user with that email already exists in this clinic' });
    res.status(500).json({ error: 'Failed to add staff member' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/clinics/:id/staff/:uid  — update staff role
// ---------------------------------------------------------------------------
router.put('/:id/staff/:uid', requireClinicAdmin, async (req, res) => {
  const { id: clinicId, uid } = req.params;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { role } = req.body;
  const roleId = ROLE_IDS[role];
  if (!roleId) return res.status(400).json({ error: 'Invalid role' });

  try {
    const { rows } = await pool.query(`
      UPDATE users SET role_id = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
      RETURNING id, email, first_name, last_name, role_id, is_active, last_login_at, created_at
    `, [roleId, uid, clinicId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
    const { rows: roleRows } = await pool.query('SELECT name FROM roles WHERE id = $1', [roleId]);
    res.json({
      staff: {
        id: rows[0].id, email: rows[0].email,
        firstName: rows[0].first_name, lastName: rows[0].last_name,
        role: roleRows[0]?.name || role, roleId: rows[0].role_id,
        isActive: rows[0].is_active, lastLoginAt: rows[0].last_login_at, createdAt: rows[0].created_at,
      },
    });
  } catch (err) {
    console.error('[Clinics] PUT /:id/staff/:uid error:', err.message);
    res.status(500).json({ error: 'Failed to update staff role' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/clinics/:id/staff/:uid  — edit staff details (name, email, phone, role)
// ---------------------------------------------------------------------------
router.patch('/:id/staff/:uid', requireClinicAdmin, async (req, res) => {
  const { id: clinicId, uid } = req.params;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { firstName, lastName, email, phone, role } = req.body;

  // Build dynamic SET clause
  const sets   = [];
  const params = [];
  let   idx    = 1;

  if (firstName?.trim()) { sets.push(`first_name = $${idx++}`); params.push(firstName.trim()); }
  if (lastName !== undefined) { sets.push(`last_name = $${idx++}`);  params.push((lastName || '').trim()); }
  if (email?.trim())     { sets.push(`email = $${idx++}`);      params.push(email.trim().toLowerCase()); }
  if (phone !== undefined) { sets.push(`phone = $${idx++}`);    params.push(phone?.trim() || null); }

  if (role) {
    const roleId = ROLE_IDS[role];
    if (!roleId) return res.status(400).json({ error: 'Invalid role' });
    sets.push(`role_id = $${idx++}`);
    params.push(roleId);
  }

  if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  sets.push(`updated_at = NOW()`);
  params.push(uid, clinicId);

  try {
    const { rows } = await pool.query(`
      UPDATE users SET ${sets.join(', ')}
      WHERE id = $${idx++} AND tenant_id = $${idx++} AND deleted_at IS NULL
      RETURNING id, email, first_name, last_name, phone, role_id, is_active, last_login_at, created_at
    `, params);

    if (rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    const { rows: roleRows } = await pool.query('SELECT name FROM roles WHERE id = $1', [rows[0].role_id]);
    return res.json({
      staff: {
        id:          rows[0].id,
        email:       rows[0].email,
        firstName:   rows[0].first_name,
        lastName:    rows[0].last_name,
        phone:       rows[0].phone || null,
        role:        roleRows[0]?.name || role,
        roleId:      rows[0].role_id,
        isActive:    rows[0].is_active,
        lastLoginAt: rows[0].last_login_at,
        createdAt:   rows[0].created_at,
      },
    });
  } catch (err) {
    console.error('[Clinics] PATCH /:id/staff/:uid error:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'That email is already in use.' });
    return res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/clinics/:id/staff/:uid  — remove staff member (soft delete)
// ---------------------------------------------------------------------------
router.delete('/:id/staff/:uid', requireClinicAdmin, async (req, res) => {
  const { id: clinicId, uid } = req.params;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // Prevent self-deletion
  if (req.user.sub === uid) return res.status(400).json({ error: 'Cannot remove yourself' });

  try {
    const { rows } = await pool.query(`
      UPDATE users SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      RETURNING id, email
    `, [uid, clinicId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ success: true, removed: rows[0] });
  } catch (err) {
    console.error('[Clinics] DELETE /:id/staff/:uid error:', err.message);
    res.status(500).json({ error: 'Failed to remove staff member' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/clinics/:id/staff/:uid/reset-password  — generate + email new password
// ---------------------------------------------------------------------------
router.post('/:id/staff/:uid/reset-password', requireClinicAdmin, async (req, res) => {
  const { id: clinicId, uid } = req.params;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { rows: userRows } = await pool.query(`
      SELECT u.email, u.first_name, t.name AS clinic_name
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL
    `, [uid, clinicId]);
    if (userRows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    const newPassword = 'CareNova' + Math.floor(100000 + Math.random() * 900000) + '!';
    const hash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, uid]
    );

    console.log(`[Email] Sending reset to: ${userRows[0].email}`);
    sendPasswordResetEmail({
      to:         userRows[0].email,
      firstName:  userRows[0].first_name,
      clinicName: userRows[0].clinic_name,
      newPassword,
      loginUrl:   process.env.APP_URL || 'http://localhost:3000',
    }).catch(err => console.error('[Email] Password reset email failed:', err.message));

    console.log(`[Clinics] Password reset for user ${uid} in clinic ${clinicId}`);
    res.json({ success: true, email: userRows[0].email });
  } catch (err) {
    console.error('[Clinics] POST /:id/staff/:uid/reset-password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/clinics/:id/staff/:uid/toggle-active  — block / unblock staff
// ---------------------------------------------------------------------------
router.patch('/:id/staff/:uid/toggle-active', requireClinicAdmin, async (req, res) => {
  const { id: clinicId, uid } = req.params;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (req.user.sub === uid) return res.status(400).json({ error: 'Cannot block yourself' });

  try {
    const { rows } = await pool.query(`
      UPDATE users SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      RETURNING id, email, first_name, last_name, phone, role_id, is_active, last_login_at, created_at
    `, [uid, clinicId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    const { rows: roleRows } = await pool.query('SELECT name FROM roles WHERE id = $1', [rows[0].role_id]);
    console.log(`[Clinics] toggle-active: user ${uid}, new isActive=${rows[0].is_active}`);
    res.json({
      staff: {
        id:          rows[0].id,
        email:       rows[0].email,
        firstName:   rows[0].first_name,
        lastName:    rows[0].last_name,
        phone:       rows[0].phone || null,
        role:        roleRows[0]?.name || '',
        roleId:      rows[0].role_id,
        isActive:    rows[0].is_active,
        lastLoginAt: rows[0].last_login_at,
        createdAt:   rows[0].created_at,
      },
    });
  } catch (err) {
    console.error('[Clinics] PATCH /:id/staff/:uid/toggle-active error:', err.message);
    res.status(500).json({ error: 'Failed to toggle staff status' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/clinics/:id/quota  — update AI quota settings (super_admin only)
// ---------------------------------------------------------------------------
router.patch('/:id/quota', requireSuperAdmin, async (req, res) => {
  const clinicId = req.params.id;
  const { monthlyLimit, overagePolicy } = req.body;

  const validPolicies = ['block', 'notify', 'allow'];
  if (overagePolicy && !validPolicies.includes(overagePolicy)) {
    return res.status(400).json({ error: 'overagePolicy must be block | notify | allow' });
  }
  if (monthlyLimit !== undefined && (isNaN(monthlyLimit) || monthlyLimit < 0)) {
    return res.status(400).json({ error: 'monthlyLimit must be a non-negative integer' });
  }

  try {
    const { rows } = await pool.query(`
      UPDATE tenants SET
        ai_monthly_limit  = COALESCE($2, ai_monthly_limit),
        ai_overage_policy = COALESCE($3, ai_overage_policy),
        updated_at        = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, ai_monthly_limit, ai_overage_policy
    `, [clinicId, monthlyLimit ?? null, overagePolicy ?? null]);

    if (rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
    res.json({
      aiMonthlyLimit:  parseInt(rows[0].ai_monthly_limit, 10),
      aiOveragePolicy: rows[0].ai_overage_policy,
    });
  } catch (err) {
    console.error('[Clinics] PATCH /:id/quota error:', err.message);
    res.status(500).json({ error: 'Failed to update quota' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/clinics/:id/ai-usage  — AI usage stats for a clinic
// ---------------------------------------------------------------------------
router.get('/:id/ai-usage', async (req, res) => {
  const clinicId = req.params.id;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const now = new Date();

    // Parse optional ?month=YYYY-MM selector
    let targetYear  = now.getFullYear();
    let targetMonth = now.getMonth(); // 0-based
    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      const [y, m] = req.query.month.split('-').map(Number);
      targetYear  = y;
      targetMonth = m - 1; // convert to 0-based
    }

    const thisMonthStart = new Date(targetYear, targetMonth, 1);
    const lastMonthStart = new Date(targetYear, targetMonth - 1, 1);
    const lastMonthEnd   = thisMonthStart;
    const thirtyDaysAgo  = new Date(thisMonthStart); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const twelveWeeksAgo = new Date(thisMonthStart); twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    // ── Monthly message counts ──────────────────────────────────────────────
    const [{ rows: thisMonthRows }, { rows: lastMonthRows }] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS cnt FROM messages
         WHERE tenant_id = $1 AND direction = 'outbound' AND ai_generated = TRUE
           AND created_at >= $2`,
        [clinicId, thisMonthStart.toISOString()]
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM messages
         WHERE tenant_id = $1 AND direction = 'outbound' AND ai_generated = TRUE
           AND created_at >= $2 AND created_at < $3`,
        [clinicId, lastMonthStart.toISOString(), lastMonthEnd.toISOString()]
      ),
    ]);

    const thisMonthMessages = parseInt(thisMonthRows[0]?.cnt || 0, 10);
    const lastMonthMessages = parseInt(lastMonthRows[0]?.cnt || 0, 10);
    const COST_PER_MSG = 0.003; // ~200 output tokens × $15/M

    // ── Top scenarios (last 30 days) ────────────────────────────────────────
    const { rows: scenarioRows } = await pool.query(
      `SELECT scenario_type, COUNT(*) AS cnt
       FROM messages
       WHERE tenant_id = $1 AND scenario_type IS NOT NULL AND created_at >= $2
       GROUP BY scenario_type ORDER BY cnt DESC LIMIT 5`,
      [clinicId, thirtyDaysAgo.toISOString()]
    );

    // ── Response time trend (last 30 days, daily avg) ───────────────────────
    const { rows: respTrendRows } = await pool.query(
      `SELECT
         DATE(fi.created_at) AS day,
         AVG(EXTRACT(EPOCH FROM (fo.created_at - fi.created_at))) AS avg_secs
       FROM (
         SELECT DISTINCT ON (lead_id) lead_id, created_at
         FROM messages WHERE tenant_id = $1 AND direction = 'inbound' AND created_at >= $2
         ORDER BY lead_id, created_at ASC
       ) fi
       JOIN (
         SELECT DISTINCT ON (lead_id) lead_id, created_at
         FROM messages WHERE tenant_id = $1 AND direction = 'outbound' AND created_at >= $2
         ORDER BY lead_id, created_at ASC
       ) fo ON fo.lead_id = fi.lead_id
       WHERE fo.created_at > fi.created_at
       GROUP BY day ORDER BY day ASC`,
      [clinicId, thirtyDaysAgo.toISOString()]
    );

    // ── Language breakdown ──────────────────────────────────────────────────
    const { rows: langRows } = await pool.query(
      `SELECT l.language, COUNT(DISTINCT l.id) AS cnt
       FROM leads l
       JOIN messages m ON m.lead_id = l.id
         AND m.direction = 'outbound' AND m.ai_generated = TRUE
       WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
       GROUP BY l.language ORDER BY cnt DESC`,
      [clinicId]
    );

    // ── Lead recovery rate trend (last 12 weeks) ────────────────────────────
    const { rows: recoveryRows } = await pool.query(
      `SELECT
         DATE_TRUNC('week', l.created_at) AS week_start,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE l.status IN ('booked','attended','responded','qualified')) AS recovered
       FROM leads l
       WHERE l.tenant_id = $1 AND l.created_at >= $2 AND l.deleted_at IS NULL
       GROUP BY week_start ORDER BY week_start ASC`,
      [clinicId, twelveWeeksAgo.toISOString()]
    );

    res.json({
      month:       `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
      lastUpdated: new Date().toISOString(),
      thisMonth: {
        messages:      thisMonthMessages,
        estimatedCost: parseFloat((thisMonthMessages * COST_PER_MSG).toFixed(2)),
      },
      lastMonth: {
        messages:      lastMonthMessages,
        estimatedCost: parseFloat((lastMonthMessages * COST_PER_MSG).toFixed(2)),
      },
      topScenarios: scenarioRows.map(r => ({
        scenario: r.scenario_type,
        count:    parseInt(r.cnt, 10),
      })),
      responseTimeTrend: respTrendRows.map(r => ({
        date:    r.day,
        avgSecs: Math.round(parseFloat(r.avg_secs || 0)),
      })),
      languageBreakdown: langRows.map(r => ({
        language: r.language,
        count:    parseInt(r.cnt, 10),
      })),
      recoveryRateTrend: recoveryRows.map(r => {
        const total     = parseInt(r.total,     10);
        const recovered = parseInt(r.recovered, 10);
        return {
          weekStart: r.week_start,
          total,
          recovered,
          rate: total > 0 ? parseFloat((recovered / total * 100).toFixed(1)) : 0,
        };
      }),
    });
  } catch (err) {
    console.error('[Clinics] GET /:id/ai-usage error:', err.message);
    res.status(500).json({ error: 'Failed to fetch AI usage data' });
  }
});

// ─── POST /api/clinics/:id/send-message ───────────────────────────────────────
// Send a manual WhatsApp message from the clinic's own number via Meta Graph API.
// Body: { to, message, leadId }
router.post('/:id/send-message', requireClinicAdmin, async (req, res) => {
  const clinicId = req.params.id;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { to, message, leadId } = req.body;
  if (!to || !message?.trim()) {
    return res.status(400).json({ error: 'to and message are required' });
  }

  try {
    // 1. Get active WhatsApp config for this clinic; fall back to env vars
    const { rows: cfgRows } = await pool.query(`
      SELECT phone_number_id, access_token
      FROM whatsapp_configs
      WHERE tenant_id = $1 AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 1
    `, [clinicId]);

    const phoneNumberId = cfgRows[0]?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken   = cfgRows[0]?.access_token   || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      return res.status(400).json({ error: 'No WhatsApp configuration found for this clinic and no fallback env vars set' });
    }

    console.log(`[SendMessage] Using phone_number_id: ${phoneNumberId} (source: ${cfgRows[0] ? 'whatsapp_configs' : 'env'})`);

    // 2. Normalise recipient number to E.164
    const recipient = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`;

    // 3. Send via Meta Graph API
    const axios = require('axios');
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    const metaRes = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to:                recipient,
        type:              'text',
        text:              { preview_url: false, body: message.trim() },
      },
      {
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const waMessageId = metaRes.data?.messages?.[0]?.id || null;
    console.log(`[Clinics] Manual WA message sent to ${recipient} (waId=${waMessageId})`);

    // 4. Save to messages table if leadId provided
    if (leadId) {
      const leadStore = require('../services/leadStore');
      await leadStore.saveMessage({
        leadId,
        direction:         'outbound',
        content:           message.trim(),
        aiGenerated:       false,
        whatsappMessageId: waMessageId,
        status:            'sent',
      });
    }

    res.json({ success: true, whatsappMessageId: waMessageId });
  } catch (err) {
    const metaError = err.response?.data?.error?.message;
    console.error('[Clinics] send-message error:', metaError || err.message);
    res.status(502).json({ error: metaError || 'Failed to send WhatsApp message' });
  }
});

// ── Helper: call Meta Graph API ───────────────────────────────────────────────
function metaGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const url = `https://graph.facebook.com/v18.0/${path}?access_token=${encodeURIComponent(accessToken)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ─── POST /api/clinics/:id/whatsapp/test ──────────────────────────────────────
router.post('/:id/whatsapp/test', requireClinicAdmin, async (req, res) => {
  const clinicId = req.params.id;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { phoneNumberId, accessToken } = req.body;
  if (!phoneNumberId || !accessToken) {
    return res.status(400).json({ error: 'phoneNumberId and accessToken are required' });
  }

  try {
    const { status, body } = await metaGet(
      `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      accessToken,
    );

    if (status !== 200 || body.error) {
      const msg = body.error?.message || 'Invalid credentials';
      console.warn(`[Clinics] WhatsApp test failed for ${phoneNumberId}: ${msg}`);
      return res.json({ success: false, error: msg });
    }

    console.log(`[Clinics] WhatsApp test OK for ${phoneNumberId}: ${body.verified_name}`);
    res.json({
      success:     true,
      displayName: body.verified_name  || body.display_phone_number || phoneNumberId,
      phone:       body.display_phone_number || '',
    });
  } catch (err) {
    console.error('[Clinics] WhatsApp test error:', err.message);
    res.status(502).json({ error: 'Failed to reach Meta API' });
  }
});

// ─── POST /api/clinics/:id/whatsapp/connect ───────────────────────────────────
router.post('/:id/whatsapp/connect', requireClinicAdmin, async (req, res) => {
  const clinicId = req.params.id;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { phoneNumberId, accessToken, displayName, businessAccountId } = req.body;
  if (!phoneNumberId || !accessToken) {
    return res.status(400).json({ error: 'phoneNumberId and accessToken are required' });
  }

  const verifyToken   = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'carenova_webhook_2026';
  const finalDisplay  = displayName || 'WhatsApp Business';
  const finalWaba     = businessAccountId || '';

  try {
    const { rows } = await pool.query(`
      INSERT INTO whatsapp_configs
        (tenant_id, display_name, phone_number_id, business_account_id,
         access_token, webhook_verify_token, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      ON CONFLICT (tenant_id, phone_number_id)
      DO UPDATE SET
        display_name  = EXCLUDED.display_name,
        access_token  = EXCLUDED.access_token,
        is_active     = TRUE,
        updated_at    = NOW()
      RETURNING id, display_name, phone_number_id, is_active, created_at
    `, [clinicId, finalDisplay, phoneNumberId, finalWaba, accessToken, verifyToken]);

    console.log(`[Clinics] WhatsApp connected for clinic ${clinicId}: ${phoneNumberId}`);
    res.json({
      success: true,
      config: {
        id:            rows[0].id,
        displayName:   rows[0].display_name,
        phoneNumberId: rows[0].phone_number_id,
        isActive:      rows[0].is_active,
        createdAt:     rows[0].created_at,
      },
    });
  } catch (err) {
    console.error('[Clinics] WhatsApp connect error:', err.message);
    res.status(500).json({ error: 'Failed to save WhatsApp config' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/clinics/:id/widget-key  — return (or auto-generate) the public site_key
// Access: director, clinic_admin, super_admin
// ---------------------------------------------------------------------------
router.get('/:id/widget-key', requireClinicAdmin, async (req, res) => {
  const clinicId = req.params.id;
  if (!isSuperAdmin(req) && req.user.tenantId !== clinicId) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT widget_site_key FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
      [clinicId],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Clinic not found.' });

    let siteKey = rows[0].widget_site_key;

    if (!siteKey) {
      siteKey = `cd_site_${crypto.randomBytes(16).toString('hex')}`;
      // WHERE IS NULL is a race guard — if two requests arrive simultaneously only one writes
      await pool.query(
        `UPDATE tenants SET widget_site_key = $1 WHERE id = $2 AND widget_site_key IS NULL`,
        [siteKey, clinicId],
      );
      // Re-read the winner (may differ from what we generated if a concurrent request beat us)
      const { rows: r2 } = await pool.query(
        `SELECT widget_site_key FROM tenants WHERE id = $1`,
        [clinicId],
      );
      siteKey = r2[0].widget_site_key;
    }

    return res.json({ siteKey });
  } catch (err) {
    console.error('[Clinics] widget-key error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve widget key.' });
  }
});

module.exports = router;
