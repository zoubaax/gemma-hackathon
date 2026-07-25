const { ChatGroq } = require('@langchain/groq');
const { z } = require('zod');

function getRouterModel() {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    maxTokens: 512,
  });
}

const AgentSelectionSchema = z.object({
  reasoning: z.string().describe('Why these agents were selected'),
  agents: z.array(z.enum([
    'triage',
    'pregnancy',
    'pediatric',
    'pharmacy',
    'allergy',
    'locator',
  ])).describe('List of agents that should handle this request'),
  primaryDomain: z.enum([
    'triage',
    'pregnancy',
    'pediatric',
    'pharmacy',
    'allergy',
    'general',
  ]).describe('The primary medical domain of this request'),
});

async function routerNode(state) {
  const { userMessage, patientProfile, messages } = state;

  const recentHistory = messages
    .slice(-6)
    .map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n');

  const prompt = `You are the SHIFAA Orchestrator Router. Analyze the patient's message and decide which specialized AI agents should handle it.

Available agents:
- triage: General symptom assessment, urgency grading, any health concern
- pregnancy: Pregnancy-related symptoms, medication safety during pregnancy, maternal health
- pediatric: Child health concerns, pediatric symptoms, child medication safety
- pharmacy: Drug interactions, medication safety, side effects
- allergy: Allergic reactions, environmental allergies, respiratory symptoms
- locator: Finding nearby hospitals, clinics, pharmacies

Patient Profile:
- Age: ${patientProfile.age || 'Unknown'}
- Gender: ${patientProfile.gender || 'Unknown'}
- Chronic Conditions: ${patientProfile.chronicDiseases || 'None'}
- Current Medications: ${patientProfile.medications ? (Array.isArray(patientProfile.medications) ? patientProfile.medications.map(m => m.nom || m).join(', ') : patientProfile.medications) : 'None'}
- Allergies: ${patientProfile.drugAllergies || 'None known'}
- Is Pregnant: ${patientProfile.isPregnant ? 'Yes' : 'No'}
- Trimester: ${patientProfile.trimester || 'N/A'}
- Has Children: ${patientProfile.hasChildren ? 'Yes' : 'No'}
- City: ${patientProfile.city || 'Unknown'}
- Country: ${patientProfile.country || 'Unknown'}

Recent conversation:
${recentHistory || 'No prior conversation.'}

Patient message: "${userMessage}"

Rules:
1. Select ALL agents relevant to the request (can be multiple).
2. CRITICAL: Check the Patient Profile first. If the patient is pregnant (Is Pregnant: Yes) OR mentions pregnancy, AND asks about medication → select BOTH pregnancy AND pharmacy.
3. If the patient mentions a child + fever → select pediatric (and triage if severity unclear).
4. If the patient mentions an emergency (chest pain, bleeding, unconscious) → select triage (it handles emergencies).
5. Always include at minimum the most relevant primary domain agent.
6. "triage" is the fallback for any general medical question.
7. CRITICAL: If the patient asks about taking a medication, and their Profile lists 'Current Medications', ALWAYS select pharmacy to check for interactions, even if they don't explicitly mention their current meds.
8. CRITICAL: If the patient asks about taking a medication, and their Profile lists 'Allergies', ALWAYS select allergy and pharmacy.
9. You must respond in valid JSON format.`;

  const modelWithStructure = getRouterModel().withStructuredOutput(AgentSelectionSchema, {
    name: 'routeAgents',
  });

  try {
    const result = await modelWithStructure.invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage },
    ]);

    return {
      activeAgents: result.agents,
      domain: result.primaryDomain,
    };
  } catch (error) {
    console.error('Router node error:', error);
    return {
      activeAgents: ['triage'],
      domain: 'triage',
      errors: [`Router failed: ${error.message}`],
    };
  }
}

module.exports = { routerNode };
