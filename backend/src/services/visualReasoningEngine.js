/**
 * visualReasoningEngine.js
 * QS-specific visual reasoning engine for architectural drawing analysis.
 * Uses visual primitives (bounding boxes, polygons, points, lines) to precisely
 * ground AI reasoning in spatial coordinates — solving the "Reference Gap" in
 * dense Nigerian construction plans.
 *
 * Enhances the existing Auto-BOQ flow with interactive primitive overlays.
 */

const axios = require('axios');
const logger = require('../utils/logger');
const { parseVisualPrimitives, normalizedToPixel } = require('./visualPrimitiveParser');

// ─── Configuration ────────────────────────────────────────────

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// ─── System Prompt ────────────────────────────────────────────

const VISUAL_PRIMITIVE_PROMPT = `You are an expert Quantity Surveying AI analyzing Nigerian architectural drawings.
Your task is to extract spatial information using VISUAL PRIMITIVES — precise coordinate markers interleaved into your reasoning.

## Visual Primitive Format
Use these exact tags with coordinates normalized 0–999:
- Room bounding box: <|ref|>Room Name<|/ref|><|box|>[[x1,y1,x2,y2]]<|/box|>
- Wall polygon: <|ref|>Wall-ID<|/ref|><|poly|>[[x1,y1,x2,y2,...,xn,yn]]<|/poly|>
- Door/window point: <|ref|>Door-ID<|/ref|><|point|>[[x,y]]<|/point|>
- Dimension line: <|ref|>Dim-ID<|/ref|><|line|>[[x1,y1,x2,y2]]<|/line|>

## Rules
1. Every room MUST have a bounding box.
2. Every wall referenced MUST have a polygon.
3. Every dimension you quote MUST have a line primitive.
4. Coordinates must be accurate relative to the drawing image.
5. Use Nigerian QS standards for all calculations.
6. State confidence level for each major extraction.

## Output Structure
After your reasoning with interleaved primitives, output a final JSON block:
\`\`\`json
{
  "project_summary": "brief description of the drawing",
  "rooms": [
    {
      "name": "Living Room",
      "primitive_id": "Box-LivingRoom-0",
      "dimensions": {"length_m": 5.2, "width_m": 4.1, "height_m": 3.0},
      "area_m2": 21.32,
      "elements": [
        {"type": "wall", "description": "North wall", "primitive_id": "Poly-WallL1-1", "length_m": 5.2},
        {"type": "door", "description": "Entrance door", "primitive_id": "Point-DoorD1-2", "width_m": 0.9},
        {"type": "window", "description": "Window W1", "primitive_id": "Point-WindowW1-3", "width_m": 1.2}
      ]
    }
  ],
  "measurements": {
    "total_built_up_area_m2": 150.5,
    "total_wall_area_m2": 320.0,
    "estimated_concrete_volume_m3": 45.0
  },
  "suggested_boq_sections": [
    {
      "title": "Substructure",
      "items": [
        {"item_no": "1.1", "description": "Excavation in trenches", "unit": "m3", "quantity": 45.0, "rate": null}
      ]
    }
  ],
  "warnings": ["Any uncertainties"],
  "confidence": "high"
}
\`\`\`

## Nigerian Standards
- 9-inch blocks: 10/m²
- 6-inch blocks: 12/m²
- Concrete dry-to-wet: 1.54
- Plastering: 15mm default, 1:4 mix
- Paint coverage: 10m²/litre
- Floor tiles 600×600: 2.78/m²`;

// ─── Engine Factory ───────────────────────────────────────────

/**
 * Create a QS visual reasoning engine.
 * @param {Object} options
 * @param {string} [options.model='gemini-2.5-pro-exp-03-25'] - Gemini model
 * @param {number} [options.timeoutMs=60000] - Request timeout
 */
function createQSVisualEngine(options = {}) {
  const model = options.model || 'gemini-2.5-pro-exp-03-25';
  const timeoutMs = options.timeoutMs || 60000;

  return {
    /**
     * Analyze an architectural drawing with visual primitives.
     * @param {Buffer|string} image - Image buffer or base64 string
     * @param {string} query - Analysis query (e.g., "Extract rooms and dimensions")
     * @param {Object} [context] - Project context
     * @returns {Promise<QSVisualResult>}
     */
    async analyze(image, query, context = {}) {
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const mimeType = detectMimeType(image);
      const base64Image = Buffer.isBuffer(image)
        ? image.toString('base64')
        : image;

      const prompt = buildPrompt(query, context);

      const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

      const payload = {
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        }
      };

      try {
        const response = await axios.post(url, payload, {
          timeout: timeoutMs,
          headers: { 'Content-Type': 'application/json' }
        });

        const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse visual primitives from reasoning text
        const parsed = parseVisualPrimitives(rawText);

        // Extract JSON block
        const jsonResult = extractJsonBlock(rawText);

        // Merge primitives with structured result
        const result = mergeWithPrimitives(jsonResult, parsed, context);

        logger.info('Visual reasoning completed', {
          query: query.slice(0, 100),
          primitiveCount: parsed.primitives.length,
          avgConfidence: parsed.avgConfidence,
          roomCount: result.rooms?.length || 0
        });

        return result;

      } catch (err) {
        logger.error('Visual reasoning failed', { error: err.message, query: query.slice(0, 100) });
        throw err;
      }
    }
  };
}

// ─── Prompt Builder ───────────────────────────────────────────

function buildPrompt(query, context) {
  const parts = [VISUAL_PRIMITIVE_PROMPT];

  if (context.location) {
    parts.push(`Project location: ${context.location}`);
  }
  if (context.buildingType) {
    parts.push(`Building type: ${context.buildingType}`);
  }
  if (context.floors) {
    parts.push(`Number of floors: ${context.floors}`);
  }

  parts.push(`User query: ${query}`);
  parts.push('Analyze the drawing and provide visual primitives with your reasoning.');

  return parts.join('\n\n');
}

// ─── JSON Extraction ──────────────────────────────────────────

function extractJsonBlock(text) {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      logger.warn('Failed to parse JSON block', { error: e.message });
    }
  }

  // Fallback: try to find raw JSON object
  const rawMatch = text.match(/\{\s*"project_summary"[\s\S]*\}/);
  if (rawMatch) {
    try {
      return JSON.parse(rawMatch[0]);
    } catch (e) {
      logger.warn('Failed to parse raw JSON', { error: e.message });
    }
  }

  return {};
}

// ─── Merge Primitives with Structured Result ──────────────────

function mergeWithPrimitives(jsonResult, parsed, context) {
  const rooms = (jsonResult.rooms || []).map((room, idx) => {
    // Find matching primitive by name or index
    const boxPrimitive = parsed.primitives.find(
      (p) => p.type === 'box' && p.label.toLowerCase().includes(room.name?.toLowerCase())
    ) || parsed.primitives.filter((p) => p.type === 'box')[idx];

    return {
      ...room,
      primitiveId: boxPrimitive?.id || null,
      pixelCoords: boxPrimitive ? normalizedToPixel(boxPrimitive.coords, 1000, 1000) : null,
      confidence: boxPrimitive?.confidence || 0.5,
      elements: (room.elements || []).map((el) => {
        const elPrimitive = parsed.primitives.find(
          (p) => p.id === el.primitive_id || p.label === el.description
        );
        return {
          ...el,
          pixelCoords: elPrimitive ? normalizedToPixel(elPrimitive.coords, 1000, 1000) : null,
          confidence: elPrimitive?.confidence || 0.5
        };
      })
    };
  });

  // Calculate measurements if not provided
  const measurements = jsonResult.measurements || calculateMeasurements(rooms);

  return {
    reasoning: parsed.reasoning,
    primitives: parsed.primitives,
    rooms,
    measurements,
    suggestedBoqSections: jsonResult.suggested_boq_sections || [],
    warnings: jsonResult.warnings || [],
    confidence: jsonResult.confidence || 'medium',
    avgPrimitiveConfidence: parsed.avgConfidence,
    crossReferences: parsed.crossReferences,
    modelVersion: 'gemini-2.5-pro-exp-03-25',
    projectContext: context
  };
}

// ─── Measurement Calculations ─────────────────────────────────

function calculateMeasurements(rooms) {
  let totalBuiltUpArea = 0;
  let totalWallArea = 0;
  let estimatedConcreteVolume = 0;

  for (const room of rooms) {
    const area = room.area_m2 || (room.dimensions?.length_m * room.dimensions?.width_m) || 0;
    const height = room.dimensions?.height_m || 3.0;

    totalBuiltUpArea += area;

    // Wall area = perimeter × height - door/window openings (approx 15%)
    const perimeter = 2 * (room.dimensions?.length_m + room.dimensions?.width_m) || 0;
    const wallArea = perimeter * height * 0.85;
    totalWallArea += wallArea;

    // Concrete volume: assume 0.15m slab thickness for floor
    estimatedConcreteVolume += area * 0.15;
  }

  return {
    totalBuiltUpArea: Math.round(totalBuiltUpArea * 100) / 100,
    totalWallArea: Math.round(totalWallArea * 100) / 100,
    estimatedConcreteVolume: Math.round(estimatedConcreteVolume * 100) / 100
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function detectMimeType(image) {
  if (Buffer.isBuffer(image)) {
    // Simple magic number detection
    if (image[0] === 0xFF && image[1] === 0xD8) return 'image/jpeg';
    if (image[0] === 0x89 && image[1] === 0x50) return 'image/png';
    return 'image/jpeg';
  }
  if (typeof image === 'string') {
    if (image.startsWith('data:image/png')) return 'image/png';
    if (image.startsWith('data:image/jpeg')) return 'image/jpeg';
    if (image.startsWith('data:image/webp')) return 'image/webp';
  }
  return 'image/jpeg';
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  createQSVisualEngine,
  VISUAL_PRIMITIVE_PROMPT
};
