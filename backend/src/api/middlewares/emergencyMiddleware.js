const profileRepository = require('../../infra/repositories/ProfileRepository');
const chatPersistenceService = require('../../core/services/ChatPersistenceService');

const EMERGENCY_KEYWORDS = [
  /convulsion/i,
  /ne respire (pas|plus)/i,
  /bleu/i,
  /perte de connaissance/i,
  /évanoui/i,
  /evanoui/i,
  /inconscient/i,
  /sang/i,
  /hémorragie/i,
  /hemorragie/i,
  /étouffe/i,
  /etouffe/i,
  /douleur.*poitrine/i,
  /chest pain/i,
  /choking/i,
  /unconscious/i,
  /bleeding/i,
  /seizure/i
];

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
  // Europe default
  'Spain': '112',
  'Italy': '112',
  'Germany': '112',
  'Belgium': '112',
  'Switzerland': '144'
};

const getEmergencyNumber = (country) => {
  if (!country) return '112'; // Default fallback
  
  // Try exact match
  if (COUNTRY_EMERGENCY_NUMBERS[country]) {
    return COUNTRY_EMERGENCY_NUMBERS[country];
  }
  
  // Try case-insensitive matching
  const normalizedCountry = country.toLowerCase().trim();
  for (const [key, value] of Object.entries(COUNTRY_EMERGENCY_NUMBERS)) {
    if (key.toLowerCase() === normalizedCountry) {
      return value;
    }
  }

  // Default international standard
  return '112';
};

const emergencyMiddleware = async (req, res, next) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return next();
    }

    // Check for emergency keywords
    const isEmergency = EMERGENCY_KEYWORDS.some(regex => regex.test(message));

    if (isEmergency) {
      console.log('🚨 EMERGENCY DETECTED in message:', message);
      
      let emergencyNumber = '112'; // Default
      
      // Try to get country from user profile if authenticated
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
        advice: [
          `Appelez immédiatement les secours (${emergencyNumber})`,
          "Ne restez pas seul.",
          "Si la personne est inconsciente, placez-la en position latérale de sécurité (PLS) si possible."
        ],
        consult: `Appelez le ${emergencyNumber} (Urgences)`
      };

      const chatTypeByPath = {
        '/api/chat': 'triage',
        '/api/pregnancy': 'pregnancy',
        '/api/allergy': 'allergy',
        '/api/children': 'children',
        '/api/medications': 'medications',
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

    // No emergency, continue to regular controller
    next();
  } catch (error) {
    console.error('Emergency Middleware Error:', error);
    next(); // In case of error, default to normal processing so we don't break the app
  }
};

module.exports = { emergencyMiddleware, getEmergencyNumber };
