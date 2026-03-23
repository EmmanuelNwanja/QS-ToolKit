// Format Nigerian Naira
export const formatNaira = (amount) => {
  if (amount === null || amount === undefined) return '₦0.00';
  return `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format dates in Nigerian style
export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

// Format compact numbers (for dashboard stats)
export const formatCompact = (n) => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(1)}K`;
  return formatNaira(n);
};

// Status → badge class mapping
export const statusBadge = (status) => {
  const map = {
    active:     'badge-blue',
    completed:  'badge-green',
    on_hold:    'badge-amber',
    cancelled:  'badge-red',
    draft:      'badge-gray',
    sent:       'badge-blue',
    paid:       'badge-green',
    overdue:    'badge-red',
    inactive:   'badge-gray'
  };
  return map[status] || 'badge-gray';
};

// Truncate text
export const truncate = (str, n = 40) => str?.length > n ? str.slice(0, n) + '…' : (str || '');

// Download blob from API response
export const downloadBlob = (data, filename) => {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Nigerian states list
export const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara'
];

// Project types
export const PROJECT_TYPES = [
  'Residential Building',
  'Commercial Building',
  'Industrial Facility',
  'Road & Infrastructure',
  'Bridge & Civil Works',
  'Hospital / Healthcare',
  'Educational Facility',
  'Government Building',
  'Renovation / Refurbishment',
  'Other'
];

// Calculator list config — 13 calculators total
export const CALCULATORS = [
  // ── Original 8 ──────────────────────────────────────────────────
  { id: 'concrete',         label: 'Concrete Volume',          icon: '🏗️', description: 'Slabs, columns, beams, footings',                category: 'Structural'   },
  { id: 'masonry',          label: 'Blockwork & Masonry',      icon: '🧱', description: '6\", 9\" sandcrete blocks, mortar quantities',   category: 'Structural'   },
  { id: 'plastering',       label: 'Plastering & Rendering',   icon: '🖼️', description: 'Cement & sand for wall plaster',                 category: 'Finishes'     },
  { id: 'paint',            label: 'Paint Estimator',          icon: '🎨', description: 'Litres, tins (5L/4L/1L), primer coverage',       category: 'Finishes'     },
  { id: 'roofing',          label: 'Roofing Sheets',           icon: '🏠', description: 'Longspan aluminium sheet quantity',              category: 'Roof'         },
  { id: 'steel',            label: 'Steel Reinforcement',      icon: '⚙️', description: 'Rebar weight 6mm–32mm (BS 4449)',                category: 'Structural'   },
  { id: 'earthwork',        label: 'Earthwork & Excavation',   icon: '🚜', description: 'Cut volumes, bulking factors, truck loads',      category: 'Substructure' },
  { id: 'tiling',           label: 'Floor Tiling',             icon: '⬛', description: 'Tiles, boxes, grout bags',                      category: 'Finishes'     },
  // ── New 5 ────────────────────────────────────────────────────────
  { id: 'carpentry',        label: 'Carpentry & Roof Timbers', icon: '🪵', description: 'Wall plates, rafters, king posts, purlins, fascia', category: 'Roof'      },
  { id: 'formwork',         label: 'Formwork',                 icon: '📐', description: 'Soffits & sides: slabs, beams, columns, stairs', category: 'Structural'   },
  { id: 'roof-accessories', label: 'Roof Accessories',         icon: '🔩', description: 'Ridge capping, valley gutters, metal straps',    category: 'Roof'         },
  { id: 'door-window',      label: 'Door & Window Schedule',   icon: '🚪', description: 'Full schedule with areas & descriptions',        category: 'Finishes'     },
  { id: 'brc-dpm',          label: 'BRC Mesh / DPM',           icon: '🕸️', description: 'Wire mesh, damp proof membrane & DPC',          category: 'Substructure' }
];

// Calculator categories for grouping
export const CALCULATOR_CATEGORIES = ['Structural', 'Substructure', 'Roof', 'Finishes'];
