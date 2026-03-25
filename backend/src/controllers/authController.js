const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const emailService = require('../services/emailService');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

// ── Register ──────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const {
      user_type, name, email, phone, password,
      university_name, company_name, qs_cert_no,
      company_address, business_reg_no
    } = req.body;

    // Check duplicate
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) return res.status(409).json(error('Email already registered'));

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
      email: email.toLowerCase(),
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
        email: email.toLowerCase(),
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

    // Send welcome email
    await emailService.sendWelcome(user);

    const token = generateToken(user);

    return res.status(201).json(success('Registration successful', {
      token,
      user: sanitizeUser(user)
    }));
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('*, subscription_plans(*)')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) return res.status(401).json(error('Invalid email or password'));

    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) return res.status(401).json(error('Invalid email or password'));

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
          onboarding_completed: false
        })
        .select('*, subscription_plans(*)')
        .single();

      user = newUser;
      await supabase.from('branding_settings').insert({ user_id: user.id });
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
