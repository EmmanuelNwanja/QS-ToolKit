const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');

const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS_PER_TYPE = 5;

/**
 * GET /api/v1/search?q=<query>
 *
 * Predictable prefix-search across the authenticated user's own records:
 *   - projects (title, client_name, location)
 *   - BOQ documents (title)
 *   - invoices (invoice_number, client_name)
 *
 * Requires q >= 3 chars. Returns stable groups so the UI can render
 * a predictable dropdown as the user types.
 */
exports.globalSearch = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();

    if (q.length < MIN_QUERY_LENGTH) {
      return res.status(400).json(error(`Query must be at least ${MIN_QUERY_LENGTH} characters`, {
        code: 'QUERY_TOO_SHORT',
        min_length: MIN_QUERY_LENGTH
      }));
    }

    // Escape LIKE special characters so user input can't inject wildcards.
    const safe = q.replace(/[%_,()]/g, ' ').trim();
    if (!safe) {
      return res.json(success('Search results', { results: { projects: [], boqs: [], invoices: [] }, query: q }));
    }

    const pattern = `%${safe}%`;

    const [projectsRes, boqsRes, invoicesRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, title, client_name, location, status')
        .eq('user_id', req.user.id)
        .or(`title.ilike.${pattern},client_name.ilike.${pattern},location.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(MAX_RESULTS_PER_TYPE),

      supabase
        .from('boq_documents')
        .select('id, title, project_id, status, total_amount')
        .eq('user_id', req.user.id)
        .ilike('title', pattern)
        .order('updated_at', { ascending: false })
        .limit(MAX_RESULTS_PER_TYPE),

      supabase
        .from('invoices')
        .select('id, invoice_number, client_name, project_id, status, total_amount, invoice_type')
        .eq('user_id', req.user.id)
        .or(`invoice_number.ilike.${pattern},client_name.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(MAX_RESULTS_PER_TYPE)
    ]);

    if (projectsRes.error) throw projectsRes.error;
    if (boqsRes.error) throw boqsRes.error;
    if (invoicesRes.error) throw invoicesRes.error;

    return res.json(success('Search results', {
      query: q,
      results: {
        projects: projectsRes.data || [],
        boqs: boqsRes.data || [],
        invoices: invoicesRes.data || []
      }
    }));
  } catch (err) { next(err); }
};
