// ─── Lesson Outline Generator ──────────────────────────────────
// Generates a structured sequence of scenes for a given topic.

const { callAI } = require('./aiService');
const logger = require('../utils/logger');

function parseJSON(raw) {
  return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

/**
 * Generate a lesson outline (sequence of scenes) for a given topic.
 * @param {string} topic - The lesson topic
 * @param {string[]} targetSceneTypes - Allowed scene types to include
 * @param {string} difficulty - easy|medium|hard
 * @param {number} sceneCount - Target number of scenes
 * @returns {{ title, description, scenes: [{ scene_type, title, description, estimated_minutes }] }}
 */
async function generateLessonOutline(topic, targetSceneTypes = ['lecture', 'quiz'], difficulty = 'medium', sceneCount = 5) {
  const prompt = `You are Dr. Q, designing a lesson outline for Nigerian Quantity Surveying students.

Topic: ${topic}
Difficulty: ${difficulty}
Allowed scene types: ${targetSceneTypes.join(', ')}
Number of scenes: ${sceneCount}

Create a structured lesson outline. Each scene should build on the previous one.
Include a mix of learning approaches: lecture for theory, quiz for assessment, practice for application.

Output ONLY valid JSON:
{
  "title": "Lesson Title",
  "description": "Brief lesson description...",
  "scenes": [
    {
      "scene_type": "lecture|quiz|boq|rate_analysis|measurement|cost_plan|pbl|discussion",
      "title": "Scene Title",
      "description": "What this scene covers...",
      "estimated_minutes": 15
    }
  ]
}`;

  try {
    const raw = await callAI(prompt, { temperature: 0.4 });
    return { topic, difficulty, ...parseJSON(raw) };
  } catch (err) {
    logger.warn('Outline generation failed, using fallback:', err.message);
    return {
      title: `Understanding ${topic}`,
      description: `A structured lesson on ${topic} for Nigerian QS students, covering theory, assessment, and practical application.`,
      topic,
      difficulty,
      scenes: [
        { scene_type: 'lecture', title: `Introduction to ${topic}`, description: `Lecture covering the fundamentals of ${topic} with Nigerian QS examples.`, estimated_minutes: 15 },
        { scene_type: 'quiz', title: `Knowledge Check: ${topic}`, description: `MCQ and short answer questions to test understanding of ${topic}.`, estimated_minutes: 10 },
        { scene_type: 'boq', title: `Practical: BOQ Exercise`, description: `Apply ${topic} concepts in a BOQ preparation scenario.`, estimated_minutes: 20 },
        { scene_type: 'quiz', title: `Advanced Assessment`, description: `Deeper questions on ${topic} including Nigerian standards references.`, estimated_minutes: 10 },
        { scene_type: 'discussion', title: `Discussion: Real-World Application`, description: `Multi-agent discussion on how ${topic} applies in Nigerian construction practice.`, estimated_minutes: 10 }
      ]
    };
  }
}

module.exports = { generateLessonOutline };
