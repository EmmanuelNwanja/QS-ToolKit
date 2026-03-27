import { useState } from 'react';
import toast from 'react-hot-toast';
import { calcAPI } from '../../services/api';

export default function ResultsPanel({ result, calculatorId, calculatorLabel, onSaved, methodology }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  if (!result) {
    return (
      <div className="card h-full flex flex-col items-center justify-center text-center py-20">
        <div className="text-5xl mb-4">📐</div>
        <p className="text-gray-400 font-medium">Enter values and click Calculate</p>
        <p className="text-gray-300 text-sm mt-1">Results will appear here</p>
      </div>
    );
  }

  const { outputs } = result;
  const data = outputs;

  const handleSave = async () => {
    setSaving(true);
    try {
      await calcAPI.save({
        calculator_type: calculatorId,
        title: `${calculatorLabel} — ${new Date().toLocaleDateString('en-NG')}`,
        inputs: result.inputs,
        outputs: data
      });
      setSaved(true);
      if (typeof onSaved === 'function') onSaved();
      toast.success('Calculation saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">✅ Results</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRaw((v) => !v)} className="btn-secondary text-xs px-3 py-1.5">
            {showRaw ? 'Formatted View' : 'Raw Calculation'}
          </button>
          <button onClick={handleSave} disabled={saving || saved} className="btn-secondary text-xs px-3 py-1.5">
            {saved ? '✓ Saved' : saving ? 'Saving…' : '💾 Save Result'}
          </button>
        </div>
      </div>

      {showRaw ? (
        <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-auto max-h-[28rem]">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <ResultBlock data={data} />
      )}

      {methodology && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">Calculation Method & Measurement Standard</p>
          <p className="text-xs text-blue-800 mt-1">{methodology.standard}</p>
          <p className="text-xs font-semibold text-blue-900 mt-3">Units</p>
          <p className="text-xs text-blue-800">{(methodology.units || []).join(' | ')}</p>
          <p className="text-xs font-semibold text-blue-900 mt-3">How result is derived</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            {(methodology.steps || []).map((step) => (
              <li key={step} className="text-xs text-blue-800">{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ResultBlock({ data }) {
  if (!data) return null;

  const renderValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object' && !Array.isArray(val)) return <NestedBlock data={val} />;
    if (Array.isArray(val)) return <ArrayBlock data={val} />;
    return <span className="font-semibold text-primary-700">{String(val)}</span>;
  };

  const summary = data.summary || data;
  const topLevel = typeof summary === 'object' && !Array.isArray(summary) ? summary : { result: summary };

  return (
    <div className="space-y-3">
      {Object.entries(topLevel).map(([key, val]) => {
        if (key === 'note') return (
          <div key={key} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            ℹ️ {val}
          </div>
        );
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          return (
            <div key={key} className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {formatKey(key)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(val).map(([k2, v2]) => (
                  <div key={k2} className="flex flex-col">
                    <span className="text-xs text-gray-500">{formatKey(k2)}</span>
                    <span className="font-bold text-primary-700 text-base">{String(v2)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-600">{formatKey(key)}</span>
            <span className="font-bold text-primary-700">{String(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

function NestedBlock({ data }) {
  return (
    <div className="mt-1 ml-2 space-y-1">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">{formatKey(k)}:</span>
          <span className="font-semibold text-gray-800">{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function ArrayBlock({ data }) {
  if (!data.length) return null;
  if (typeof data[0] !== 'object') return <span>{data.join(', ')}</span>;
  return (
    <div className="overflow-x-auto mt-1">
      <table className="text-xs w-full">
        <thead><tr>{Object.keys(data[0]).map(k => <th key={k} className="text-left px-2 py-1 text-gray-500 font-medium">{formatKey(k)}</th>)}</tr></thead>
        <tbody>{data.map((row, i) => <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>{Object.values(row).map((v, j) => <td key={j} className="px-2 py-1">{String(v)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function formatKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
