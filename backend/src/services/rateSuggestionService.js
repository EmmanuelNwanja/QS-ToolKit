/**
 * rateSuggestionService.js
 * Smart rate suggestions from user's own BOQ history.
 * Zero API cost — pure statistical analysis.
 */

const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Normalize a description for matching.
 */
function normalizeDescription(desc) {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hash a normalized description.
 */
function hashDescription(desc) {
  return crypto.createHash('sha256').update(desc).digest('hex');
}

/**
 * Find similar descriptions using simple token overlap.
 */
function similarityScore(a, b) {
  const tokensA = new Set(a.split(/\s+/));
  const tokensB = new Set(b.split(/\s+/));
  const intersection = [...tokensA].filter((x) => tokensB.has(x));
  return intersection.length / Math.max(tokensA.size, tokensB.size);
}

/**
 * Build or refresh smart rate suggestions for a user.
 */
exports.buildSuggestionsForUser = async (userId) => {
  try {
    // Fetch all user's BOQ items with rates
    const { data: items } = await supabase
      .from('boq_items')
      .select('description, unit, rate, quantity, amount')
      .eq('user_id', userId)
      .gt('rate', 0)
      .not('description', 'is', null);

    if (!items || items.length === 0) return { success: true, built: 0 };

    // Group by normalized description + unit
    const groups = {};
    for (const item of items) {
      const normalized = normalizeDescription(item.description);
      const key = `${hashDescription(normalized)}|${item.unit}`;
      if (!groups[key]) {
        groups[key] = {
          pattern: normalized.substring(0, 255),
          unit: item.unit,
          rates: []
        };
      }
      groups[key].rates.push(Number(item.rate));
    }

    // Upsert aggregated suggestions
    let built = 0;
    for (const [key, group] of Object.entries(groups)) {
      if (group.rates.length < 2) continue;

      const sorted = [...group.rates].sort((a, b) => a - b);
      const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const low = sorted[Math.floor(sorted.length * 0.1)] || sorted[0];
      const high = sorted[Math.floor(sorted.length * 0.9)] || sorted[sorted.length - 1];

      const { error } = await supabase
        .from('smart_rate_suggestions')
        .upsert({
          user_id: userId,
          item_description_hash: key.split('|')[0],
          item_description_pattern: group.pattern,
          unit: group.unit,
          suggested_rate: Math.round(mean),
          rate_low: Math.round(low),
          rate_high: Math.round(high),
          sample_size: group.rates.length,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'user_id,item_description_hash,unit' });

      if (!error) built++;
    }

    return { success: true, built };
  } catch (err) {
    logger.error('Build suggestions error:', err.message);
    return { success: false, message: err.message };
  }
};

/**
 * Get smart rate suggestion for a specific item description.
 */
exports.getSuggestion = async (userId, description, unit) => {
  try {
    const normalized = normalizeDescription(description);
    const exactHash = hashDescription(normalized);

    // Try exact match first
    const { data: exact } = await supabase
      .from('smart_rate_suggestions')
      .select('*')
      .eq('user_id', userId)
      .eq('item_description_hash', exactHash)
      .eq('unit', unit)
      .single();

    if (exact) {
      return {
        found: true,
        matchType: 'exact',
        suggestedRate: exact.suggested_rate,
        rateLow: exact.rate_low,
        rateHigh: exact.rate_high,
        sampleSize: exact.sample_size,
        pattern: exact.item_description_pattern
      };
    }

    // Fallback: fuzzy match on patterns
    const { data: allSuggestions } = await supabase
      .from('smart_rate_suggestions')
      .select('*')
      .eq('user_id', userId)
      .eq('unit', unit)
      .limit(200);

    if (!allSuggestions || allSuggestions.length === 0) {
      return { found: false };
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const sug of allSuggestions) {
      const score = similarityScore(normalized, sug.item_description_pattern);
      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestMatch = sug;
      }
    }

    if (bestMatch) {
      return {
        found: true,
        matchType: 'fuzzy',
        similarity: Math.round(bestScore * 100),
        suggestedRate: bestMatch.suggested_rate,
        rateLow: bestMatch.rate_low,
        rateHigh: bestMatch.rate_high,
        sampleSize: bestMatch.sample_size,
        pattern: bestMatch.item_description_pattern
      };
    }

    return { found: false };
  } catch (err) {
    logger.error('Get suggestion error:', err.message);
    return { found: false };
  }
};

/**
 * Batch get suggestions for multiple items.
 */
exports.getSuggestionsBatch = async (userId, items) => {
  const results = [];
  for (const item of items) {
    const sug = await exports.getSuggestion(userId, item.description, item.unit);
    results.push({ ...item, suggestion: sug });
  }
  return results;
};
