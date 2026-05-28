/**
 * visualPrimitiveParser.js
 * Parses spatial markers (visual primitives) interleaved into AI reasoning text.
 * Implements the "Thinking with Visual Primitives" pattern for precise visual grounding.
 *
 * Primitive types:
 *   box  — Bounding boxes for rooms/spaces: [[x1,y1,x2,y2]]
 *   poly — Polygons for walls/rooms: [[x1,y1,x2,y2,...,xn,yn]]
 *   point — Center markers for doors/windows: [[x,y]]
 *   line — Dimension/axis lines: [[x1,y1,x2,y2]]
 *
 * Format:
 *   <|ref|>Label<|/ref|><|box|>[[120,80,450,320]]<|/box|>
 *
 * Coordinates are normalized 0–999.
 */

const logger = require('../utils/logger');

// ─── Regex Patterns ───────────────────────────────────────────

const REF_OPEN = '<|ref|>';
const REF_CLOSE = '<|/ref|>';
const BOX_OPEN = '<|box|>';
const BOX_CLOSE = '<|/box|>';
const POLY_OPEN = '<|poly|>';
const POLY_CLOSE = '<|/poly|>';
const POINT_OPEN = '<|point|>';
const POINT_CLOSE = '<|/point|>';
const LINE_OPEN = '<|line|>';
const LINE_CLOSE = '<|/line|>';

const PRIMITIVE_RE = new RegExp(
  `${REF_OPEN}([^${REF_CLOSE}]+?)${REF_CLOSE}` +
  `(?:${BOX_OPEN}\\[\\[([^\\]]+)\\]\\]${BOX_CLOSE}|` +
  `${POLY_OPEN}\\[\\[([^\\]]+)\\]\\]${POLY_CLOSE}|` +
  `${POINT_OPEN}\\[\\[([^\\]]+)\\]\\]${POINT_CLOSE}|` +
  `${LINE_OPEN}\\[\\[([^\\]]+)\\]\\]${LINE_CLOSE})`,
  'g'
);

const COORDS_RE = /\[\[(\d{1,3}),\s*(\d{1,3})(?:,\s*(\d{1,3}),\s*(\d{1,3}))?\]\]/g;

// ─── Types ────────────────────────────────────────────────────

/**
 * @typedef {Object} VisualPrimitive
 * @property {string} id - Unique identifier
 * @property {'box'|'poly'|'point'|'line'} type - Primitive type
 * @property {string} label - Human-readable label from <|ref|>
 * @property {number[]} coords - Normalized coordinates (0-999)
 * @property {number} confidence - 0.0–1.0
 * @property {string|null} roomId - Associated room ID (resolved post-parse)
 * @property {Object} metadata - Additional parsed metadata
 */

/**
 * @typedef {Object} ParsedVisualResult
 * @property {string} reasoning - Clean reasoning text with primitives removed
 * @property {VisualPrimitive[]} primitives - Extracted spatial markers
 * @property {Object} crossReferences - Resolved room→wall→dimension links
 * @property {number} avgConfidence - Average confidence across primitives
 */

// ─── Parser ───────────────────────────────────────────────────

/**
 * Parse raw AI response containing interleaved visual primitives.
 * @param {string} rawResponse - Raw text from AI model
 * @returns {ParsedVisualResult}
 */
function parseVisualPrimitives(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'string') {
    return { reasoning: '', primitives: [], crossReferences: {}, avgConfidence: 0 };
  }

  const primitives = [];
  let match;
  let cleanedText = rawResponse;

  // Reset regex
  PRIMITIVE_RE.lastIndex = 0;

  while ((match = PRIMITIVE_RE.exec(rawResponse)) !== null) {
    const label = match[1].trim();
    const boxCoords = match[2];
    const polyCoords = match[3];
    const pointCoords = match[4];
    const lineCoords = match[5];

    let type, coords, confidence;

    if (boxCoords) {
      type = 'box';
      coords = parseCoordPair(boxCoords);
      confidence = estimateConfidence(label, coords, 'box');
    } else if (polyCoords) {
      type = 'poly';
      coords = parseCoordSequence(polyCoords);
      confidence = estimateConfidence(label, coords, 'poly');
    } else if (pointCoords) {
      type = 'point';
      coords = parseCoordPair(pointCoords);
      confidence = estimateConfidence(label, coords, 'point');
    } else if (lineCoords) {
      type = 'line';
      coords = parseCoordPair(lineCoords);
      confidence = estimateConfidence(label, coords, 'line');
    } else {
      continue;
    }

    if (!coords || coords.length === 0) {
      logger.warn('Failed to parse coordinates for primitive', { label, type });
      continue;
    }

    const id = generatePrimitiveId(type, label, primitives.length);

    primitives.push({
      id,
      type,
      label,
      coords,
      confidence,
      roomId: null,
      metadata: { rawMatch: match[0] }
    });

    // Remove primitive markup from cleaned text
    cleanedText = cleanedText.replace(match[0], `{{${id}}}`);
  }

  // Replace placeholder IDs with labels in cleaned text
  primitives.forEach((p) => {
    cleanedText = cleanedText.replace(new RegExp(`\\{\\{${p.id}\\}\\}`, 'g'), `[${p.label}]`);
  });

  // Resolve cross-references
  const crossReferences = resolveCrossReferences(primitives);

  // Attach room IDs
  primitives.forEach((p) => {
    if (crossReferences.roomMap[p.id]) {
      p.roomId = crossReferences.roomMap[p.id];
    }
  });

  const avgConfidence = primitives.length > 0
    ? primitives.reduce((sum, p) => sum + p.confidence, 0) / primitives.length
    : 0;

  return {
    reasoning: cleanedText.trim(),
    primitives,
    crossReferences,
    avgConfidence: Math.round(avgConfidence * 100) / 100
  };
}

// ─── Coordinate Parsing ───────────────────────────────────────

function parseCoordPair(str) {
  const parts = str.split(',').map((s) => parseInt(s.trim(), 10));
  if (parts.length >= 4 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 999)) {
    return parts.slice(0, 4);
  }
  if (parts.length >= 2 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 999)) {
    return parts.slice(0, 2);
  }
  return null;
}

function parseCoordSequence(str) {
  const parts = str.split(',').map((s) => parseInt(s.trim(), 10));
  if (parts.length >= 6 && parts.length % 2 === 0 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 999)) {
    return parts;
  }
  return null;
}

// ─── Confidence Estimation ────────────────────────────────────

function estimateConfidence(label, coords, type) {
  let score = 0.75; // Base confidence

  // Label quality
  if (label.length > 2) score += 0.05;
  if (/^(room|wall|door|window|dim|column|beam)/i.test(label)) score += 0.05;

  // Coordinate validity
  if (type === 'box' && coords.length === 4) {
    const [x1, y1, x2, y2] = coords;
    const area = Math.abs(x2 - x1) * Math.abs(y2 - y1);
    if (area > 1000) score += 0.05; // Reasonable room size
    if (x2 > x1 && y2 > y1) score += 0.05; // Properly ordered
  }

  if (type === 'poly' && coords.length >= 6) {
    score += 0.05; // Polygon has enough vertices
  }

  if (type === 'point' && coords.length === 2) {
    score += 0.05; // Valid single point
  }

  if (type === 'line' && coords.length === 4) {
    const [x1, y1, x2, y2] = coords;
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    if (length > 10) score += 0.05; // Non-degenerate line
  }

  return Math.min(1.0, score);
}

// ─── Cross-Reference Resolution ───────────────────────────────

function resolveCrossReferences(primitives) {
  const roomMap = {}; // primitiveId -> roomId
  const rooms = [];
  const walls = [];
  const dimensions = [];

  // First pass: identify rooms (boxes/polygons labeled as rooms)
  primitives.forEach((p) => {
    if (p.type === 'box' && /room|space|area|living|kitchen|bedroom|bathroom|toilet|office|store/i.test(p.label)) {
      rooms.push({ ...p, elements: [] });
    }
    if (p.type === 'poly' && /wall/i.test(p.label)) {
      walls.push(p);
    }
    if (p.type === 'line' && /dim/i.test(p.label)) {
      dimensions.push(p);
    }
  });

  // Second pass: assign walls/points/dimensions to nearest room
  primitives.forEach((p) => {
    if (p.type === 'box' && rooms.some((r) => r.id === p.id)) return; // Skip rooms themselves

    let nearestRoom = null;
    let minDistance = Infinity;

    for (const room of rooms) {
      const dist = distanceToPrimitive(p, room);
      if (dist < minDistance) {
        minDistance = dist;
        nearestRoom = room;
      }
    }

    if (nearestRoom && minDistance < 200) { // Within reasonable proximity
      roomMap[p.id] = nearestRoom.id;
      nearestRoom.elements.push(p.id);
    }
  });

  return {
    roomMap,
    rooms: rooms.map((r) => ({ id: r.id, label: r.label, elementIds: r.elements })),
    walls: walls.map((w) => ({ id: w.id, label: w.label, roomId: roomMap[w.id] })),
    dimensions: dimensions.map((d) => ({ id: d.id, label: d.label, roomId: roomMap[d.id] }))
  };
}

function distanceToPrimitive(p1, room) {
  if (room.type === 'box') {
    const [rx1, ry1, rx2, ry2] = room.coords;
    const rcx = (rx1 + rx2) / 2;
    const rcy = (ry1 + ry2) / 2;

    let px, py;
    if (p1.type === 'point') {
      [px, py] = p1.coords;
    } else if (p1.type === 'box') {
      const [x1, y1, x2, y2] = p1.coords;
      px = (x1 + x2) / 2;
      py = (y1 + y2) / 2;
    } else if (p1.type === 'line') {
      const [x1, y1, x2, y2] = p1.coords;
      px = (x1 + x2) / 2;
      py = (y1 + y2) / 2;
    } else if (p1.type === 'poly') {
      let sumX = 0, sumY = 0;
      for (let i = 0; i < p1.coords.length; i += 2) {
        sumX += p1.coords[i];
        sumY += p1.coords[i + 1];
      }
      px = sumX / (p1.coords.length / 2);
      py = sumY / (p1.coords.length / 2);
    } else {
      return Infinity;
    }

    return Math.sqrt((px - rcx) ** 2 + (py - rcy) ** 2);
  }

  return Infinity;
}

// ─── Utilities ────────────────────────────────────────────────

function generatePrimitiveId(type, label, index) {
  const prefix = type.charAt(0).toUpperCase();
  const safeLabel = label.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  return `${prefix}-${safeLabel}-${index}`;
}

/**
 * Convert normalized coordinates (0-999) to pixel coordinates for display.
 * @param {number[]} coords - Normalized coordinates
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {number[]} Pixel coordinates
 */
function normalizedToPixel(coords, width, height) {
  return coords.map((c, i) => Math.round((c / 999) * (i % 2 === 0 ? width : height)));
}

/**
 * Convert pixel coordinates to normalized coordinates.
 * @param {number[]} coords - Pixel coordinates
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {number[]} Normalized coordinates
 */
function pixelToNormalized(coords, width, height) {
  return coords.map((c, i) => Math.round((c / (i % 2 === 0 ? width : height)) * 999));
}

/**
 * Serialize primitives back to interleaved format for model fine-tuning.
 * @param {VisualPrimitive[]} primitives
 * @returns {string}
 */
function serializePrimitives(primitives) {
  return primitives.map((p) => {
    const coordsStr = p.type === 'poly'
      ? `[[${p.coords.join(',')}]]`
      : `[[${p.coords.slice(0, 4).join(',')}]]`;
    return `<|ref|>${p.label}<|/ref|><|${p.type}|>${coordsStr}<|/${p.type}|>`;
  }).join('\n');
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  parseVisualPrimitives,
  normalizedToPixel,
  pixelToNormalized,
  serializePrimitives,
  // Types exported for JSDoc only
  // VisualPrimitive, ParsedVisualResult
};
