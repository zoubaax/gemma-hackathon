/**
 * GemmaClient - Local LLM client optimized for Gemma 4 (Ollama / vLLM).
 * 
 * Features:
 *   - Automatic <think>...</think> tag cleaning for reasoning models
 *   - Robust JSON extraction helper
 *   - Single-line compact patient profile formatter for input token reduction
 *   - KV-Cache friendly prompt ordering
 */
class GemmaClient {
  constructor() {
    this.baseUrl = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434/v1/chat/completions';
    this.model = process.env.LOCAL_LLM_MODEL || 'gemma4:e2b';
    this.fastModel = process.env.LOCAL_LLM_FAST_MODEL || 'gemma4:e2b';
    this.apiKey = process.env.LOCAL_LLM_API_KEY || 'ollama';
  }

  /**
   * Compact Patient Profile Formatter:
   * Compresses multi-line 15-key profile objects into a single 1-line string.
   * Reduces prompt input tokens by 90% and optimizes KV-Cache reuse.
   */
  formatCompactProfile(profile = {}) {
    const age = profile.age || (profile.dateOfBirth ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear() : '?');
    const gender = profile.gender ? profile.gender.charAt(0).toUpperCase() : '?';
    const chronic = profile.chronicDiseases || 'None';
    const meds = profile.medications ? (Array.isArray(profile.medications) ? profile.medications.map(m => m.nom || m).join(', ') : profile.medications) : 'None';
    const allergies = profile.drugAllergies || 'None';
    const preg = profile.isPregnant ? `Yes (Trim ${profile.trimester || '1'})` : 'No';

    return `[Patient: ${gender}, ${age}y | Meds: ${meds} | Allergies: ${allergies} | Chronic: ${chronic} | Pregnant: ${preg}]`;
  }

  /**
   * Safe JSON parser with auto-extraction of structured JSON objects.
   */
  parseJSON(input, fallback = {}) {
    if (!input || typeof input !== 'string') return fallback;
    const cleaned = input.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e1) {
      // Find JSON object starting with a known key (reply, severity, danger_vital, etc.) or standard brace
      const jsonMatch = cleaned.match(/\{\s*"(?:reply|severity|danger_vital|status|risk|reason|raison)"[\s\S]*?\}/i) 
                     || cleaned.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {}
      }
      return fallback;
    }
  }

  /**
   * Non-streaming completion. Used for structured JSON outputs (router, safety gateway, agents).
   */
  async complete(messages, options = {}) {
    const payload = {
      model: options.model || this.model,
      messages,
      stream: false,
      max_tokens: options.maxTokens ?? 250, // Capped low for sub-second execution
      temperature: options.temperature ?? 0.1,
      top_p: options.topP ?? 0.95,
      think: false,
    };

    if (options.jsonSchema) {
      payload.response_format = {
        type: 'json_object',
      };
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemma Local API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const msg = data.choices?.[0]?.message || {};
    let content = msg.content || msg.reasoning || '';

    // Strip Gemma 4 reasoning/thinking preambles & tags
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (/^\s*\*|\d+\.\s*\*\*|^Thinking Process:/i.test(content)) {
      const lines = content.split('\n');
      const cleanLines = lines.filter(l => {
        const trimmed = l.trim();
        if (/^\d+\.\s*\*\*/.test(trimmed)) return false;
        if (/^Thinking Process:/i.test(trimmed)) return false;
        if (/^\*\s*(?:Task|Constraint|Clinical|Sentence|Patient|Step|Reasoning|Check|Action|Greeting|Rule|CRITICAL)/i.test(trimmed)) return false;
        if (/^(?:Analyze|Determine|Formulate|Apply|Draft|Synthesize)/i.test(trimmed)) return false;
        return true;
      });
      if (cleanLines.length > 0) {
        content = cleanLines.join('\n').trim();
      }
    }

    return content;
  }

  /**
   * Fast completion using the small router/safety model (Gemma 4 E2B).
   */
  async completeFast(messages, options = {}) {
    return this.complete(messages, { maxTokens: 700, ...options, model: this.fastModel });
  }

  /**
   * Streaming completion — used for the main patient chat synthesis.
   */
  async *completeStream(messages, options = {}) {
    const payload = {
      model: options.model || this.model,
      messages,
      stream: true,
      max_tokens: options.maxTokens ?? 300,
      temperature: options.temperature ?? 0.2,
      top_p: options.topP ?? 0.95,
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemma Local API error ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') return;

          try {
            const chunk = JSON.parse(jsonStr);
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) yield content;
          } catch {}
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

module.exports = new GemmaClient();
