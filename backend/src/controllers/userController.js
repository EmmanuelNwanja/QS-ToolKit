const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// ─── Force change password after OTP login ───────────────────
exports.forceChangePassword = async (req, res, next) => {
  try {
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!req.user?.force_password_change) {
      return res.status(400).json(error('Password change is not currently required for this account.'));
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json(error('New password must be at least 8 characters'));
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json(error('Password confirmation does not match'));
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        force_password_change: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) throw new Error(updateError.message);

    return res.json(success('Password changed successfully. You can continue using your account.'));
  } catch (err) {
    next(err);
  }
};

// ─── Change password (authenticated, from settings) ───────────
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json(error('Current password and new password are required'));
    }

    if (new_password.length < 8) {
      return res.status(400).json(error('New password must be at least 8 characters'));
    }

    if (current_password === new_password) {
      return res.status(400).json(error('New password must be different from current password'));
    }

    // Verify current password against Supabase Auth
    const { data: authUser } = await supabase.auth.admin.getUserById(req.user.supabase_auth_id);
    if (!authUser?.user?.email) {
      return res.status(500).json(error('Could not verify current password'));
    }

    // Use Supabase signInWithPassword to verify the current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: authUser.user.email,
      password: current_password
    });

    if (signInErr) {
      return res.status(400).json(error('Current password is incorrect'));
    }

    // Update to new password
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      req.user.supabase_auth_id,
      { password: new_password }
    );

    if (updateErr) {
      logger.error('Password change failed:', updateErr.message);
      return res.status(500).json(error('Could not change password'));
    }

    // Update local password_hash
    const passwordHash = await bcrypt.hash(new_password, 12);
    await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    return res.json(success('Password changed successfully'));
  } catch (err) {
    next(err);
  }
};

// ─── Get profile ──────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*, subscription_plans(*), branding_settings(*), organizations(*)')
      .eq('id', req.user.id)
      .single();

    const { password_hash, ...safe } = user;
    return res.json(success('Profile', { user: safe }));
  } catch (err) { next(err); }
};

// ─── Update profile ───────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'company_name', 'qs_cert_no', 'company_address', 'university_name'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date();

    const { data } = await supabase.from('users').update(updates).eq('id', req.user.id).select('*, subscription_plans(*)').single();
    const { password_hash, ...safe } = data;
    return res.json(success('Profile updated', { user: safe }));
  } catch (err) { next(err); }
};

// ─── Update branding ──────────────────────────────────────────
exports.updateBranding = async (req, res, next) => {
  try {
    const { brand_name, company_details, contact_info, primary_color, secondary_color } = req.body;

    const { data } = await supabase
      .from('branding_settings')
      .upsert({
        user_id: req.user.id,
        brand_name, company_details, contact_info,
        primary_color, secondary_color,
        updated_at: new Date()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    return res.json(success('Branding updated', { branding: data }));
  } catch (err) { next(err); }
};

// ─── Upload branding asset (logo / signature) ─────────────────
exports.uploadBrandingAsset = async (req, res, next) => {
  try {
    const { asset_type } = req.params;  // 'logo' | 'signature'
    if (!['logo', 'signature'].includes(asset_type)) {
      return res.status(400).json(error('Invalid asset type'));
    }

    if (!req.file) return res.status(400).json(error('No file uploaded'));

    const ext = req.file.originalname.split('.').pop();
    const path = `${req.user.id}/${asset_type}.${ext}`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('branding')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(path);

    const field = asset_type === 'logo' ? 'logo_url' : 'signature_url';
    await supabase.from('branding_settings')
      .upsert({ user_id: req.user.id, [field]: publicUrl }, { onConflict: 'user_id' });

    return res.json(success(`${asset_type} uploaded`, { url: publicUrl }));
  } catch (err) { next(err); }
};

// ─── Get organisation team ────────────────────────────────────
exports.getTeam = async (req, res, next) => {
  try {
    if (!req.user.organization_id) return res.status(404).json(error('No organization found'));

    const { data: members } = await supabase
      .from('users')
      .select('id, name, email, org_role, created_at')
      .eq('organization_id', req.user.organization_id)
      .order('org_role');

    const { data: pendingInvites } = await supabase
      .from('invitations')
      .select('id, email, role, created_at, expires_at, accepted')
      .eq('organization_id', req.user.organization_id)
      .eq('accepted', false);

    return res.json(success('Team members', { members, pending_invites: pendingInvites }));
  } catch (err) { next(err); }
};

// ─── Invite team member ───────────────────────────────────────
exports.inviteMember = async (req, res, next) => {
  try {
    const { email, role = 'manager' } = req.body;

    // Only super_admin and admin can invite
    if (!['super_admin', 'admin'].includes(req.user.org_role)) {
      return res.status(403).json(error('Only admins can invite members'));
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase.from('invitations').insert({
      organization_id: req.user.organization_id,
      invited_by: req.user.id,
      email,
      role,
      token,
      expires_at: expiresAt.toISOString()
    });

    const inviteUrl = `${process.env.FRONTEND_URL}/join/${token}`;
    await emailService.sendInvite(email, inviteUrl, role);

    return res.json(success('Invitation sent', { invite_url: inviteUrl }));
  } catch (err) { next(err); }
};

// ─── Accept invitation ────────────────────────────────────────
exports.acceptInvite = async (req, res, next) => {
  try {
    const { token } = req.params;

    const { data: invite } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('accepted', false)
      .single();

    if (!invite) return res.status(404).json(error('Invalid or expired invitation'));
    if (new Date(invite.expires_at) < new Date()) return res.status(410).json(error('Invitation expired'));

    // Update user
    await supabase.from('users').update({
      organization_id: invite.organization_id,
      org_role: invite.role
    }).eq('id', req.user.id);

    // Mark invite accepted
    await supabase.from('invitations').update({ accepted: true }).eq('id', invite.id);

    return res.json(success('Joined organization'));
  } catch (err) { next(err); }
};

// ─── Remove team member ───────────────────────────────────────
exports.removeMember = async (req, res, next) => {
  try {
    if (!['super_admin', 'admin'].includes(req.user.org_role)) {
      return res.status(403).json(error('Only admins can remove members'));
    }

    await supabase.from('users')
      .update({ organization_id: null, org_role: 'member' })
      .eq('id', req.params.memberId)
      .eq('organization_id', req.user.organization_id);

    return res.json(success('Member removed from organization'));
  } catch (err) { next(err); }
};

// ─── Update member role ───────────────────────────────────────
exports.updateMemberRole = async (req, res, next) => {
  try {
    if (req.user.org_role !== 'super_admin') {
      return res.status(403).json(error('Only super admins can change roles'));
    }

    const { role } = req.body;
    if (!['admin', 'manager', 'member'].includes(role)) {
      return res.status(400).json(error('Invalid role'));
    }

    await supabase.from('users')
      .update({ org_role: role })
      .eq('id', req.params.memberId)
      .eq('organization_id', req.user.organization_id);

    return res.json(success('Role updated'));
  } catch (err) { next(err); }
};

// ─── Calculator usage summary ─────────────────────────────────
exports.usageSummary = async (req, res, next) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: plan } = await supabase
      .from('users')
      .select('subscription_plans(max_calculator_uses, max_projects, name)')
      .eq('id', req.user.id)
      .single();

    const { count: calcUsed } = await supabase
      .from('calculator_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .gte('used_at', startOfMonth.toISOString());

    const { count: projectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    return res.json(success('Usage summary', {
      plan: plan?.subscription_plans?.name,
      calculator: {
        used_this_month: calcUsed,
        limit: plan?.subscription_plans?.max_calculator_uses
      },
      projects: {
        used: projectCount,
        limit: plan?.subscription_plans?.max_projects
      }
    }));
  } catch (err) { next(err); }
};

// ─── Hibernate account ───────────────────────────────────────
exports.hibernateAccount = async (req, res, next) => {
  try {
    const nowIso = new Date().toISOString();

    const { error: dbError } = await supabase
      .from('users')
      .update({
        account_status: 'hibernated',
        account_hibernated_at: nowIso,
        auto_renew: false,
        updated_at: nowIso
      })
      .eq('id', req.user.id);

    if (dbError) throw new Error(dbError.message);

    // Stop push notifications for a hibernated account
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', req.user.id);

    return res.json(success('Account hibernated'));
  } catch (err) { next(err); }
};

// ─── Soft delete account ─────────────────────────────────────
exports.deleteAccount = async (req, res, next) => {
  try {
    const nowIso = new Date().toISOString();
    const tombstoneEmail = `deleted+${req.user.id}@deleted.local`;

    const { error: dbError } = await supabase
      .from('users')
      .update({
        account_status: 'deleted',
        deleted_at: nowIso,
        auto_renew: false,
        subscription_status: 'inactive',
        plan_id: null,
        organization_id: null,
        org_role: 'member',
        name: 'Deleted User',
        phone: null,
        company_name: null,
        company_address: null,
        qs_cert_no: null,
        university_name: null,
        email: tombstoneEmail,
        updated_at: nowIso
      })
      .eq('id', req.user.id);

    if (dbError) throw new Error(dbError.message);

    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', req.user.id);

    return res.json(success('Account deleted successfully'));
  } catch (err) { next(err); }
};
