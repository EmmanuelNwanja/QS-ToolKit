const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const emailService = require('../services/emailService');

// ─── Create feedback link (surveyor creates for a project) ────
exports.createLink = async (req, res, next) => {
  try {
    const { project_id, client_name, client_email, message, expires_days = 30 } = req.body;

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects').select('id, title, client_name').eq('id', project_id).eq('user_id', req.user.id).single();

    if (!project) return res.status(404).json(error('Project not found'));

    const token = uuidv4().replace(/-/g, '');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_days);

    const { data: link, error: linkErr } = await supabase
      .from('feedback_links')
      .insert({
        user_id: req.user.id,
        project_id,
        token,
        client_name: client_name || project.client_name,
        client_email,
        message,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (linkErr) throw linkErr;

    const feedbackUrl = `${process.env.FRONTEND_URL}/feedback/${token}`;

    // Optionally send email to client
    if (client_email) {
      const { data: user } = await supabase.from('users').select('name, company_name').eq('id', req.user.id).single();
      await emailService.sendFeedbackRequest(client_email, client_name, feedbackUrl, project.title, user, message);
    }

    return res.status(201).json(success('Feedback link created', {
      link: { ...link, feedback_url: feedbackUrl }
    }));
  } catch (err) { next(err); }
};

// ─── Get all feedback links for a user ───────────────────────
exports.myLinks = async (req, res, next) => {
  try {
    const { data, error: err } = await supabase
      .from('feedback_links')
      .select('*, projects(title, client_name), feedback_responses(rating, submitted_at)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (err) throw err;
    return res.json(success('Feedback links', { links: data }));
  } catch (err) { next(err); }
};

// ─── Public: get feedback form by token ──────────────────────
exports.getByToken = async (req, res, next) => {
  try {
    const { data: link } = await supabase
      .from('feedback_links')
      .select('*, projects(title, location), users(name, company_name)')
      .eq('token', req.params.token)
      .eq('is_active', true)
      .single();

    if (!link) return res.status(404).json(error('Feedback link not found or expired'));

    // Check expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json(error('This feedback link has expired'));
    }

    // Check if already submitted from this IP
    const { data: existing } = await supabase
      .from('feedback_responses')
      .select('id')
      .eq('feedback_link_id', link.id)
      .eq('ip_address', req.ip)
      .single();

    return res.json(success('Feedback form', {
      link: {
        project_title: link.projects?.title,
        project_location: link.projects?.location,
        surveyor_name: link.users?.name,
        company_name: link.users?.company_name,
        message: link.message,
        client_name: link.client_name
      },
      already_submitted: !!existing
    }));
  } catch (err) { next(err); }
};

// ─── Public: submit feedback ─────────────────────────────────
exports.submit = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { rating, quality_score, timeliness_score, communication_score, comment, client_name } = req.body;

    const { data: link } = await supabase
      .from('feedback_links')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (!link) return res.status(404).json(error('Invalid feedback link'));
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json(error('Feedback link has expired'));
    }

    // Prevent duplicate from same IP
    const { data: existing } = await supabase
      .from('feedback_responses')
      .select('id')
      .eq('feedback_link_id', link.id)
      .eq('ip_address', req.ip)
      .single();

    if (existing) return res.status(409).json(error('You have already submitted feedback for this project'));

    await supabase.from('feedback_responses').insert({
      feedback_link_id: link.id,
      user_id: link.user_id,
      project_id: link.project_id,
      rating,
      quality_score,
      timeliness_score,
      communication_score,
      comment,
      client_name: client_name || link.client_name,
      ip_address: req.ip
    });

    // Notify surveyor
    const { data: surveyor } = await supabase.from('users').select('email, name').eq('id', link.user_id).single();
    if (surveyor) {
      await emailService.notifyNewFeedback(surveyor, rating);
    }

    // Refresh leaderboard
    await supabase.rpc('refresh_leaderboard');

    return res.json(success('Thank you! Your feedback has been submitted.'));
  } catch (err) { next(err); }
};

// ─── Deactivate a feedback link ──────────────────────────────
exports.deactivate = async (req, res, next) => {
  try {
    await supabase.from('feedback_links')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    return res.json(success('Feedback link deactivated'));
  } catch (err) { next(err); }
};

// ─── Get feedback responses for a user ───────────────────────
exports.myFeedback = async (req, res, next) => {
  try {
    const { data, error: err } = await supabase
      .from('feedback_responses')
      .select('*, projects(title), feedback_links(client_name)')
      .eq('user_id', req.user.id)
      .order('submitted_at', { ascending: false });

    if (err) throw err;

    // Calculate averages
    const avgRating = data.length
      ? +(data.reduce((s, r) => s + r.rating, 0) / data.length).toFixed(1)
      : 0;

    return res.json(success('My feedback', { responses: data, average_rating: avgRating, total: data.length }));
  } catch (err) { next(err); }
};
