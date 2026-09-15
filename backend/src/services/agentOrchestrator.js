// ─── Multi-Agent Discussion Orchestrator ───────────────────────
// Manages multi-agent conversations for discussion scenes.
// Uses AI to decide speaker order and generate agent responses.

const { callAI } = require('./aiService');
const supabase = require('../config/supabase');
let logger;
try { logger = require('../utils/logger'); } catch { logger = console; }

function parseJSON(raw) {
  return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

// ─── Agent Personas ────────────────────────────────────────────
const AGENT_PERSONAS = {
  'Dr. Q': {
    name: 'Dr. Q',
    persona: 'Expert Nigerian Quantity Surveying teacher. Explains concepts clearly, references SMM7/NRM2/NIQS standards, uses Nigerian examples with ₦.',
    role: 'Moderator and educator'
  },
  'QS Practitioner': {
    name: 'QS Practitioner',
    persona: 'Experienced Nigerian QS with 15+ years practice on major projects in Lagos, Abuja, and Port Harcourt. Shares real-world war stories and practical insights.',
    role: 'Real-world perspective'
  },
  'Student': {
    name: 'Student',
    persona: 'Curious learner asking clarifying questions, representing the student perspective. Asks "why" and "how" questions.',
    role: 'Learner advocate'
  }
};

// ─── Create Session ────────────────────────────────────────────
async function createSession(lessonId, sceneId, userId, agents = ['Dr. Q', 'QS Practitioner', 'Student']) {
  const agentConfigs = agents.map(name => AGENT_PERSONAS[name] || { name, persona: name, role: 'Participant' });

  const { data, error } = await supabase
    .from('classroom_sessions')
    .insert({
      lesson_id: lessonId,
      scene_id: sceneId,
      user_id: userId,
      agents: agentConfigs,
      message_history: [],
      status: 'active',
      turn_count: 0
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create classroom session:', error.message);
    throw new Error(`Session creation failed: ${error.message}`);
  }

  return data;
}

// ─── Get Next Speaker ──────────────────────────────────────────
async function getNextSpeaker(sessionId, context = {}) {
  const { data: session } = await supabase
    .from('classroom_sessions')
    .select('agents, message_history, turn_count')
    .eq('id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  const agents = session.agents || [];
  const history = session.message_history || [];
  const turnCount = session.turn_count || 0;

  if (agents.length === 0) return null;

  // Simple round-robin with AI override for natural flow
  const lastSpeaker = history.length > 0 ? history[history.length - 1].agent : null;
  const candidates = agents.filter(a => a.name !== lastSpeaker);

  if (candidates.length === 0) return agents[0];

  // Ask AI to pick the best next speaker
  const prompt = `You are moderating a QS discussion. Choose the best next speaker.

Available agents: ${candidates.map(a => `${a.name} (${a.role})`).join(', ')}
Turn: ${turnCount + 1}
Last speaker: ${lastSpeaker || 'None (start)'}
Recent context: ${history.slice(-2).map(m => `${m.agent}: ${m.content?.substring(0, 100)}`).join(' | ') || 'Discussion just started'}

Output ONLY valid JSON: { "speaker": "Agent Name", "reason": "brief reason" }`;

  try {
    const raw = await callAI(prompt, { temperature: 0.3 });
    const result = parseJSON(raw);
    const chosen = candidates.find(a => a.name === result.speaker);
    return chosen || candidates[0];
  } catch (err) {
    // Fallback: round-robin
    return candidates[0];
  }
}

// ─── Generate Agent Response ───────────────────────────────────
async function generateAgentResponse(sessionId, agentName, topic, messageHistory = []) {
  const agent = AGENT_PERSONAS[agentName] || { name: agentName, persona: agentName, role: 'Participant' };

  const historyText = messageHistory
    .map(m => `${m.agent}: ${m.content}`)
    .join('\n');

  const prompt = `You are ${agent.name}, participating in a Nigerian Quantity Surveying discussion.

Your persona: ${agent.persona}
Your role: ${agent.role}
Topic: ${topic}

Discussion history:
${historyText || 'This is the opening of the discussion.'}

Generate your response. Stay in character. Reference Nigerian standards (SMM7, NRM2, NIQS) and use ₦ for costs where relevant. Be conversational but educational.

Output ONLY valid JSON:
{ "content": "Your response text...", "action": "speak|question|conclude" }`;

  try {
    const raw = await callAI(prompt, { temperature: 0.6 });
    const result = parseJSON(raw);

    // Append to session history
    const { data: session } = await supabase
      .from('classroom_sessions')
      .select('message_history, turn_count')
      .eq('id', sessionId)
      .single();

    if (session) {
      const newHistory = [...(session.message_history || []), { agent: agentName, content: result.content, action: result.action }];
      await supabase
        .from('classroom_sessions')
        .update({ message_history: newHistory, turn_count: (session.turn_count || 0) + 1 })
        .eq('id', sessionId);
    }

    return result;
  } catch (err) {
    logger.warn(`Agent response generation failed for ${agentName}:`, err.message);
    return { content: `As ${agent.name}, I believe this is an important consideration in Nigerian QS practice. Let me share my perspective...`, action: 'speak' };
  }
}

// ─── Orchestrate Full Discussion ───────────────────────────────
async function orchestrateDiscussion(sessionId, topic, turnCount = 6) {
  const { data: session } = await supabase
    .from('classroom_sessions')
    .select('agents, message_history')
    .eq('id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  const agents = session.agents || [];
  const messages = [];

  for (let i = 0; i < turnCount; i++) {
    const nextSpeaker = await getNextSpeaker(sessionId);
    if (!nextSpeaker) break;

    const response = await generateAgentResponse(
      sessionId,
      nextSpeaker.name,
      topic,
      session.message_history || []
    );

    messages.push({ agent: nextSpeaker.name, ...response });

    // Check for conclusion
    if (response.action === 'conclude') break;
  }

  // Mark session complete
  await supabase
    .from('classroom_sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId);

  return { sessionId, topic, messages, turnCount: messages.length };
}

module.exports = {
  createSession,
  getNextSpeaker,
  generateAgentResponse,
  orchestrateDiscussion,
  AGENT_PERSONAS
};
