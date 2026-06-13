import { useState } from 'react';
import QSFlowModal from '../components/QSFlowModal';

export default function QSFlowPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🚀</span>
        </div>
        <h1 className="page-title mb-2">QS Flow</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          Execute the complete quantity surveying process from start to finish.
          Select a project, complete all measurements, and generate a BOQ in one guided flow.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="btn-gold mt-6 text-base px-8 py-3"
        >
          Start QS Flow
        </button>
      </div>

      <QSFlowModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}
