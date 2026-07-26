const profileRepository = require('../../infra/repositories/ProfileRepository');
const chatPersistenceService = require('../../core/services/ChatPersistenceService');
const llmClient = require('../../core/lib/GemmaClient');

// ─── SAFETY GATEWAY CONFIGURATION ───────────────────────────────────────────
const TRIAGE_TIMEOUT_MS = 2000; // Fail-safe: if local Gemma E2B takes > 2s, default to danger=true
const TRIAGE_FAST_MODEL = process.env.LOCAL_LLM_FAST_MODEL || 'gemma4:e2b';

/**
 * PARANOID SYSTEM PROMPT for the Gemma E2B safety gateway.
 * The model is forced to classify vital danger ONLY — it does not converse.
 * Rule: When in doubt → danger_vital: true (fail towards safety, never silence).
 */
const TRIAGE_SYSTEM_PROMPT = `You are a medical emergency classifier. Your ONLY job is to detect vital danger.

IMMEDIATELY classify as DANGER if the patient mentions ANY of:
- Chest pain, tightness, pressure, or pain radiating to arm/jaw
- Difficulty breathing, shortness of breath, choking, suffocation
- Loss of consciousness, fainting, unresponsive, collapsing
- Severe bleeding, hemorrhage, major trauma
- Seizure, convulsion, stroke symptoms (sudden face drooping, arm weakness, speech difficulty)
- Severe allergic reaction (throat swelling, anaphylaxis)
- Suicidal thoughts or intention to harm self/others
- High fever in an infant under 3 months

ALSO classify as DANGER if:
- The message is unclear or ambiguous about severity → default to DANGER
- The message is in any language (Arabic, Darija, French, English, etc.)
- The system cannot understand the message → default to DANGER

Do NOT classify as DANGER for:
- Mild cold, runny nose, common headache, minor rash, sore throat
- Routine medication questions, appointment requests
- Follow-up questions after non-emergency situations

You MUST respond ONLY with valid JSON. No explanation, no text outside JSON.`;

const DANGER_DETECTION_SCHEMA = {
  name: 'vital_danger_classification',
  schema: {
    type: 'object',
    properties: {
      danger_vital: { type: 'boolean', description: 'true if the patient is in vital danger or if unsure' },
      raison: { type: 'string', description: 'Brief reason for the classification in the patient language' },
    },
    required: ['danger_vital', 'raison'],
    additionalProperties: false,
  },
};

// ─── EMERGENCY NUMBER LOOKUP ─────────────────────────────────────────────────
const COUNTRY_EMERGENCY_NUMBERS = {
  'Morocco': '150',
  'France': '15',
  'Algeria': '14',
  'Tunisia': '190',
  'United States': '911',
  'USA': '911',
  'Canada': '911',
  'United Kingdom': '999',
  'UK': '999',
  'Australia': '000',
  'Spain': '112',
  'Italy': '112',
  'Germany': '112',
  'Belgium': '112',
  'Switzerland': '144',
};

const getEmergencyNumber = (country) => {
  if (!country) return '112';
  if (COUNTRY_EMERGENCY_NUMBERS[country]) return COUNTRY_EMERGENCY_NUMBERS[country];
  const normalizedCountry = country.toLowerCase().trim();
  for (const [key, value] of Object.entries(COUNTRY_EMERGENCY_NUMBERS)) {
    if (key.toLowerCase() === normalizedCountry) return value;
  }
  return '112';
};

// ─── GEMMA E2B SAFETY GATEWAY CALL ──────────────────────────────────────────
/**
 * Calls the local Gemma 4 2B model to classify a patient message as vital danger or not.
 * Uses strict JSON schema enforcement so the model CAN ONLY output the expected format.
 * Returns: { danger_vital: boolean, raison: string }
 */
async function callVitalDangerClassifier(message) {
  const raw = await llmClient.completeFast(
    [
      { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
      { role: 'user', content: `Patient message: "${message}"` },
    ],
    {
      model: TRIAGE_FAST_MODEL,
      maxTokens: 100,
      temperature: 0.0, // Zero temperature = maximum determinism for safety decisions
      jsonSchema: DANGER_DETECTION_SCHEMA,
    }
  );

  // Parse the JSON output — if malformed, fail-safe triggers (see below)
  return JSON.parse(raw);
}

// ─── EMERGENCY MIDDLEWARE ────────────────────────────────────────────────────
const emergencyMiddleware = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      return next();
    }

    // ── GEMMA E2B SAFETY GATEWAY (with 2-second fail-safe) ─────────────────
    const triageResult = await Promise.race([
      callVitalDangerClassifier(message),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Triage classifier timeout')), TRIAGE_TIMEOUT_MS)
      ),
    ]).catch((err) => {
      // FAIL-SAFE: If Gemma E2B is down, times out, or returns malformed JSON,
      // we ALWAYS default to danger=true. It is better to trigger a false alarm
      // than to miss a real emergency.
      console.warn(`⚠️ [SAFETY GATEWAY FAIL-SAFE] ${err.message} → defaulting to danger_vital: true`);
      return { danger_vital: true, raison: `System fail-safe triggered: ${err.message}` };
    });

    console.log(`🛡️ [Safety Gateway] danger_vital=${triageResult.danger_vital} — ${triageResult.raison}`);

    if (triageResult.danger_vital) {
      console.log('🚨 EMERGENCY DETECTED by Gemma E2B:', triageResult.raison);

      let emergencyNumber = '112'; // International default

      // Lookup country-specific emergency number from user profile
      if (req.user && req.user.id) {
        try {
          const profile = await profileRepository.findByUserId(req.user.id);
          if (profile && profile.country) {
            emergencyNumber = getEmergencyNumber(profile.country);
          }
        } catch (err) {
          console.error('Error fetching profile for emergency number:', err);
        }
      }

      const emergencyResult = {
        isEmergency: true,
        emergencyNumber,
        status: 'danger',
        risk: 'high',
        raison: triageResult.raison,
        advice: [
          `Appelez immédiatement les secours (${emergencyNumber})`,
          'Ne restez pas seul.',
          "Si la personne est inconsciente, placez-la en position latérale de sécurité (PLS) si possible.",
        ],
        consult: `Appelez le ${emergencyNumber} (Urgences)`,
      };

      // Persist the exchange
      const chatTypeByPath = {
        '/api/chat': 'triage',
        '/api/pregnancy': 'pregnancy',
        '/api/allergy': 'allergy',
        '/api/children': 'children',
        '/api/medications': 'medications',
        '/api/orchestrator': 'orchestrator',
      };
      const chatType = chatTypeByPath[req.baseUrl];
      if (chatType && req.user?.id) {
        await chatPersistenceService.recordExchange({
          userId: req.user.id,
          chatType,
          message,
          result: emergencyResult,
        });
      }

      return res.status(200).json(emergencyResult);
    }

    // No vital danger — continue to regular controller (LangGraph + Gemma 4 12B)
    next();
  } catch (error) {
    console.error('Emergency Middleware Error:', error);
    // In case of unexpected error, pass through to avoid blocking the app
    next();
  }
};

module.exports = { emergencyMiddleware, getEmergencyNumber };
