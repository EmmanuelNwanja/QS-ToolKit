const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const emailService = require('../services/emailService');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

const VERIFICATION_TOKEN_TTL_MINUTES = 30;
const VERIFICATION_RESEND_COOLDOWN_SECONDS = 90;
const MAX_SIGNUPS_PER_IP_PREFIX_PER_DAY = 5;
const MAX_SIGNUPS_PER_DEVICE_PER_30_DAYS = 2;

// ── Register ──────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const {
      user_type, name, email, phone, password,
      university_name, company_name, qs_cert_no,
      company_address, business_reg_no
    } = req.body;

    const normalizedEmail = String(email || '').toLowerCase().trim();
    const deviceId = getDeviceId(req);
    const ipPrefix = getIpPrefix(req);

    if (!deviceId) {
      return res.status(400).json(error('Device ID is required for registration'));
    }

    const emailDomain = normalizedEmail.split('@')[1] || '';
    if (isDisposableDomain(emailDomain)) {
      return res.status(400).json(error('Disposable email domains are not allowed'));
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) return res.status(409).json(error('Email already registered'));

    const deviceHash = hashValue(deviceId);
    const emailHash = hashValue(normalizedEmail);

    // Phase 2 anti-abuse controls for free/student entry point
    const [deviceRows, ipRows] = await Promise.all([
      supabase
        .from('signup_identity_signals')
        .select('user_id')
        .eq('device_id_hash', deviceHash)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('signup_identity_signals')
        .select('id', { count: 'exact' })
        .eq('ip_prefix', ipPrefix)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    ]);

    if (deviceRows.error || ipRows.error) {
      throw new Error('Identity controls are not available. Run migration 009_auth_verification_and_identity_controls.sql');
    }

    const uniqueUsersFromDevice = new Set((deviceRows.data || []).map((row) => row.user_id).filter(Boolean)).size;
    if (uniqueUsersFromDevice >= MAX_SIGNUPS_PER_DEVICE_PER_30_DAYS) {
      return res.status(429).json(error(
        'Too many accounts have been created from this device recently. Please use an existing account or contact support.',
        { code: 'DEVICE_SIGNUP_LIMIT', window_days: 30 }
      ));
    }

    if ((ipRows.count || 0) >= MAX_SIGNUPS_PER_IP_PREFIX_PER_DAY) {
      return res.status(429).json(error(
        'Too many signups from your network in the last 24 hours. Please try again later.',
        { code: 'NETWORK_SIGNUP_LIMIT', window_hours: 24 }
      ));
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Get free plan
    const { data: freePlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', 'free')
      .single();

    // Register with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false
    });

    if (authError) throw new Error(authError.message);

    // Create user record
    const { data: user, error: dbError } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: authData.user.id,
        user_type,
        name,
        email: normalizedEmail,
        phone,
        password_hash,
        university_name,
        company_name,
        qs_cert_no,
        company_address,
        plan_id: freePlan?.id,
        subscription_status: 'inactive'
      })
      .select('*, subscription_plans(*)')
      .single();

    if (dbError) throw new Error(dbError.message);

    // Create empty branding record
    await supabase.from('branding_settings').insert({ user_id: user.id });

    // Record signup identity binding for abuse analysis
    const { error: signalError } = await supabase.from('signup_identity_signals').insert({
      user_id: user.id,
      email: normalizedEmail,
      email_hash: emailHash,
      device_id_hash: deviceHash,
      ip_prefix: ipPrefix,
      user_agent: req.get('user-agent') || null,
      decision: 'allow',
      reason: 'register'
    });

    if (signalError) throw new Error(signalError.message);

    const verificationToken = await createEmailVerificationToken(user.id, req);
    const verificationSent = await emailService.sendEmailVerification(user, verificationToken);

    if (!verificationSent) {
      logger.error({
        message: 'Registration completed but verification email failed',
        user_id: user.id,
        email: user.email
      });
      return res.status(201).json(success('Registration successful, but we could not send your verification email right now. Please use "Resend verification" on login in a few minutes.', {
        requires_verification: true,
        email: normalizedEmail,
        email_delivery_failed: true
      }));
    }

    return res.status(201).json(success('Registration successful. Verify your email to activate your account.', {
      requires_verification: true,
      email: normalizedEmail
    }));
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').toLowerCase().trim();

    const { data: user } = await supabase
      .from('users')
      .select('*, subscription_plans(*)')
      .eq('email', normalizedEmail)
      .single();

    if (!user) return res.status(401).json(error('Invalid email or password'));

    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) return res.status(401).json(error('Invalid email or password'));

    if (!user.is_verified) {
      return res.status(403).json(error('Please verify your email before signing in.', {
        code: 'EMAIL_NOT_VERIFIED',
        email: normalizedEmail,
        can_resend: true
      }));
    }

    // Check if user is a platform admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, admin_role, permissions')
      .eq('user_id', user.id)
      .single();

    const token = generateToken(user);
    const sanitized = sanitizeUser(user);

    // Include admin info if user is an admin
    if (adminUser) {
      sanitized.is_admin = true;
      sanitized.admin_role = adminUser.admin_role;
      sanitized.permissions = adminUser.permissions;
    }

    return res.json(success('Login successful', {
      token,
      user: sanitized
    }));
  } catch (err) {
    next(err);
  }
};

// ── Google OAuth callback ─────────────────────────────────────
exports.googleCallback = async (req, res, next) => {
  try {
    const { access_token } = req.body;

    // Verify Google token with Supabase
    const { data: { user: supaUser }, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !supaUser) return res.status(401).json(error('Invalid Google token'));

    // Find or create user
    let { data: user } = await supabase
      .from('users')
      .select('*, subscription_plans(*)')
      .eq('email', supaUser.email)
      .single();

    if (!user) {
      const { data: freePlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', 'free')
        .single();

      const { data: newUser } = await supabase
        .from('users')
        .insert({
          supabase_auth_id: supaUser.id,
          user_type: 'professional',
          name: supaUser.user_metadata?.full_name || supaUser.email.split('@')[0],
          email: supaUser.email,
          google_id: supaUser.id,
          plan_id: freePlan?.id,
          onboarding_completed: false,
          is_verified: true
        })
        .select('*, subscription_plans(*)')
        .single();

      user = newUser;
      await supabase.from('branding_settings').insert({ user_id: user.id });
    } else if (!user.is_verified) {
      // Google auth already proves email ownership
      const { data: updatedUser } = await supabase
        .from('users')
        .update({ is_verified: true, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('*, subscription_plans(*)')
        .single();
      user = updatedUser || user;
    }

    // Check if user is a platform admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, admin_role, permissions')
      .eq('user_id', user.id)
      .single();

    const token = generateToken(user);
    const sanitized = sanitizeUser(user);

    // Include admin info if user is an admin
    if (adminUser) {
      sanitized.is_admin = true;
      sanitized.admin_role = adminUser.admin_role;
      sanitized.permissions = adminUser.permissions;
    }

    return res.json(success('Google login successful', {
      token,
      user: sanitized,
      needs_onboarding: !user.onboarding_completed
    }));
  } catch (err) {
    next(err);
  }
};

// ── Complete Onboarding ───────────────────────────────────────
exports.completeOnboarding = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updates = { ...req.body, onboarding_completed: true };

    const { data: user } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*, subscription_plans(*)')
      .single();

    return res.json(success('Onboarding complete', { user: sanitizeUser(user) }));
  } catch (err) {
    next(err);
  }
};

// ── Get current user ──────────────────────────────────────────
exports.me = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*, subscription_plans(*), branding_settings(*)')
      .eq('id', req.user.id)
      .single();

    // Check if user is a platform admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, admin_role, permissions')
      .eq('user_id', req.user.id)
      .single();

    const sanitized = sanitizeUser(user);

    // Include admin info if user is an admin
    if (adminUser) {
      sanitized.is_admin = true;
      sanitized.admin_role = adminUser.admin_role;
      sanitized.permissions = adminUser.permissions;
    }

    return res.json(success('User profile', { user: sanitized }));
  } catch (err) {
    next(err);
  }
};

// ── Verify email token ────────────────────────────────────────
exports.verifyEmail = async (req, res, next) => {
  try {
    const token = String(req.body?.token || req.query?.token || '').trim();
    if (!token) return res.status(400).json(error('Verification token is required'));

    const tokenHash = hashValue(token);

    const { data: tokenRow } = await supabase
      .from('email_verification_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .single();

    if (!tokenRow) {
      return res.status(400).json(error('Invalid verification token'));
    }

    if (tokenRow.used_at) {
      return res.status(400).json(error('Verification token has already been used'));
    }

    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json(error('Verification token has expired'));
    }

    await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id);

    const { data: user } = await supabase
      .from('users')
      .update({ is_verified: true, updated_at: new Date().toISOString() })
      .eq('id', tokenRow.user_id)
      .select('*')
      .single();

    if (user) {
      const welcomeSent = await emailService.sendWelcome(user);
      if (!welcomeSent) {
        logger.warn({
          message: 'Welcome email failed after successful verification',
          user_id: user.id,
          email: user.email
        });
      }
    }

    return res.json(success('Email verified successfully. You can now sign in.'));
  } catch (err) {
    next(err);
  }
};

// ── Resend email verification ────────────────────────────────
exports.resendVerification = async (req, res, next) => {
  try {
    const normalizedEmail = String(req.body?.email || '').toLowerCase().trim();
    if (!normalizedEmail) return res.status(400).json(error('Email is required'));

    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, is_verified')
      .eq('email', normalizedEmail)
      .single();

    // Return generic message to prevent account enumeration
    if (!user) {
      return res.json(success('If your account exists, a verification email has been sent.'));
    }

    if (user.is_verified) {
      return res.json(success('This email is already verified.'));
    }

    const { data: latestToken } = await supabase
      .from('email_verification_tokens')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestToken) {
      const elapsed = Date.now() - new Date(latestToken.created_at).getTime();
      if (elapsed < VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000) {
        return res.status(429).json(error('Please wait before requesting another verification email.', {
          code: 'VERIFICATION_RESEND_COOLDOWN',
          retry_after_seconds: Math.ceil((VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000 - elapsed) / 1000)
        }));
      }
    }

    const verificationToken = await createEmailVerificationToken(user.id, req);
    const verificationSent = await emailService.sendEmailVerification(user, verificationToken);

    if (!verificationSent) {
      logger.error({
        message: 'Resend verification failed',
        user_id: user.id,
        email: user.email
      });
      return res.status(502).json(error('We could not send the verification email right now. Please try again shortly.'));
    }

    return res.json(success('Verification email sent.'));
  } catch (err) {
    next(err);
  }
};

// ── Helpers ───────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, user_type: user.user_type },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

async function createEmailVerificationToken(userId, req) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashValue(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: tokenError } = await supabase
    .from('email_verification_tokens')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      ip_address: getClientIp(req),
      user_agent: req.get('user-agent') || null
    });

  if (tokenError) {
    logger.error('Failed to create verification token:', tokenError.message);
    throw new Error('Unable to create email verification token');
  }

  return rawToken;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getDeviceId(req) {
  const fromHeader = req.get('x-device-id');
  const fromBody = req.body?.device_id;
  const deviceId = String(fromHeader || fromBody || '').trim();
  if (!deviceId || deviceId.length < 12 || deviceId.length > 200) return null;
  return deviceId;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function getIpPrefix(req) {
  const ip = getClientIp(req).replace('::ffff:', '');
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return `${parts.slice(0, 4).join(':')}::/64`;
  }
  return 'unknown';
}

function isDisposableDomain(domain) {
  const blocked = new Set([
    'mailinator.com',
    'guerrillamail.com',
    'tempmail.com',
    '10minutemail.com',
    'yopmail.com',
    'throwawaymail.com',
    'trashmail.com'
  ]);
  return blocked.has(String(domain || '').toLowerCase());
}
