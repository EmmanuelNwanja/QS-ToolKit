import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { aiAPI } from '../services/api';
import { formatNaira } from '../utils/helpers';

const RISK_STYLES = {
  low: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500' },
  high: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', bar: 'bg-orange-500' },
  critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', bar: 'bg-red-500' }
};

export default function ForecastCard({ projectId }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await aiAPI.forecast(projectId);
      setForecast(data.forecast);
    } catch (err) {
      const msg = err.response?.data?.message;
      if (err.response?.status !== 403) toast.error(msg || 'Could not load forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-3" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!forecast) return null;

  const style = RISK_STYLES[forecast.risk_level] || RISK_STYLES.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card border-l-4 ${style.border.replace('border-', 'border-l-')}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title text-sm">🔮 Cost Forecast</h3>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${style.bg} ${style.color}`}>
          {forecast.risk_level?.toUpperCase()} RISK
        </span>
      </div>

      <div className="mb-4">
        <p className="text-xs text-gray-500">Predicted Final Cost</p>
        <p className="text-2xl font-bold text-gray-900">{formatNaira(forecast.predicted_final_value)}</p>
        {forecast.baseline > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            vs current baseline {formatNaira(forecast.baseline)}
            {' '}
            <span className={forecast.predicted_final_value > forecast.baseline ? 'text-red-600' : 'text-emerald-600'}>
              ({((forecast.predicted_final_value / Math.max(forecast.baseline, 1) - 1) * 100).toFixed(1)}%)
            </span>
          </p>
        )}
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Confidence</span>
          <span>{forecast.confidence_score}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${style.bar}`}
            style={{ width: `${forecast.confidence_score}%` }}
          />
        </div>
      </div>

      {/* Factors */}
      {forecast.factors?.length > 0 && (
        <div className="space-y-2 mb-4">
          {forecast.factors.map((f, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-gray-400 mt-0.5">•</span>
              <div>
                <span className="font-medium text-gray-700">{f.name}</span>
                <p className="text-gray-500">{f.impact}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation */}
      <div className={`p-3 rounded-lg text-xs ${style.bg} ${style.color}`}>
        <span className="font-semibold">Recommendation:</span>{' '}
        {forecast.recommendation}
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        Based on {forecast.historical_sample_size} completed projects · {forecast.model_version}
      </p>
    </motion.div>
  );
}
