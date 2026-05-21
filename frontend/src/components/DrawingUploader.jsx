import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { aiAPI, boqAPI } from '../services/api';

export default function DrawingUploader({ projectId, onSuccess }) {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const handleFile = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      setPreview(e.target.result);
      setAnalyzing(true);

      try {
        const { data } = await aiAPI.analyzeDrawing({
          image_base64: base64,
          project_id: projectId || null
        });

        setResult(data);
        toast.success(`Analysis complete — Confidence: ${data.confidence}`);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Analysis failed');
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  }, [projectId]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const createDraftBoq = async () => {
    if (!result?.draft_boq?.length) return;
    try {
      const sections = result.draft_boq.map((sec, i) => ({
        title: sec.title || `Section ${i + 1}`,
        section_type: 'measured_work',
        sort_order: i,
        items: (sec.items || []).map((item, j) => ({
          item_no: item.item_no || `${i + 1}.${j + 1}`,
          description: item.description || 'TBD',
          unit: item.unit || 'm2',
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          amount: (Number(item.quantity) || 0) * (Number(item.rate) || 0)
        }))
      }));

      const { data } = await boqAPI.create({
        title: `AI Draft — ${result.rooms?.[0]?.name || 'Project'}`,
        project_id: projectId || '',
        measurement_standard: 'SMM7',
        notes: `Auto-generated from drawing analysis. Confidence: ${result.confidence}. Warnings: ${result.warnings?.join(', ') || 'none'}`,
        status: 'draft',
        sections
      });

      toast.success('Draft BOQ created!');
      if (onSuccess) onSuccess(data.boq);
      else router.push(`/boq/${data.boq.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create draft BOQ');
    }
  };

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
            dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <div className="text-4xl mb-3">🏗️</div>
          <p className="text-sm font-medium text-gray-700">
            Drag & drop an architectural drawing here
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Or click to browse · JPEG/PNG under 5MB
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
            id="drawing-input"
          />
          <label
            htmlFor="drawing-input"
            className="mt-4 inline-block btn-secondary text-sm cursor-pointer"
          >
            Browse Files
          </label>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          <img src={preview} alt="Drawing preview" className="w-full max-h-64 object-contain bg-gray-100" />
          <button
            onClick={() => { setPreview(null); setResult(null); }}
            className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded hover:bg-black/80"
          >
            Remove
          </button>
        </div>
      )}

      {/* Analyzing state */}
      {analyzing && (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-3" />
          <p className="text-sm text-gray-600">QSAI is analyzing your drawing...</p>
          <p className="text-xs text-gray-400 mt-1">Extracting rooms, dimensions, and materials</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              result.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
              result.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {result.confidence?.toUpperCase()} confidence
            </span>
            {result.warnings?.length > 0 && (
              <span className="text-xs text-amber-600">
                {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {result.rooms?.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Detected Rooms</h4>
              <div className="space-y-2">
                {result.rooms.map((room, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">{room.name}</span>
                    <span className="text-gray-500">
                      {room.dimensions?.length_m}m × {room.dimensions?.width_m}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.material_takeoff?.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Material Takeoff</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {result.material_takeoff.map((m, i) => (
                  <div key={i} className="p-2 bg-gray-50 rounded-lg text-center">
                    <p className="font-medium text-gray-700">{m.material}</p>
                    <p className="text-primary-700 font-semibold">{m.quantity} {m.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.warnings?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Warnings</p>
              <ul className="text-xs text-amber-700 space-y-1">
                {result.warnings.map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={createDraftBoq} className="btn-primary flex-1 text-sm">
              Create Draft BOQ →
            </button>
            <button onClick={() => { setPreview(null); setResult(null); }} className="btn-secondary text-sm">
              Analyze Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
