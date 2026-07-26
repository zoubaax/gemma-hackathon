const { z } = require('zod');
const llmClient = require('../../lib/GemmaClient');

async function routerNode(state) {
  const { userMessage, patientProfile, messages } = state;

  // Context Minimization: Keep only 2 recent turns to maximize speed & KV-Cache hits
  const recentHistory = (messages || [])
    .slice(-2)
    .map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n');

  // Single-line compact profile for 90% input token reduction
  const compactProfile = llmClient.formatCompactProfile(patientProfile);

  const systemPrompt = `You are the SHIFAA Router. Select relevant agents: triage, pregnancy, pediatric, pharmacy, allergy, locator.

Patient Context: ${compactProfile}
Recent History: ${recentHistory || 'None'}

Rules:
1. If patient is pregnant OR asks about drug safety with current medications/allergies → include pharmacy.
2. If child symptoms → include pediatric.
3. Default to triage for general symptoms.

Respond ONLY in JSON: {"reasoning": "short reason", "agents": ["triage"], "primaryDomain": "triage"}`;

  try {
    const raw = await llmClient.completeFast(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        maxTokens: 150,
        temperature: 0.0,
        jsonSchema: true,
      }
    );

    const result = llmClient.parseJSON(raw, { agents: ['triage'], primaryDomain: 'triage' });

    const validAgents = ['triage', 'pregnancy', 'pediatric', 'pharmacy', 'allergy', 'locator'];
    const agents = (result.agents || ['triage']).filter((a) => validAgents.includes(a));
    const primaryDomain = result.primaryDomain || 'triage';

    return {
      activeAgents: agents.length > 0 ? agents : ['triage'],
      domain: primaryDomain,
    };
  } catch (error) {
    console.error('Router node error:', error.message);
    return {
      activeAgents: ['triage'],
      domain: 'triage',
      errors: [`Router failed: ${error.message}`],
    };
  }
}

module.exports = { routerNode };
