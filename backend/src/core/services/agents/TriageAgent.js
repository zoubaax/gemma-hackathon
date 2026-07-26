const groq = require('../../lib/GemmaClient');
const skillLoader = require('../../lib/SkillLoader');

const TRIAGE_SCHEMA = {
  name: 'triage_assessment',
  schema: {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'Empathetic Arabic/Darija/French response directly to the patient' },
      severity: { type: 'string', description: 'LOW, MEDIUM, HIGH, or CRITICAL' },
      options: { type: 'array', items: { type: 'string' } }
    },
    required: ['reply', 'severity'],
    additionalProperties: false
  }
};

const SYSTEM_PROMPT = `You are the SHIFAA Triage Nurse. Reply to the patient in warm Arabic/Darija (or the language they used).

Clinical Instructions:
1. Address the patient in the exact language they used (Arabic/Darija, French, English).
2. Check Patient Medical Profile: If patient has a known condition (e.g. Thyroid Disorder, Levothyrox) and asks about neck swelling ("عنقي منفوخ"), explain gently in Arabic that it is likely a goiter related to their thyroid disorder, and advise consulting their doctor to review their Levothyrox dosage. Set severity: "LOW".
3. Classify as "CRITICAL" ONLY for acute crushing chest pain, active choking, or loss of consciousness.
4. Provide 2 short option chips in options array, e.g. ["نعم", "لا"].

Output ONLY JSON object: {"reply": "Write your exact patient message here", "severity": "LOW", "options": ["نعم", "لا"]}`;

class TriageAgent {
  async assess(history, patientProfile = {}) {
    const compactProfile = groq.formatCompactProfile(patientProfile);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + `\nPatient Context: ${compactProfile}` },
      ...history,
    ];

    const raw = await groq.completeFast(messages, { jsonSchema: TRIAGE_SCHEMA, temperature: 0.1 });
    const parsed = groq.parseJSON(raw, null);

    if (parsed && parsed.reply) {
      let replyText = parsed.reply;
      if (parsed.options && Array.isArray(parsed.options) && parsed.options.length > 0) {
        replyText += `\n[OPTIONS: ${parsed.options.join(' | ')}]`;
      }
      replyText += `\n[SEVERITY: ${parsed.severity || 'LOW'}]`;
      return replyText;
    }

    return raw;
  }

  getSeverity(replyText) {
    if (!replyText) return 'LOW';
    const match = replyText.match(/\[SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)\]/i);
    return match ? match[1].toUpperCase() : 'LOW';
  }
}

module.exports = new TriageAgent();
