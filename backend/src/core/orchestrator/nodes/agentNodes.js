const triageAgent = require('../../services/agents/TriageAgent');
const pregnancySafetyService = require('../../services/PregnancySafetyService');
const childSafetyService = require('../../services/ChildSafetyService');
const drugSafetyService = require('../../services/DrugSafetyService');
const allergyAnalyzerService = require('../../services/AllergyAnalyzerService');

async function triageNode(state) {
  const { messages, patientProfile, userMessage } = state;
  try {
    const history = messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));
    const reply = await triageAgent.assess(history, patientProfile);
    const severity = triageAgent.getSeverity(reply);
    const timeMatch = reply.match(/\[FOLLOWUP_TIME_MINUTES:\s*(\d+)\]/);
    const msgMatch = reply.match(/\[FOLLOWUP_MSG:\s*(.+?)\]/);

    return {
      subAgentResponses: {
        triage: {
          reply,
          severity,
          isEmergency: severity === 'CRITICAL',
          followup_time_minutes: timeMatch ? parseInt(timeMatch[1], 10) : null,
          followup_message: msgMatch ? msgMatch[1] : null,
        },
      },
    };
  } catch (error) {
    return {
      subAgentResponses: {
        triage: { error: error.message },
      },
      errors: [`Triage agent failed: ${error.message}`],
    };
  }
}

async function pregnancyNode(state) {
  const { patientProfile, userMessage } = state;
  try {
    const trimester = patientProfile.trimester || '2';
    const result = await pregnancySafetyService.analyze({
      pregnant: true,
      trimester,
      symptoms: [userMessage],
      medication: patientProfile.currentMedication || '',
      food: '',
      profile: patientProfile,
      userMessage,
    });
    return {
      subAgentResponses: {
        pregnancy: {
          status: result.status,
          risk: result.risk,
          advice: result.advice,
          consult: result.consult,
          isEmergency: result.isEmergency,
          followup_time_minutes: result.followup_time_minutes,
          followup_message: result.followup_message,
          meta: result.meta,
        },
      },
    };
  } catch (error) {
    return {
      subAgentResponses: {
        pregnancy: { error: error.message },
      },
      errors: [`Pregnancy agent failed: ${error.message}`],
    };
  }
}

async function pediatricNode(state) {
  const { patientProfile, userMessage } = state;
  try {
    const childProfile = patientProfile.child || {};
    const result = await childSafetyService.analyze({
      message: userMessage,
      history: [],
      childProfile: {
        age_months: childProfile.ageMonths,
        weight_kg: childProfile.weightKg,
      },
      medication: patientProfile.currentMedication || '',
    });
    return {
      subAgentResponses: {
        pediatric: {
          status: result.status,
          risk: result.risk,
          dosage_guidance: result.dosage_guidance,
          advice: result.advice,
          consult: result.consult,
        },
      },
    };
  } catch (error) {
    return {
      subAgentResponses: {
        pediatric: { error: error.message },
      },
      errors: [`Pediatric agent failed: ${error.message}`],
    };
  }
}

async function pharmacyNode(state) {
  const { patientProfile, userMessage, messages } = state;
  try {
    const medications = patientProfile.medications
      ? (Array.isArray(patientProfile.medications)
        ? patientProfile.medications.map((m) => m.nom || m)
        : [patientProfile.medications])
      : [];

    const history = messages.map((m) => ({
      role: m.role,
      text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    const result = await drugSafetyService.checkInteraction({
      message: userMessage,
      history,
      medications,
      profile: patientProfile,
    });
    return {
      subAgentResponses: {
        pharmacy: {
          status: result.status,
          risk: result.risk,
          advice: result.advice,
          consult: result.consult,
          followup_time_minutes: result.followup_time_minutes,
          followup_message: result.followup_message,
          interactionsFound: result.meta?.interactionsFound || 0,
          warningsFound: result.meta?.warningsFound || 0,
        },
      },
    };
  } catch (error) {
    return {
      subAgentResponses: {
        pharmacy: { error: error.message },
      },
      errors: [`Pharmacy agent failed: ${error.message}`],
    };
  }
}

async function allergyNode(state) {
  const { patientProfile, userMessage } = state;
  try {
    const city = patientProfile.city || 'Casablanca';
    const result = await allergyAnalyzerService.check({
      symptoms: [userMessage],
      message: userMessage,
      history: [],
      city,
      profile: patientProfile,
    });
    return {
      subAgentResponses: {
        allergy: {
          status: result.status,
          allergy_risk: result.allergy_risk,
          likely_cause: result.likely_cause,
          advice: result.advice,
          message: result.message,
          when_to_act: result.when_to_act,
          followup_time_minutes: result.followup_time_minutes,
          followup_message: result.followup_message,
        },
      },
    };
  } catch (error) {
    return {
      subAgentResponses: {
        allergy: { error: error.message },
      },
      errors: [`Allergy agent failed: ${error.message}`],
    };
  }
}

const AGENT_MAP = {
  triage: triageNode,
  pregnancy: pregnancyNode,
  pediatric: pediatricNode,
  pharmacy: pharmacyNode,
  allergy: allergyNode,
};

async function agentRouterNode(state) {
  const { activeAgents } = state;
  if (!activeAgents || activeAgents.length === 0) {
    return {};
  }

  const uniqueAgents = [...new Set(activeAgents)];
  const results = await Promise.allSettled(
    uniqueAgents.map((agent) => {
      const nodeFn = AGENT_MAP[agent];
      if (!nodeFn) {
        return Promise.resolve({
          subAgentResponses: { [agent]: { error: `Unknown agent: ${agent}` } },
        });
      }
      return nodeFn(state);
    })
  );

  let mergedResponses = {};
  let mergedErrors = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      mergedResponses = { ...mergedResponses, ...result.value.subAgentResponses };
      if (result.value.errors) {
        mergedErrors = [...mergedErrors, ...result.value.errors];
      }
    } else {
      mergedErrors.push(`Agent execution failed: ${result.reason}`);
    }
  }

  return {
    subAgentResponses: mergedResponses,
    errors: mergedErrors.length > 0 ? mergedErrors : undefined,
  };
}

module.exports = {
  agentRouterNode,
  AGENT_MAP,
  triageNode,
  pregnancyNode,
  pediatricNode,
  pharmacyNode,
  allergyNode,
};
