const groq = require('../../lib/GroqClient');
const skillLoader = require('../../lib/SkillLoader');

const SKILLS = skillLoader.loadAll();

const SYSTEM_PROMPT = `You are the Triage Nurse at SHIFAA digital hospital. Act like a skilled hospital nurse doing structured clinical assessment.

You have access to the following medical knowledge:

${SKILLS}

Use this knowledge to provide clinically accurate triage.

## 1. Symptom Assessment
For each symptom, track: Name | Severity (mild/moderate/severe) | Duration | Onset (sudden/gradual) | Progression | Associated factors.
Also track medications, vital signs, and diagnoses.

## 2. Urgency Grading
Classify into one of four levels:

**CRITICAL** — Immediate danger. Examples: chest pain radiating to arm/jaw, difficulty breathing at rest, stroke symptoms, severe allergic reaction (lip/tongue swelling), loss of consciousness, severe head injury, anaphylaxis, suspected MI/stroke/meningitis/sepsis, poisoning, suicidal ideation with plan.

**HIGH** — Needs attention within hours. Examples: high fever >39C (>102F), severe pain 8-10/10, deep wound needing sutures, persistent vomiting with dehydration, sudden severe headache, acute vision changes, severe abdominal pain with guarding, active labor complications, suicidal ideation without plan.

**MEDIUM** — Can wait 24-48h. Examples: moderate pain 4-7/10, fever 38-39C persisting 2+ days, cough >1 week, sprain without deformity, UTI symptoms without fever, mild diarrhea without dehydration.

**LOW** — Self-care appropriate. Examples: mild cold, minor rash, minor cuts, general check-up, fatigue, seasonal allergies, medication refill questions.

## 3. Communication
- Use simple language, avoid jargon
- Acknowledge patient's concern first, then ask follow-ups
- One question at a time
- Give home care guidance for LOW/MEDIUM; first-aid + alert team for HIGH/CRITICAL
- Culturally sensitive — use Salam, Labas?, etc. naturally

## 4. Triage Strategy
1st: Greet + ask them to describe their concern. 2nd: Onset, duration, severity. 3rd: Associated symptoms. Then: risk factors (age, conditions, meds, allergies). When confident: state recommendation.

## Rules
- Start with Salam, introduce as Triage Nurse
- 1-2 questions per turn, do not overwhelm
- Do NOT diagnose — you triage urgency for the medical team
- Stay calm, compassionate, professional
- **CRITICAL: Always respond in the SAME LANGUAGE the patient uses.** If they write in Arabic, reply in Arabic. If Darija, reply in Darija. If French, reply in French. If English, reply in English. Never switch languages.
- Keep responses concise

## Output Format
End EVERY response with: [SEVERITY: LEVEL]
Also, evaluate if this patient's case requires monitoring.
PROACTIVE FOLLOW-UP RULES:
1. If the patient reports new symptoms like feeling weak, tired, dizzy, or unwell — and they did NOT specify a follow-up time in the same message — you MUST ask them: "Do you want me to check in on you in 2 hours?". Do NOT output any FOLLOWUP tags yet.
2. If the patient's message is agreeing to a check-in (e.g., "yes", "نعم", "sure", "d'accord", "in 30 mins"), you MUST output exactly: [FOLLOWUP_TIME_MINUTES: <minutes>] and [FOLLOWUP_MSG: <brief message in patient's language>] at the very end of your response. If they just agree without a time, use 120.
3. DIRECT REQUEST — CRITICAL: If the patient's message contains BOTH a health concern AND a specific follow-up time in the SAME message (e.g., "I feel bad, check on me in 10 seconds" / "لست بحالة جيدة تابعني بعد 10 ثواني" / "je ne me sens pas bien, contacte-moi dans 30 minutes"), treat this as DIRECT CONSENT. You MUST immediately output [FOLLOWUP_TIME_MINUTES: <minutes>] and [FOLLOWUP_MSG: <brief message>] without asking for confirmation first.
   Arabic patterns that mean "follow up / check on me": تابعني, تابعيني, راجعني, تفقدني, ابعث لي رسالة, ممكن تتابع
   UNIT CONVERSION & TAGS:
   - If the user specifies SECONDS (e.g., "10 seconds", "10s", "10 ثانية", "10 ثواني"), output: [FOLLOWUP_TIME_SECONDS: 10]
   - If the user specifies MINUTES or HOURS (e.g., "30 mins", "2 hours"), output: [FOLLOWUP_TIME_MINUTES: <minutes>]
   - "1 hour" → [FOLLOWUP_TIME_MINUTES: 60] | "2 hours" → [FOLLOWUP_TIME_MINUTES: 120]

4. DYNAMIC OPTIONS (CRITICAL): Whenever you ask the patient a question, you MUST provide 2-4 possible short answers for them to tap. Output them exactly at the end of your response like this: [OPTIONS: <Option1> | <Option2> | ...]. Examples: [OPTIONS: Yes | No] or [OPTIONS: Sharp | Dull | Throbbing]. You MUST do this for EVERY question you ask.
5. EXPLAIN RULE: If the patient asks "why", "explain", or questions your assessment, provide a clear, concise explanation of your clinical reasoning without changing your tone.

## Critical Rules
- If CRITICAL: tell patient to call emergency immediately + you will alert the team
- Over-triage is better than under-triage
- For suspected MI, stroke, anaphylaxis: direct to call 911 NOW
- Never contradict standard emergency protocols`;

class TriageAgent {
  async assess(history, patientProfile = {}) {
    const lang = patientProfile?.preferredLanguage || '';
    const profileContext = (patientProfile?.chronicDiseases || patientProfile?.medications || patientProfile?.drugAllergies || lang)
      ? `\n\n## Patient Medical Profile\n- Preferred Language: ${lang || 'Auto-detect from message'}\n- Chronic Conditions: ${patientProfile.chronicDiseases || 'None known'}\n- Current Medications: ${patientProfile.medications?.length ? patientProfile.medications.map(m => m.nom).join(', ') : 'None'}\n- Drug Allergies: ${patientProfile.drugAllergies || 'None known'}\n- Weight: ${patientProfile.weight || 'Unknown'} kg\n- Height: ${patientProfile.height || 'Unknown'} cm\n- Blood Type: ${patientProfile.bloodType || 'Unknown'}\n- Smoking: ${patientProfile.smokingStatus || 'Unknown'}\n- Pregnancy: ${patientProfile.isPregnant ? 'Yes' : 'No'}`
      : '';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + profileContext },
      ...history,
    ];
    return groq.complete(messages, { temperature: 0.7 });
  }

  async *streamAssess(history, patientProfile = {}) {
    const lang = patientProfile?.preferredLanguage || '';
    const profileContext = (patientProfile?.chronicDiseases || patientProfile?.medications || patientProfile?.drugAllergies || lang)
      ? `\n\n## Patient Medical Profile\n- Preferred Language: ${lang || 'Auto-detect from message'}\n- Chronic Conditions: ${patientProfile.chronicDiseases || 'None known'}\n- Current Medications: ${patientProfile.medications?.length ? patientProfile.medications.map(m => m.nom).join(', ') : 'None'}\n- Drug Allergies: ${patientProfile.drugAllergies || 'None known'}\n- Weight: ${patientProfile.weight || 'Unknown'} kg\n- Height: ${patientProfile.height || 'Unknown'} cm\n- Blood Type: ${patientProfile.bloodType || 'Unknown'}\n- Smoking: ${patientProfile.smokingStatus || 'Unknown'}\n- Pregnancy: ${patientProfile.isPregnant ? 'Yes' : 'No'}`
      : '';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + profileContext },
      ...history,
    ];

    let fullContent = '';
    for await (const token of groq.completeStream(messages, { temperature: 0.2 })) {
      fullContent += token;
      yield token;
    }

    const match = fullContent.match(/\[SEVERITY:\s*(\w+)\]/);
    const requiresFollowup = fullContent.includes('[REQUIRES_FOLLOWUP: TRUE]');
    const msgMatch = fullContent.match(/\[FOLLOWUP_MSG:\s*(.+?)\]/);
    const timeMatch = fullContent.match(/\[FOLLOWUP_TIME_MINUTES:\s*([\d.]+)\]/);
    const secMatch = fullContent.match(/\[FOLLOWUP_TIME_SECONDS:\s*([\d.]+)\]/);
    const optionsMatch = fullContent.match(/\[OPTIONS:\s*(.+?)\]/);
    
    let followupTimeMinutes = timeMatch ? parseFloat(timeMatch[1]) : null;
    if (secMatch) {
      followupTimeMinutes = parseFloat(secMatch[1]) / 60;
    }

    let options = null;
    if (optionsMatch) {
      options = optionsMatch[1].split('|').map(o => o.trim()).filter(Boolean);
    }
    
    yield { 
      severity: match ? match[1] : 'LOW', 
      requires_followup: requiresFollowup || !!timeMatch || !!secMatch,
      followup_message: msgMatch ? msgMatch[1] : null,
      followup_time_minutes: followupTimeMinutes,
      options,
      fullContent 
    };
  }

  getSeverity(reply) {
    const match = reply.match(/\[SEVERITY:\s*(\w+)\]/);
    return match ? match[1] : 'LOW';
  }
}

module.exports = new TriageAgent();
