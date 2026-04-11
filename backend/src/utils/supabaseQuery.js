const SUPABASE_NOT_FOUND_CODE = 'PGRST116';

function isSupabaseNotFoundError(err) {
  if (!err) return false;
  if (err.code === SUPABASE_NOT_FOUND_CODE) return true;
  return /no rows|0 rows/i.test(String(err.message || ''));
}

async function singleOrNull(query) {
  const { data, error } = await query.single();
  if (error) {
    if (isSupabaseNotFoundError(error)) return null;
    throw error;
  }
  return data;
}

module.exports = {
  SUPABASE_NOT_FOUND_CODE,
  isSupabaseNotFoundError,
  singleOrNull
};
