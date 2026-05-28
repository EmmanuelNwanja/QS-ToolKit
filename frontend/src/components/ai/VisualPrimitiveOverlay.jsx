/**
 * VisualPrimitiveOverlay.jsx
 * Interactive SVG overlay for visual primitives on architectural drawings.
 * Renders bounding boxes, polygons, points, and lines with click-to-highlight
 * and edit mode for user corrections.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Primitive Renderer ───────────────────────────────────────

function BoxPrimitive({ primitive, scale, isSelected, onClick, color }) {
  const [x1, y1, x2, y2] = primitive.pixelCoords || primitive.coords.map((c, i) =>
    (c / 999) * (i % 2 === 0 ? scale.width : scale.height)
  );

  return (
    <motion.rect
      x={Math.min(x1, x2)}
      y={Math.min(y1, y2)}
      width={Math.abs(x2 - x1)}
      height={Math.abs(y2 - y1)}
      fill={color}
      fillOpacity={isSelected ? 0.3 : 0.1}
      stroke={isSelected ? '#f59e0b' : color}
      strokeWidth={isSelected ? 3 : 2}
      strokeDasharray={primitive.confidence < 0.7 ? '5,5' : 'none'}
      rx={4}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => { e.stopPropagation(); onClick(primitive); }}
      className="cursor-pointer hover:fill-opacity-40 transition-all"
    />
  );
}

function PolyPrimitive({ primitive, scale, isSelected, onClick, color }) {
  const coords = primitive.pixelCoords || primitive.coords.map((c, i) =>
    (c / 999) * (i % 2 === 0 ? scale.width : scale.height)
  );

  const points = [];
  for (let i = 0; i < coords.length; i += 2) {
    points.push(`${coords[i]},${coords[i + 1]}`);
  }

  return (
    <motion.polygon
      points={points.join(' ')}
      fill={color}
      fillOpacity={isSelected ? 0.3 : 0.1}
      stroke={isSelected ? '#f59e0b' : color}
      strokeWidth={isSelected ? 3 : 2}
      strokeDasharray={primitive.confidence < 0.7 ? '5,5' : 'none'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => { e.stopPropagation(); onClick(primitive); }}
      className="cursor-pointer hover:fill-opacity-40 transition-all"
    />
  );
}

function PointPrimitive({ primitive, scale, isSelected, onClick, color }) {
  const [x, y] = primitive.pixelCoords || primitive.coords.map((c, i) =>
    (c / 999) * (i % 2 === 0 ? scale.width : scale.height)
  );

  return (
    <motion.g
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { e.stopPropagation(); onClick(primitive); }}
      className="cursor-pointer"
    >
      <circle
        cx={x}
        cy={y}
        r={isSelected ? 8 : 5}
        fill={isSelected ? '#f59e0b' : color}
        stroke="white"
        strokeWidth={2}
        opacity={primitive.confidence < 0.7 ? 0.5 : 1}
      />
      {isSelected && (
        <circle
          cx={x}
          cy={y}
          r={12}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1}
          opacity={0.5}
        />
      )}
    </motion.g>
  );
}

function LinePrimitive({ primitive, scale, isSelected, onClick, color }) {
  const [x1, y1, x2, y2] = primitive.pixelCoords || primitive.coords.map((c, i) =>
    (c / 999) * (i % 2 === 0 ? scale.width : scale.height)
  );

  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={isSelected ? '#f59e0b' : color}
      strokeWidth={isSelected ? 3 : 2}
      strokeDasharray={primitive.confidence < 0.7 ? '5,5' : 'none'}
      markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.5 }}
      onClick={(e) => { e.stopPropagation(); onClick(primitive); }}
      className="cursor-pointer"
    />
  );
}

// ─── Color Map ────────────────────────────────────────────────

const TYPE_COLORS = {
  box: '#3b82f6',    // blue-500
  poly: '#10b981',   // emerald-500
  point: '#f43f5e',  // rose-500
  line: '#8b5cf6'    // violet-500
};

// ─── Main Component ───────────────────────────────────────────

export default function VisualPrimitiveOverlay({
  imageUrl,
  primitives = [],
  rooms = [],
  suggestedBoq = [],
  onPrimitiveClick,
  onCorrection,
  onExport,
  readOnly = false
}) {
  const [selectedPrimitive, setSelectedPrimitive] = useState(null);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [scale, setScale] = useState({ width: 1000, height: 1000 });
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (imageRef.current) {
      const updateScale = () => {
        setScale({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight
        });
      };
      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }
  }, [imageUrl]);

  const handlePrimitiveClick = useCallback((primitive) => {
    setSelectedPrimitive(primitive.id === selectedPrimitive ? null : primitive.id);
    if (onPrimitiveClick) {
      onPrimitiveClick(primitive);
    }
  }, [selectedPrimitive, onPrimitiveClick]);

  const handleCorrection = useCallback((type, correction) => {
    if (onCorrection) {
      onCorrection({
        primitiveId: selectedPrimitive,
        correctionType: type,
        ...correction
      });
    }
  }, [selectedPrimitive, onCorrection]);

  const selectedPrimitiveData = primitives.find((p) => p.id === selectedPrimitive);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-2">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            {primitives.length} primitives detected
          </span>
          <div className="flex items-center gap-2">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                {type}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                editMode
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {editMode ? 'Done Editing' : 'Edit Primitives'}
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Export to BOQ
            </button>
          )}
        </div>
      </div>

      {/* Image + SVG Overlay */}
      <div ref={containerRef} className="relative bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Architectural drawing"
          className="w-full h-auto block"
          draggable={false}
        />
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto"
          viewBox={`0 0 ${scale.width} ${scale.height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
            </marker>
            <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
            </marker>
          </defs>

          {primitives.map((primitive) => {
            const isSelected = selectedPrimitive === primitive.id;
            const color = TYPE_COLORS[primitive.type] || '#6b7280';
            const props = {
              primitive,
              scale,
              isSelected,
              onClick: handlePrimitiveClick,
              color
            };

            switch (primitive.type) {
              case 'box': return <BoxPrimitive key={primitive.id} {...props} />;
              case 'poly': return <PolyPrimitive key={primitive.id} {...props} />;
              case 'point': return <PointPrimitive key={primitive.id} {...props} />;
              case 'line': return <LinePrimitive key={primitive.id} {...props} />;
              default: return null;
            }
          })}
        </svg>

        {/* Confidence overlay */}
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          Avg Confidence: {Math.round((primitives.reduce((s, p) => s + (p.confidence || 0), 0) / Math.max(primitives.length, 1)) * 100)}%
        </div>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedPrimitiveData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedPrimitiveData.label}</h3>
                <p className="text-sm text-gray-500 capitalize">{selectedPrimitiveData.type} • ID: {selectedPrimitiveData.id}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedPrimitiveData.confidence >= 0.9 ? 'bg-green-100 text-green-800' :
                    selectedPrimitiveData.confidence >= 0.7 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    Confidence: {Math.round((selectedPrimitiveData.confidence || 0) * 100)}%
                  </span>
                  {selectedPrimitiveData.roomId && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Room: {selectedPrimitiveData.roomId}
                    </span>
                  )}
                </div>
              </div>
              {editMode && onCorrection && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleCorrection('boundary_error', { note: 'Boundary is incorrect' })}
                    className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    Wrong Boundary
                  </button>
                  <button
                    onClick={() => handleCorrection('label_error', { note: 'Label is incorrect' })}
                    className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    Wrong Label
                  </button>
                  <button
                    onClick={() => handleCorrection('missing_element', { note: 'Missing nearby element' })}
                    className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    Missing Element
                  </button>
                </div>
              )}
            </div>

            {/* Suggested BOQ items for this primitive */}
            {suggestedBoq.length > 0 && selectedPrimitiveData.type === 'box' && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Suggested BOQ Items</p>
                <div className="mt-1 space-y-1">
                  {suggestedBoq.slice(0, 3).map((section, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium text-gray-700">{section.title}</span>
                      {section.items?.slice(0, 2).map((item, i) => (
                        <p key={i} className="text-gray-500 ml-2">
                          • {item.description} — {item.quantity} {item.unit}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rooms List */}
      {rooms.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Detected Rooms ({rooms.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onMouseEnter={() => setHoveredRoom(room.id)}
                onMouseLeave={() => setHoveredRoom(null)}
                onClick={() => {
                  const roomPrimitive = primitives.find((p) => p.id === room.id);
                  if (roomPrimitive) handlePrimitiveClick(roomPrimitive);
                }}
                className={`text-left p-2 rounded border text-sm transition-colors ${
                  hoveredRoom === room.id
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <p className="font-medium text-gray-800">{room.label}</p>
                {room.dimensions && (
                  <p className="text-xs text-gray-500">
                    {room.dimensions.length_m}m × {room.dimensions.width_m}m
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
