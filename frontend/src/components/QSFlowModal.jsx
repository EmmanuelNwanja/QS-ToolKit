import { useState, useEffect } from 'react';
import Link from 'next/link';
import { projectAPI } from '../services/api';

export default function QSFlowModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);
  const [project, setProject] = useState(null);
  const steps = [
    'Select or create a project',
    'Substructure calculations',
    'Superstructure calculations',
    'Create BOQ'
  ];

  if (!isOpen) return null;

  const handleProjectNext = (proj) => {
    setProject(proj);
    setStep(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">QS Flow</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            {steps.map((label, idx) => (
              <div key={idx} className={`px-3 py-1 rounded ${idx === step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Step {idx + 1}</div>
            ))}
          </div>
          <div className="mt-4 border-t pt-4">
            {step === 0 && <ProjectSelection onNext={handleProjectNext} />}
            {step === 1 && <SubstructureWizard project={project} onNext={() => setStep(2)} />}
            {step === 2 && <SuperstructureWizard project={project} onNext={() => setStep(3)} />}
            {step === 3 && <BOQCreation project={project} onFinish={onClose} />}
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2 bg-gray-200 rounded">Back</button>
          )}
          {step < steps.length - 1 && (
            <button onClick={() => setStep(step + 1)} className="px-4 py-2 bg-primary-600 text-white rounded">Next</button>
          )}
        </div>
      </div>
    </div>
  );
}


function ProjectSelection({ onNext }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    projectAPI.list().then(r => {
      setProjects(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName) return;
    setCreating(true);
    const res = await projectAPI.create({ name: newName });
    setProjects([...projects, res.data]);
    setSelected(res.data);
    setCreating(false);
    setNewName('');
  };

  if (loading) return <p>Loading projects…</p>;

  return (
    <div>
      <h3 className="font-semibold mb-2">Select a project</h3>
      <ul className="max-h-48 overflow-y-auto mb-2 border rounded p-2">
        {projects.map(p => (
          <li key={p.id} className={`p-1 cursor-pointer ${selected?.id===p.id?'bg-primary-100':''}`} onClick={()=>setSelected(p)}>{p.name}</li>
        ))}
      </ul>
      <div className="flex items-center space-x-2 mb-2">
        <input type="text" placeholder="New project name" value={newName} onChange={e=>setNewName(e.target.value)} className="border rounded flex-1 px-2 py-1" />
        <button onClick={handleCreate} disabled={creating} className="px-3 py-1 bg-green-600 text-white rounded">Create</button>
      </div>
      <button onClick={()=>onNext(selected)} disabled={!selected} className="mt-2 px-4 py-2 bg-primary-600 text-white rounded">Select Project</button>
    </div>
  );
}


function SubstructureWizard({ onNext, project }) {
  const items = [
    { id: 1, section: 'Site Works', item: 'Site Clearance', unit: 'm²', formula: 'Length × Width', dimensions: '15 × 12', suggested: 180 },
    { id: 2, section: 'Site Works', item: 'Remove Topsoil', unit: 'm³', formula: 'Length × Width × Depth', dimensions: '15 × 12 × 0.15', suggested: 27 },
    // Additional rows can be added here following the same schema
  ];
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const current = items[index];

  const persistResult = async (qty) => {
    if (!project) return;
    // Simple stub: store results in a custom field on the project (e.g., substructureResults)
    const existing = project.substructureResults || [];
    const updated = [...existing, { itemId: current.id, quantity: qty }];
    await projectAPI.update(project.id, { substructureResults: updated });
  };

  const handleSave = async () => {
    const qty = value ? Number(value) : current.suggested;
    await persistResult(qty);
    if (index < items.length - 1) {
      setIndex(index + 1);
      setValue('');
    } else {
      onNext();
    }
  };

  return (
    <div>
      <h3 className="font-semibold mb-2">Substructure – {current.section}</h3>
      <p className="mb-1"><strong>{current.item}</strong> ({current.unit})</p>
      <p className="text-sm text-gray-600 mb-2">Formula: {current.formula}   Dimensions: {current.dimensions}</p>
      <div className="flex items-center space-x-2 mb-2">
        <input type="number" placeholder={`Suggested: ${current.suggested}`} value={value} onChange={e=>setValue(e.target.value)} className="border rounded px-2 py-1 w-24" />
        <span className="text-gray-600">Qty</span>
      </div>
      <button onClick={handleSave} className="mt-2 px-4 py-2 bg-primary-600 text-white rounded">Save &amp; Continue</button>
    </div>
  );
}

function SuperstructureWizard({ onNext, project }) {
  const items = [
    { id: 1, section: 'Frame', item: 'Columns Concrete', unit: 'm³', formula: 'Length × Width × Height', dimensions: '0.225 × 0.225 × 3.0', suggested: 1.22 },
    { id: 2, section: 'Frame', item: 'Columns Reinforcement', unit: 'kg', formula: 'Bar Length × Unit Weight', dimensions: '15kg', suggested: 120 },
    // Additional rows can be added here
  ];
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const current = items[index];

  const persistResult = async (qty) => {
    if (!project) return;
    const existing = project.superstructureResults || [];
    const updated = [...existing, { itemId: current.id, quantity: qty }];
    await projectAPI.update(project.id, { superstructureResults: updated });
  };

  const handleSave = async () => {
    const qty = value ? Number(value) : current.suggested;
    await persistResult(qty);
    if (index < items.length - 1) {
      setIndex(index + 1);
      setValue('');
    } else {
      onNext();
    }
  };

  return (
    <div>
      <h3 className="font-semibold mb-2">Superstructure – {current.section}</h3>
      <p className="mb-1"><strong>{current.item}</strong> ({current.unit})</p>
      <p className="text-sm text-gray-600 mb-2">Formula: {current.formula}   Dimensions: {current.dimensions}</p>
      <div className="flex items-center space-x-2 mb-2">
        <input type="number" placeholder={`Suggested: ${current.suggested}`} value={value} onChange={e=>setValue(e.target.value)} className="border rounded px-2 py-1 w-24" />
        <span className="text-gray-600">Qty</span>
      </div>
      <button onClick={handleSave} className="mt-2 px-4 py-2 bg-primary-600 text-white rounded">Save &amp; Continue</button>
    </div>
  );
}

function BOQCreation({ onFinish }) {
  return (
    <div>
      <p>BOQ creation UI goes here.</p>
      <button onClick={onFinish} className="mt-2 px-4 py-2 bg-green-600 text-white rounded">Create BOQ</button>
    </div>
  );
}
