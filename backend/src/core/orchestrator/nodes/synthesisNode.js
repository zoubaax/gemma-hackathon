const llmClient = require('../../lib/GemmaClient');

async function synthesisNode(state = {}) {
  const { 
    subAgentResponses = {}, 
    userMessage = '', 
    patientProfile = {}, 
    activeAgents = ['triage'], 
    domain = 'triage' 
  } = state || {};

  const safeResponses = subAgentResponses || {};
  const safeAgents = Array.isArray(activeAgents) ? activeAgents : ['triage'];

  const hasEmergency = Object.values(safeResponses).some(
    (r) => r && (r.isEmergency || r.status === 'danger' || r.status === 'CRITICAL' || r.severity === 'CRITICAL')
  );

  let followupTimeMinutes = null;
  let followupMessage = null;
  let options = null;

  // Extract followups, options, and direct reply fallbacks from sub-agents
  let directReplyFallback = '';
  for (const [agent, data] of Object.entries(safeResponses)) {
    if (data) {
      if (data.followup_time_minutes) {
        followupTimeMinutes = data.followup_time_minutes;
        followupMessage = data.followup_message || "I wanted to check on you. How are you feeling now?";
      }
      if (data.options) {
        options = data.options;
      }
      if (!directReplyFallback && data.reply) {
        directReplyFallback = data.reply;
      }
    }
  }

  const agentsSummary = Object.entries(safeResponses)
    .filter(([_, data]) => data && !data.error)
    .map(([agent, data]) => {
      let summary = `=== ${agent.toUpperCase()} ===\n`;
      if (data.reply) summary += `Reply: ${data.reply}\n`;
      if (data.status) summary += `Status: ${data.status}\n`;
      if (data.risk) summary += `Risk: ${data.risk}\n`;
      if (data.advice && Array.isArray(data.advice)) summary += `Advice: ${data.advice.join(' | ')}\n`;
      if (data.consult) summary += `Consult: ${data.consult}\n`;
      return summary;
    })
    .join('\n');

  const errorsList = Object.entries(safeResponses)
    .filter(([_, data]) => data && data.error)
    .map(([agent, data]) => `${agent}: ${data.error}`);

  const compactContext = llmClient.formatCompactProfile(patientProfile);

  const prompt = `You are the SHIFAA Synthesis Agent. Combine sub-agent outputs into ONE concise, compassionate response (2-3 sentences max).

## Patient Context
${compactContext}

## Agents Activated
${safeAgents.join(', ')}

## Domain
${domain || 'triage'}

## Agent Outputs
${agentsSummary || 'General health triage assessment'}

## Patient Message
"${userMessage}"

## Rules
1. CRITICAL CONCISENESS RULE: Be extremely concise and direct. Keep your entire response under 2 to 3 sentences maximum. No novels, no disclaimers.
2. Address the patient in the language they used (Arabic, French, English, Darija).
3. If ANY agent detected an emergency (${hasEmergency ? 'YES - emergency detected' : 'no emergency'}), alert the patient immediately to call emergency services.
4. PROACTIVE FOLLOW-UP: If any agent outputted a question offering a follow-up time, include it at the end.
5. DYNAMIC OPTIONS: If any agent outputted [OPTIONS: ...] or if you offer options, include [OPTIONS: Option1 | Option2] at the end.`;

  try {
    const rawContent = await llmClient.complete(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage },
      ],
      {
        model: process.env.LOCAL_LLM_MODEL || 'gemma4:e2b',
        maxTokens: 300,
        temperature: 0.2,
      }
    );

    let content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

    // Clean formatting tags
    const timeMatch = content.match(/\[FOLLOWUP_TIME_MINUTES:\s*([\d.]+)\]/);
    const secMatch = content.match(/\[FOLLOWUP_TIME_SECONDS:\s*([\d.]+)\]/);
    const msgMatch = content.match(/\[FOLLOWUP_MSG:\s*(.+?)\]/);

    if (secMatch) {
      followupTimeMinutes = parseFloat(secMatch[1]) / 60;
    } else if (timeMatch) {
      followupTimeMinutes = parseFloat(timeMatch[1]);
    }
    if (msgMatch) {
      followupMessage = msgMatch[1];
    }

    const optionsMatch = content.match(/\[OPTIONS:\s*(.+?)\]/);
    if (optionsMatch) {
      options = optionsMatch[1].split('|').map(o => o.trim()).filter(Boolean);
    }

    content = content
      .replace(/\[FOLLOWUP_TIME_MINUTES:\s*[\d.]+\]/g, '')
      .replace(/\[FOLLOWUP_TIME_SECONDS:\s*[\d.]+\]/g, '')
      .replace(/\[FOLLOWUP_MSG:\s*.+?\]/g, '')
      .replace(/\[OPTIONS:\s*.+?\]/g, '')
      .trim();

    // If synthesis returned empty content, use direct agent reply fallback
    if (!content) {
      content = directReplyFallback || "Je suis là pour vous accompagner. Comment puis-je vous aider davantage ?";
    }

    return {
      finalResponse: {
        text: content,
        isEmergency: hasEmergency,
        agentsUsed: safeAgents,
        followupTimeMinutes,
        followupMessage,
        options,
      },
    };
  } catch (error) {
    console.warn('⚠️ [Synthesis Node] Synthesis failed, using direct agent fallback:', error.message);
    return {
      finalResponse: {
        text: directReplyFallback || "Je suis là pour vous accompagner. Comment vous sentez-vous actuellement ?",
        isEmergency: hasEmergency,
        agentsUsed: safeAgents,
        followupTimeMinutes,
        followupMessage,
        options,
      },
      errors: [`Synthesis fallback used: ${error.message}`],
    };
  }
}

module.exports = { synthesisNode };
