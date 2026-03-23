const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const emailService = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

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

    const { data } = await supabase.from('users').update(updates).eq('id', req.user.id).select().single();
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

    const token = uuidv4();
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
