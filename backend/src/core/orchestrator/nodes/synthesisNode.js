const { ChatGroq } = require('@langchain/groq');

function getSynthesisModel() {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 2048,
  });
}

async function synthesisNode(state) {
  const { subAgentResponses, userMessage, patientProfile, activeAgents, domain } = state;

  const hasEmergency = Object.values(subAgentResponses).some(
    (r) => r.isEmergency || r.status === 'danger' || r.status === 'CRITICAL' || r.severity === 'CRITICAL'
  );

  let followupTimeMinutes = null;
  let followupMessage = null;
  for (const [agent, data] of Object.entries(subAgentResponses)) {
    if (data && data.followup_time_minutes) {
      followupTimeMinutes = data.followup_time_minutes;
      followupMessage = data.followup_message || "I wanted to check on you. How are you feeling now?";
      break;
    }
  }

  const agentsSummary = Object.entries(subAgentResponses)
    .filter(([_, data]) => data && !data.error)
    .map(([agent, data]) => {
      let summary = `=== ${agent.toUpperCase()} AGENT ===\n`;
      if (data.reply) summary += `Reply: ${data.reply}\n`;
      if (data.severity) summary += `Severity: ${data.severity}\n`;
      if (data.status) summary += `Status: ${data.status}\n`;
      if (data.risk) summary += `Risk: ${data.risk}\n`;
      if (data.advice && Array.isArray(data.advice)) summary += `Advice: ${data.advice.join(' | ')}\n`;
      if (data.consult) summary += `Consult: ${data.consult}\n`;
      if (data.dosage_guidance) summary += `Dosage Guidance: ${data.dosage_guidance}\n`;
      if (data.message) summary += `Message: ${data.message}\n`;
      if (data.when_to_act) summary += `When to act: ${data.when_to_act}\n`;
      if (data.likely_cause) summary += `Likely cause: ${data.likely_cause}\n`;
      if (data.allergy_risk) summary += `Allergy risk: ${data.allergy_risk}\n`;
      return summary;
    })
    .join('\n');

  const errorsList = Object.entries(subAgentResponses)
    .filter(([_, data]) => data && data.error)
    .map(([agent, data]) => `${agent}: ${data.error}`);

  const patientContext = `
- Age: ${patientProfile.age || 'Unknown'}
- Gender: ${patientProfile.gender || 'Unknown'}
- Chronic Conditions: ${patientProfile.chronicDiseases || 'None'}
- Medications: ${patientProfile.medications ? (Array.isArray(patientProfile.medications) ? patientProfile.medications.map(m => m.nom || m).join(', ') : patientProfile.medications) : 'None'}
- Allergies: ${patientProfile.drugAllergies || 'None'}
- Pregnant: ${patientProfile.isPregnant ? 'Yes' : 'No'}
- Language: ${patientProfile.preferredLanguage || 'Auto-detect'}`;

  const prompt = `You are the SHIFAA Synthesis Agent. Your job is to combine outputs from multiple specialized medical AI agents into one coherent, compassionate, and safe response for the patient.

## Patient Context
${patientContext}

## Agents Activated
${activeAgents.join(', ')}

## Domain
${domain || 'general'}

## Agent Outputs
${agentsSummary}

${errorsList.length > 0 ? `## Errors (some agents failed - omit these from response)\n${errorsList.join('\n')}\n` : ''}

## Patient's Original Message
"${userMessage}"

## Instructions
1. Combine all agent insights into ONE natural, conversational response.
2. CRITICAL LANGUAGE RULE: If the patient explicitly requests a specific language in their message (e.g., "Answer in Arabic"), you MUST write your entire response in that requested language. Otherwise, address the patient in the language they used. Do not mix languages.
3. Structure the response clearly:
   - Start with a warm greeting and acknowledgment
   - Present the key findings/advice in simple terms
   - If multiple agents contributed, merge their advice coherently
   - End with next steps or when to seek help
4. If ANY agent detected an emergency (${hasEmergency ? 'YES - emergency detected' : 'no emergency'}):
   - Start with a clear emergency alert
   - Tell the patient to call emergency services immediately
   - Keep instructions simple and actionable
5. Do NOT mention "Agent" or internal system details to the patient.
6. Do NOT include raw JSON or technical information.
7. Be warm, professional, and culturally sensitive (use Salam/Labas as appropriate).
8. Keep the response concise but complete.
9. PROACTIVE FOLLOW-UP: If ANY agent's output ends with or includes a question offering a follow-up time (e.g., 'Would you like me to check on you in 2 hours?'), you MUST include that exact question at the very end of your response. Do not skip this!`;

  try {
    const response = await getSynthesisModel().invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage },
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    return {
      finalResponse: {
        text: content,
        isEmergency: hasEmergency,
        agentsUsed: activeAgents,
        followupTimeMinutes,
        followupMessage,
      },
    };
  } catch (error) {
    console.error('Synthesis node error:', error);
    return {
      finalResponse: {
        text: "I'm sorry, I encountered an error while processing your request. Please try again or contact support.",
        isEmergency: hasEmergency,
        agentsUsed: activeAgents,
        followupTimeMinutes: null,
        followupMessage: null,
      },
      errors: [`Synthesis failed: ${error.message}`],
    };
  }
}

module.exports = { synthesisNode };
