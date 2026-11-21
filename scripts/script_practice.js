'use strict';

(function () {

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MASTERY_STREAK = 3;
const PBKDF2_ITERATIONS = 600000;
const STORAGE_PREFIX = 'script_practice.';

// Cheapest first. The live list from the provider's models endpoint replaces these once a key is unlocked;
// any of these that the provider lists are kept at the top, in this order.
const PREFERRED_MODELS = {
    claude: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
    openai: ['gpt-5.4-nano', 'gpt-5-nano', 'gpt-5.4-mini', 'gpt-5-mini'],
    gemini: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    openrouter: ['deepseek/deepseek-v4-flash', 'google/gemini-3.5-flash-lite', 'openai/gpt-5.4-nano', 'anthropic/claude-haiku-5.5'],
};

// official guides on creating an API key for each provider
const KEY_GUIDES = {
    claude: {name: 'Claude', url: 'https://platform.claude.com/docs/en/get-api-key'},
    openai: {name: 'OpenAI', url: 'https://platform.openai.com/api-keys'},
    gemini: {name: 'Gemini', url: 'https://ai.google.dev/gemini-api/docs/api-key'},
    deepseek: {name: 'DeepSeek', url: 'https://platform.deepseek.com/api_keys'},
    openrouter: {name: 'OpenRouter', url: 'https://openrouter.ai/workspaces/default/keys'},
};

const DIFFICULTIES = [
    {id: 'word', label: 'Single word', prompt: 'exactly one word (no sentence, no punctuation)', generateMaxTokens: 3000, gradeMaxTokens: 8000, slots: 2},
    {id: 'phrase', label: 'Short phrase (2–4 words)', prompt: 'a short phrase of 2 to 4 words', generateMaxTokens: 3000, gradeMaxTokens: 8000, slots: 3},
    {id: 'sentence', label: 'Sentence (~6–12 words)', prompt: 'one sentence of roughly 6 to 12 words', generateMaxTokens: 4000, gradeMaxTokens: 12000, slots: 5},
    {id: 'long', label: 'Long sentence (~15–25 words)', prompt: 'one long sentence of roughly 15 to 25 words', generateMaxTokens: 6000, gradeMaxTokens: 16000, slots: 7},
    {id: 'paragraph', label: 'Paragraph (3–5 sentences)', prompt: 'a short paragraph of 3 to 5 connected sentences', generateMaxTokens: 10000, gradeMaxTokens: 24000, slots: 10},
];

const TOPICS = [
    'food and cooking', 'travel', 'the weather', 'family', 'work', 'hobbies', 'a city', 'nature', 'shopping',
    'school', 'health', 'history', 'sport', 'music', 'technology', 'animals', 'holidays', 'friends', 'the home',
    'transport', 'films and books', 'the seasons', 'a restaurant', 'a market', 'the countryside',
];

// ---------------------------------------------------------------------------
// Script definitions
// ---------------------------------------------------------------------------
// The model's own knowledge of each language covers the letters, their frequency and how they are romanized, so
// these definitions only hold what the page itself needs: how to split text into symbols, and a few notes.

const chars = s => Array.from(s);

// Each distinct character matching the pattern is a symbol, exactly as written (no case folding), so capitals,
// accented forms, final forms etc. are tracked separately.
function characterSymbolsOf(pattern) {
    return function (text) {
        return Array.from(new Set(chars(text.normalize('NFC')).filter(c => pattern.test(c))));
    };
}

// Tables for splitting precomposed Hangul syllables into compatibility jamo
const HANGUL_INITIALS = chars('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ');
const HANGUL_VOWELS = chars('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ');
const HANGUL_FINALS = [''].concat(chars('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'));

function hangulSymbolsOf(text) {
    const seen = new Set();
    for (const c of chars(text.normalize('NFC'))) {
        const cp = c.codePointAt(0);
        if (cp >= 0x3131 && cp <= 0x3163) { // a lone compatibility jamo
            seen.add(c);
            continue;
        }
        const code = cp - 0xAC00;
        if (code < 0 || code >= 11172) continue;
        seen.add(HANGUL_INITIALS[Math.floor(code / 588)]);
        seen.add(HANGUL_VOWELS[Math.floor((code % 588) / 28)]);
        const fin = HANGUL_FINALS[code % 28];
        if (fin) seen.add(fin);
    }
    return Array.from(seen);
}

const LETTER_VARIANTS = 'a single letter exactly as written, so different forms of the same letter (such as uppercase and lowercase, or with and without an accent) are different symbols';

const SCRIPTS = [
    {
        id: 'greek',
        name: 'Greek alphabet',
        language: 'Greek',
        lang: 'el',
        hasCase: true,
        symbolsOf: characterSymbolsOf(/\p{Script=Greek}/u),
        symbolDescription: LETTER_VARIANTS,
        writingNotes: 'Use correct modern spelling with accents, and include capital letters naturally (sentence starts, names).',
        gradingNotes: [
            'Accents and diaereses may be kept (ά→á) or dropped (ά→a); both are correct.',
            'Accepted values where the common systems differ: η as i or ī; ω as o or ō; υ as y or i; αυ/ευ as au/eu or av/ev/af/ef; γγ as ng or gg; γκ, μπ and ντ at the start of a word as g, b and d or as gk, mp and nt. Other values (such as β as b, or η as e) are mistakes.',
        ],
    },
    {
        id: 'cyrillic',
        name: 'Cyrillic alphabet (Russian)',
        language: 'Russian',
        lang: 'ru',
        hasCase: true,
        symbolsOf: characterSymbolsOf(/\p{Script=Cyrillic}/u),
        symbolDescription: LETTER_VARIANTS,
        writingNotes: 'Include capital letters naturally (sentence starts, names), and always write ё with its dots.',
        gradingNotes: [
            'Accept the values of the common systems (ISO 9, scientific, BGN/PCGN), e.g. ж as zh or ž, х as kh or h, ц as ts or c, щ as shch or ŝ, я as ya, ja or â, й as y or j.',
            'е may be e or ye. ё may be ë, yo or jo, but not plain e.',
            'ь and ъ must be written, as \' and " or as ʹ and ʺ.',
        ],
    },
    {
        id: 'hangul',
        name: 'Hangul (Korean)',
        language: 'Korean',
        lang: 'ko',
        hasCase: false,
        separator: '·',
        symbolsOf: hangulSymbolsOf,
        symbolDescription: 'a single jamo inside a syllable block, written as a compatibility jamo such as ㄱ or ㅏ (a double final consonant such as ㄺ is one symbol)',
        writingNotes: 'Write in Hangul syllable blocks only.',
        gradingNotes: [
            'Use Revised Romanization. Accept it either with its sound changes across syllables (국물 gungmul) or syllable by syllable (gukmul), but nothing else.',
            'Consonants have fixed values by position: ㄹ is r before a vowel and l at the end of a syllable (ㄹㄹ is ll); ㄱ ㄷ ㅂ are g d b before a vowel and k t p at the end of a syllable, unless a sound change applies. Using the value from the wrong position is a mistake.',
        ],
    },
    {
        id: 'kana',
        name: 'Hiragana & Katakana (Japanese)',
        language: 'Japanese',
        lang: 'ja',
        hasCase: false,
        separator: '·',
        symbolsOf: characterSymbolsOf(/[\p{Script=Hiragana}\p{Script=Katakana}ー]/u),
        symbolDescription: 'a single kana exactly as written, so hiragana and katakana are different symbols, and small kana and ー are symbols of their own',
        writingNotes: 'Write only in kana, never kanji: hiragana for native words and katakana for loanwords and foreign names, as they would naturally be written (minus kanji). Try to include more katakana words than usual if there\'s room.',
        gradingNotes: [
            'Accept Hepburn and Kunrei-shiki values (し shi or si, ち chi or ti, つ tsu or tu, ふ fu or hu, じ ji or zi).',
            'Long vowels must be marked: with a macron (ō) or circumflex (ô), or by writing the kana as spelled (おう ou, ええ ee, ー as a doubled vowel). Writing a long vowel as a plain short vowel is a mistake.',
            'The particles は, へ and を may be written wa, e, o or ha, he, wo.',
            'ん may be n, n\' before a vowel, or m before b, m and p.',
        ],
        palette: ['ā', 'ī', 'ū', 'ē', 'ō'],
    },
];
const SCRIPTS_BY_ID = Object.fromEntries(SCRIPTS.map(s => [s.id, s]));

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function lsGet(key, fallback) {
    try {
        const value = localStorage.getItem(STORAGE_PREFIX + key);
        return value === null ? fallback : JSON.parse(value);
    } catch (e) {
        return fallback;
    }
}

function lsSet(key, value) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
        // storage unavailable; settings just won't persist
    }
}

function lsRemove(key) {
    try {
        localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
        // ignore
    }
}

// ---------------------------------------------------------------------------
// Encrypted key storage
// ---------------------------------------------------------------------------

const unlockedKeys = {}; // provider -> API key, in memory only

function toBase64(bytes) {
    let binary = '';
    new Uint8Array(bytes).forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
}

function fromBase64(str) {
    return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function deriveKey(passphrase, salt) {
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        {name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256'},
        baseKey,
        {name: 'AES-GCM', length: 256},
        false,
        ['encrypt', 'decrypt']);
}

async function encryptApiKey(apiKey, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv: iv}, key, new TextEncoder().encode(apiKey));
    return {salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(ct)};
}

async function decryptApiKey(stored, passphrase) {
    const key = await deriveKey(passphrase, fromBase64(stored.salt));
    const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: fromBase64(stored.iv)}, key, fromBase64(stored.ct));
    return new TextDecoder().decode(pt);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const settings = {
    provider: lsGet('provider', 'claude'),
    effort: lsGet('effort', 'low'),
    // the old single setting only ever mattered for generation
    generateMaxTokens: lsGet('generateMaxTokens', lsGet('maxTokens', null)),
    gradeMaxTokens: lsGet('gradeMaxTokens', null),
    skipExact: lsGet('skipExact', true),
    script: lsGet('script', 'greek'),
    difficulty: lsGet('difficulty', 'sentence'),
};
if (!PREFERRED_MODELS[settings.provider]) settings.provider = 'claude';
if (!SCRIPTS_BY_ID[settings.script]) settings.script = 'greek';
if (!DIFFICULTIES.some(d => d.id === settings.difficulty)) settings.difficulty = 'sentence';

function saveSetting(name, value) {
    settings[name] = value;
    lsSet(name, value);
}

function currentScript() {
    return SCRIPTS_BY_ID[settings.script];
}

function currentDifficulty() {
    return DIFFICULTIES.find(d => d.id === settings.difficulty);
}

function modelList(provider) {
    return lsGet('models.' + provider, null) || PREFERRED_MODELS[provider];
}

function currentModel() {
    const provider = settings.provider;
    const selected = lsGet('model.' + provider, null);
    if (selected === '__custom__') return (lsGet('customModel.' + provider, '') || '').trim();
    const list = modelList(provider);
    return selected && list.includes(selected) ? selected : list[0];
}

// Grading reasons about every symbol, so it gets a larger budget that also grows with the reasoning effort.
const GRADE_EFFORT_FACTOR = {low: 1, medium: 1.5, high: 2};
const MAX_AUTO_TOKENS = 32000;

function autoMaxTokens(purpose) {
    const difficulty = currentDifficulty();
    if (purpose === 'generate') return difficulty.generateMaxTokens;
    return Math.min(MAX_AUTO_TOKENS, Math.round(difficulty.gradeMaxTokens * (GRADE_EFFORT_FACTOR[settings.effort] || 1)));
}

function currentMaxTokens(purpose) {
    return settings[purpose + 'MaxTokens'] || autoMaxTokens(purpose);
}

// ---------------------------------------------------------------------------
// LLM providers
// ---------------------------------------------------------------------------

const usage = {requests: 0, input: 0, output: 0, last: null};
let requestStart = 0;
let headersAt = 0;

function recordUsage(input, output) {
    usage.requests++;
    usage.input += input || 0;
    usage.output += output || 0;
    const now = performance.now();
    usage.last = {
        total: (now - requestStart) / 1000,
        waiting: (headersAt - requestStart) / 1000,
        output: output || 0,
    };
    console.log('LLM request: ' + usage.last.total.toFixed(1) + ' s total, '
        + usage.last.waiting.toFixed(1) + ' s until headers, ' + usage.last.output + ' output tokens');
    renderUsage();
}

async function readJsonResponse(res) {
    headersAt = performance.now();
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        // non-JSON body
    }
    if (!res.ok) {
        const message = data && data.error && (data.error.message || data.error.type);
        const error = new Error('The provider returned an error (HTTP ' + res.status + ')' + (message ? ': ' + message : '.'));
        error.status = res.status;
        throw error;
    }
    if (!data) throw new Error('The provider returned an unreadable response.');
    return data;
}

function parseModelJson(text) {
    if (!text) throw new Error('The model returned an empty response.');
    try {
        return JSON.parse(text);
    } catch (e) {
        // some models wrap JSON in a code fence despite structured output
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error('The model did not return valid JSON.');
    }
}

// Reads a server-sent event stream, calling onEvent(eventName, data) for each event. Comment lines (which some
// providers send as keep-alives) are ignored.
async function readEventStream(res, onEvent) {
    if (!res.ok) await readJsonResponse(res); // throws the provider's error
    headersAt = performance.now();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = '';
    let data = [];
    const dispatch = () => {
        if (data.length) onEvent(eventName, data.join('\n'));
        eventName = '';
        data = [];
    };
    const processLine = line => {
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line === '') return dispatch();
        if (line.startsWith(':')) return;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        let value = colon < 0 ? '' : line.slice(colon + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'event') eventName = value;
        else if (field === 'data') data.push(value);
    };
    try {
        for (;;) {
            const {value, done} = await reader.read();
            buffer += decoder.decode(value, {stream: !done});
            const lines = buffer.split('\n');
            buffer = done ? '' : lines.pop();
            lines.forEach(processLine);
            if (done) {
                dispatch();
                return;
            }
        }
    } catch (e) {
        reader.cancel().catch(() => {});
        throw e;
    }
}

function parseEventData(data) {
    try {
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

function streamError(message) {
    return new Error('The provider returned an error' + (message ? ': ' + message : '.'));
}

function claudeVersion(model) {
    const m = model.match(/^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?/);
    if (!m) return null;
    return {family: m[1], major: parseInt(m[2], 10), minor: m[3] && m[3].length <= 2 ? parseInt(m[3], 10) : 0};
}

function claudeSupportsEffort(model) {
    const v = claudeVersion(model);
    if (!v) return false;
    if (v.major >= 5) return true;
    return v.major === 4 && (v.minor >= 6 || (v.minor === 5 && v.family === 'opus'));
}

// Adaptive thinking exists from the 4.6 models on; from Opus 4.7 the thinking text is hidden unless asked for.
function claudeThinkingConfig(model) {
    const v = claudeVersion(model);
    if (!v || (v.major < 5 && !(v.major === 4 && v.minor >= 6))) return null;
    const thinking = {type: 'adaptive'};
    if (v.major >= 5 || v.minor >= 7) thinking.display = 'summarized';
    return thinking;
}

const CUT_OFF_MESSAGE = 'The response was cut off. Increase the max output tokens in the credit-saving options, or lower the reasoning effort.';

// `effort` is 'low', 'medium' or 'high', or 'none' to ask for as little reasoning as the model allows.

// The streaming parts of each provider report what they receive to `progress`:
// progress.reasoning(text) for reasoning (possibly empty, meaning "reasoning has started"),
// progress.section() between separate pieces of reasoning, and progress.text(text) for the answer itself.

// OpenAI's chat completions API, which several other providers also implement
function openAICompatible(options) {
    const jsonSchema = options.jsonSchema !== false;
    return {
        async call(apiKey, model, system, user, schema, maxTokens, effort, progress) {
            if (!jsonSchema) {
                system += '\n\nRespond with only a JSON object that matches this JSON schema:\n' + JSON.stringify(schema);
            }
            const body = {
                model: model,
                messages: [{role: 'system', content: system}, {role: 'user', content: user}],
                max_tokens: maxTokens,
                response_format: jsonSchema
                    ? {type: 'json_schema', json_schema: {name: 'result', strict: true, schema: schema}}
                    : {type: 'json_object'},
                stream: true,
                stream_options: {include_usage: true},
            };
            if (options.effort) options.effort(body, model, effort);
            const res = await fetch(options.url + '/chat/completions', {
                method: 'POST',
                headers: Object.assign({'content-type': 'application/json', 'authorization': 'Bearer ' + apiKey}, options.extraHeaders || {}),
                body: JSON.stringify(body),
            });
            let text = '';
            let refusal = '';
            let finishReason = null;
            let usageData = null;
            await readEventStream(res, (name, raw) => {
                if (raw === '[DONE]') return;
                const data = parseEventData(raw);
                if (!data) return;
                if (data.error) throw streamError(data.error.message);
                if (data.usage) usageData = data.usage;
                const choice = data.choices && data.choices[0];
                if (!choice) return;
                const delta = choice.delta || {};
                const thought = delta.reasoning_content || delta.reasoning;
                if (thought) progress.reasoning(thought);
                if (delta.content) {
                    text += delta.content;
                    progress.text(delta.content);
                }
                if (delta.refusal) refusal += delta.refusal;
                if (choice.finish_reason) finishReason = choice.finish_reason;
            });
            recordUsage(usageData && usageData.prompt_tokens, usageData && usageData.completion_tokens);
            if (refusal) throw new Error('The model declined this request: ' + refusal);
            if (finishReason === 'length') throw new Error(CUT_OFF_MESSAGE);
            return parseModelJson(text);
        },
        async listModels(apiKey) {
            const res = await fetch(options.url + '/models', {
                headers: {'authorization': 'Bearer ' + apiKey},
            });
            const data = await readJsonResponse(res);
            return options.filterModels(data.data || []);
        },
    };
}

// Set when OpenAI refuses streaming or reasoning summaries because the organization isn't verified
let openAIUnverified = false;

const PROVIDERS = {
    claude: {
        async call(apiKey, model, system, user, schema, maxTokens, effort, progress) {
            const outputConfig = {format: {type: 'json_schema', schema: schema}};
            if (claudeSupportsEffort(model)) outputConfig.effort = effort === 'none' ? 'low' : effort;
            const body = {
                model: model,
                max_tokens: maxTokens,
                system: system,
                messages: [{role: 'user', content: user}],
                output_config: outputConfig,
                stream: true,
            };
            const thinking = claudeThinkingConfig(model);
            if (thinking) body.thinking = effort === 'none' ? {type: 'disabled'} : thinking;
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify(body),
            });
            let text = '';
            let inputTokens = 0;
            let outputTokens = 0;
            let stopReason = null;
            await readEventStream(res, (name, raw) => {
                const data = parseEventData(raw);
                if (!data) return;
                switch (data.type) {
                    case 'message_start':
                        inputTokens = (data.message.usage && data.message.usage.input_tokens) || 0;
                        break;
                    case 'content_block_start': {
                        const block = data.content_block || {};
                        if (block.type === 'thinking' || block.type === 'redacted_thinking') {
                            progress.section();
                            progress.reasoning(block.thinking || '');
                        } else if (block.type === 'text') {
                            text += block.text || '';
                            progress.text(block.text || '');
                        }
                        break;
                    }
                    case 'content_block_delta':
                        if (data.delta.type === 'thinking_delta') {
                            progress.reasoning(data.delta.thinking);
                        } else if (data.delta.type === 'text_delta') {
                            text += data.delta.text;
                            progress.text(data.delta.text);
                        }
                        break;
                    case 'message_delta':
                        if (data.delta && data.delta.stop_reason) stopReason = data.delta.stop_reason;
                        if (data.usage && data.usage.output_tokens) outputTokens = data.usage.output_tokens;
                        break;
                    case 'error':
                        throw streamError(data.error && data.error.message);
                }
            });
            recordUsage(inputTokens, outputTokens);
            if (stopReason === 'refusal') throw new Error('The model declined this request. Try generating again.');
            if (stopReason === 'max_tokens') throw new Error(CUT_OFF_MESSAGE);
            return parseModelJson(text);
        },
        async listModels(apiKey) {
            const res = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
            });
            const data = await readJsonResponse(res);
            return (data.data || []).map(m => m.id);
        },
    },
    // Uses the Responses API, since chat completions never shows any reasoning
    openai: {
        async call(apiKey, model, system, user, schema, maxTokens, effort, progress) {
            try {
                return await this.request(apiKey, model, system, user, schema, maxTokens, effort, progress, !openAIUnverified);
            } catch (e) {
                // Unverified organizations may not stream some models or see reasoning summaries
                if (openAIUnverified || !/verif/i.test(e.message)) throw e;
                openAIUnverified = true;
                return this.request(apiKey, model, system, user, schema, maxTokens, effort, progress, false);
            }
        },
        async request(apiKey, model, system, user, schema, maxTokens, effort, progress, stream) {
            const body = {
                model: model,
                instructions: system,
                input: user,
                max_output_tokens: maxTokens,
                text: {format: {type: 'json_schema', name: 'result', strict: true, schema: schema}},
                store: false,
                stream: stream,
            };
            if (/^(gpt-5|gpt-6|o\d)/.test(model)) {
                if (effort === 'none') {
                    // the original GPT-5 models can't turn reasoning off, only down to "minimal"
                    body.reasoning = {effort: /^gpt-5(?!\.)/.test(model) ? 'minimal' : 'none'};
                } else {
                    body.reasoning = {effort: effort};
                    if (stream) body.reasoning.summary = 'auto';
                }
            }
            const res = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {'content-type': 'application/json', 'authorization': 'Bearer ' + apiKey},
                body: JSON.stringify(body),
            });
            let response = null;
            if (stream) {
                await readEventStream(res, (name, raw) => {
                    const data = parseEventData(raw);
                    if (!data) return;
                    switch (data.type) {
                        case 'response.output_item.added':
                            if (data.item && data.item.type === 'reasoning') progress.reasoning('');
                            break;
                        case 'response.reasoning_summary_part.added':
                            progress.section();
                            break;
                        case 'response.reasoning_summary_text.delta':
                            progress.reasoning(data.delta);
                            break;
                        case 'response.output_text.delta':
                            progress.text(data.delta);
                            break;
                        case 'response.completed':
                        case 'response.incomplete':
                            response = data.response;
                            break;
                        case 'response.failed':
                            throw streamError(data.response && data.response.error && data.response.error.message);
                        case 'error':
                            throw streamError(data.message || (data.error && data.error.message));
                    }
                });
            } else {
                response = await readJsonResponse(res);
            }
            if (!response) throw new Error('The model returned no answer.');
            const u = response.usage || {};
            recordUsage(u.input_tokens, u.output_tokens);
            let text = '';
            let refusal = '';
            for (const item of response.output || []) {
                if (item.type !== 'message') continue;
                for (const part of item.content || []) {
                    if (part.type === 'output_text') text += part.text;
                    else if (part.type === 'refusal') refusal += part.refusal;
                }
            }
            if (refusal) throw new Error('The model declined this request: ' + refusal);
            if (response.status === 'incomplete' && response.incomplete_details
                && response.incomplete_details.reason === 'max_output_tokens') {
                throw new Error(CUT_OFF_MESSAGE);
            }
            return parseModelJson(text);
        },
        async listModels(apiKey) {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: {'authorization': 'Bearer ' + apiKey},
            });
            const data = await readJsonResponse(res);
            return (data.data || []).map(m => m.id)
                .filter(id => /^(gpt-|o\d)/.test(id))
                .filter(id => !/(audio|realtime|tts|transcribe|image|search|instruct|codex|embedding|moderation)/.test(id));
        },
    },
    gemini: {
        async call(apiKey, model, system, user, schema, maxTokens, effort, progress) {
            const generationConfig = {
                responseMimeType: 'application/json',
                responseJsonSchema: schema,
                maxOutputTokens: maxTokens,
            };
            if (/^gemini-([3-9]|\d\d)/.test(model)) {
                generationConfig.thinkingConfig = effort === 'none'
                    ? {thinkingLevel: 'minimal'}
                    : {thinkingLevel: effort, includeThoughts: true};
            } else if (/^gemini-2\.5/.test(model)) {
                generationConfig.thinkingConfig = effort === 'none' ? {thinkingBudget: 0} : {includeThoughts: true};
            }
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
                method: 'POST',
                headers: {'content-type': 'application/json', 'x-goog-api-key': apiKey},
                body: JSON.stringify({
                    systemInstruction: {parts: [{text: system}]},
                    contents: [{role: 'user', parts: [{text: user}]}],
                    generationConfig: generationConfig,
                }),
            });
            let text = '';
            let meta = {};
            let finishReason = null;
            let blockReason = null;
            let gotCandidate = false;
            await readEventStream(res, (name, raw) => {
                const data = parseEventData(raw);
                if (!data) return;
                if (data.error) throw streamError(data.error.message);
                if (data.usageMetadata) meta = data.usageMetadata;
                if (data.promptFeedback && data.promptFeedback.blockReason) blockReason = data.promptFeedback.blockReason;
                const candidate = data.candidates && data.candidates[0];
                if (!candidate) return;
                gotCandidate = true;
                if (candidate.finishReason) finishReason = candidate.finishReason;
                for (const part of (candidate.content && candidate.content.parts) || []) {
                    if (!part.text) continue;
                    if (part.thought) {
                        progress.reasoning(part.text);
                    } else {
                        text += part.text;
                        progress.text(part.text);
                    }
                }
            });
            recordUsage(meta.promptTokenCount, (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0));
            if (!gotCandidate) throw new Error('The model returned no answer' + (blockReason ? ' (' + blockReason + ').' : '.'));
            if (finishReason === 'MAX_TOKENS') throw new Error(CUT_OFF_MESSAGE);
            return parseModelJson(text);
        },
        async listModels(apiKey) {
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
                headers: {'x-goog-api-key': apiKey},
            });
            const data = await readJsonResponse(res);
            return (data.models || [])
                .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                .map(m => m.name.replace(/^models\//, ''))
                .filter(id => /^gemini/.test(id))
                .filter(id => !/(tts|image|embedding|audio|live)/.test(id));
        },
    },
    deepseek: openAICompatible({
        url: 'https://api.deepseek.com',
        // DeepSeek only offers JSON mode, not schema-constrained output
        jsonSchema: false,
        effort: (body, model, effort) => {
            body.thinking = {type: effort === 'none' ? 'disabled' : 'enabled'};
        },
        filterModels: models => models.map(m => m.id),
    }),
    openrouter: openAICompatible({
        url: 'https://openrouter.ai/api/v1',
        extraHeaders: {'x-title': 'Script Practice'},
        // ignored by models that don't reason; models that must reason reject 'none'
        effort: (body, model, effort) => {
            body.reasoning = {effort: effort};
        },
        filterModels: models => models
            .filter(m => (m.supported_parameters || []).includes('structured_outputs'))
            .map(m => m.id),
    }),
};

// provider/model pairs that rejected a request for no reasoning
const mustReason = new Set();

// purpose is 'generate' or 'grade', which picks the max output tokens
async function callLLM(system, user, schema, progress, effort, purpose) {
    const provider = settings.provider;
    const apiKey = unlockedKeys[provider];
    if (!apiKey) throw new Error('Save or unlock your API key for this provider first.');
    const model = currentModel();
    if (!model) throw new Error('Enter a model ID.');
    requestStart = performance.now();
    const call = e => PROVIDERS[provider].call(apiKey, model, system, user, schema, currentMaxTokens(purpose), e, progress);
    const key = provider + '/' + model;
    if (effort !== 'none' || mustReason.has(key)) return call(effort === 'none' ? 'low' : effort);
    try {
        return await call('none');
    } catch (e) {
        // Some models can't turn reasoning off and reject the request; use the lowest effort they accept instead
        if (e.status !== 400 && e.status !== 422) throw e;
        const result = await call('low');
        mustReason.add(key);
        return result;
    }
}

function orderModels(provider, ids) {
    const preferred = PREFERRED_MODELS[provider].filter(id => ids.includes(id));
    const rest = ids.filter(id => !preferred.includes(id)).sort();
    return preferred.concat(rest);
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const GENERATION_SCHEMA = {
    type: 'object',
    properties: {
        text: {type: 'string'},
        transliteration: {type: 'string'},
        translation: {type: 'string'},
    },
    required: ['text', 'transliteration', 'translation'],
    additionalProperties: false,
};

const GRADING_SCHEMA = {
    type: 'object',
    properties: {
        mistakes: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    symbol: {type: 'string'},
                    confusedWith: {type: 'string'},
                },
                required: ['symbol', 'confusedWith'],
                additionalProperties: false,
            },
        },
        remark: {type: 'string'},
    },
    required: ['mistakes', 'remark'],
    additionalProperties: false,
};

// Shared by both prompts, so the generated reference and the grading agree.
const TRANSLITERATION_RULE = 'Use the most widely used standard romanization.';

function getFullWritingNotes(script) {
    return [
        script.writingNotes,
        ...(script.separator ? ['Since this language doesn\'t normally separate words, use "' + script.separator + '" to separate words. A "word" is something that will be separated with spaces in the transliteration.'] : []),
    ];
}

function generationSystemPrompt(script, difficulty) {
    return [
        'You write reading practice for someone learning to read written ' + script.language + '. They will transliterate your text into the Latin alphabet.',
        '',
        'Write natural, everyday ' + script.language + ' that a native speaker would actually say or write. Length: ' + difficulty.prompt + '.',
        ...getFullWritingNotes(script),
        'Use a natural mix of common, less common and rare letters.',
        '',
        'A "symbol" means ' + script.symbolDescription + '. If the user message lists required symbols, the text MUST contain every one of them in exactly the form given, in words where they occur naturally. If they cannot all fit in the requested length, include as many as possible.',
        '',
        'Also give a reference transliteration of the text. ' + TRANSLITERATION_RULE
            + (script.separator ? ' Separate words with spaces.' : ''),
        'Finally give a natural English translation of the text.',
    ].join('\n');
}

function generationUserPrompt(requiredSymbols, pairs) {
    const lines = ['Topic idea (use it loosely): ' + TOPICS[Math.floor(Math.random() * TOPICS.length)] + '.'];
    if (requiredSymbols.length) {
        lines.push('Required symbols (each must appear at least once): ' + requiredSymbols.join(', '));
    }
    if (pairs.length) {
        lines.push('The learner confuses these pairs of symbols, so the text must contain BOTH symbols of each pair: '
            + pairs.map(p => p[0] + ' and ' + p[1]).join('; '));
    }
    if (!requiredSymbols.length && !pairs.length) {
        lines.push('There are no required symbols this time.');
    }
    lines.push('Write the text now.');
    return lines.join('\n');
}

function gradingSystemPrompt(script) {
    return [
        'You grade a learner\'s transliteration of ' + script.language + ' text.',
        '',
        'Accept a romanization of a symbol only if it is the value used by a standard, commonly used romanization system for '
            + script.language + ' (the learner may mix such systems). '
            + 'Unusual or loose spellings are mistakes, as is writing a symbol the way it happens to sound when no common system writes it that way, or dropping a distinction the common systems keep.'
            + (script.hasCase ? ' Capitalization matters: a capital letter must be transliterated as a capital, and a lowercase letter as lowercase.' : ' Capitalization does not matter.'),
        'Be lenient on differences in spacing on punctuation, unless it\'s an obvious mistake. For example, missing a period is fine, but forgetting a space is a mistake.',
        ...(script.gradingNotes || []).map(note => '- ' + note),
        '',
        'A "symbol" means ' + script.symbolDescription + '. '
            + 'Report every distinct symbol in the text that the learner transliterated incorrectly at least once, listing each symbol only once, exactly as it appears in the list of symbols in the text. '
            + 'Set "confusedWith" to the symbol whose transliteration is what the learner wrote instead, if there is one; otherwise set it to an empty string. '
            + 'A symbol the learner left out entirely is a mistake with an empty confusedWith. '
            + 'Do not report symbols that were transliterated correctly. If the whole transliteration is correct, return an empty list.',
        '',
        'Set "remark" to a short note (one or two sentences, in English) for the learner only if there is something worth telling them that the list of symbols cannot express: '
            + 'for example a mistake that isn\'t tied to one symbol (such as word boundaries or a sound change across syllables), an accepted but unusual romanization they should know about, or a problem with the text itself. '
            + 'Otherwise set it to an empty string. Don\'t use it to repeat the mistakes already listed or to praise the learner.',
        '',
        'If there appears to be a mistake in the text itself, do not report it as a learner mistake. The text should have been written according to the following writing notes:',
        ...getFullWritingNotes(script),
    ].join('\n');
}

function gradingUserPrompt(item, answer) {
    return [
        'Original text: ' + item.text,
        'Reference transliteration: ' + item.transliteration,
        'Symbols in the text: ' + item.symbols.join(', '),
        'Learner\'s transliteration: ' + answer,
    ].join('\n');
}

// ---------------------------------------------------------------------------
// Stats tracking
// ---------------------------------------------------------------------------

function loadStats(scriptId) {
    const stats = lsGet('stats.' + scriptId, null);
    return stats && stats.incorrect && stats.confused ? stats : {incorrect: {}, confused: {}};
}

function saveStats(scriptId, stats) {
    lsSet('stats.' + scriptId, stats);
}

function pairKey(a, b) {
    return [a, b].sort().join('|');
}

function bump(table, key) {
    const entry = table[key] || (table[key] = {misses: 0, streak: 0});
    entry.misses++;
    entry.streak = 0;
}

function applyGrading(scriptId, presentSymbols, mistakes) {
    const stats = loadStats(scriptId);
    const present = new Set(presentSymbols);
    const wrong = new Set(mistakes.map(m => m.symbol));

    for (const [symbol, entry] of Object.entries(stats.incorrect)) {
        if (present.has(symbol) && !wrong.has(symbol)) {
            entry.streak++;
            if (entry.streak >= MASTERY_STREAK) delete stats.incorrect[symbol];
        }
    }
    for (const [key, entry] of Object.entries(stats.confused)) {
        const [a, b] = key.split('|');
        if (present.has(a) && present.has(b) && !wrong.has(a) && !wrong.has(b)) {
            entry.streak++;
            if (entry.streak >= MASTERY_STREAK) delete stats.confused[key];
        }
    }
    for (const mistake of mistakes) {
        bump(stats.incorrect, mistake.symbol);
        if (mistake.confusedWith) bump(stats.confused, pairKey(mistake.symbol, mistake.confusedWith));
    }

    saveStats(scriptId, stats);
}

// Weighted sampling (by miss count) of problem symbols and confused pairs, within the difficulty's slot budget.
// A symbol costs one slot and a pair costs two.
function sampleRequirements(scriptId, slots) {
    const stats = loadStats(scriptId);
    const candidates = []
        .concat(Object.entries(stats.incorrect).map(([symbol, e]) => ({kind: 'symbol', value: symbol, weight: e.misses, cost: 1})))
        .concat(Object.entries(stats.confused).map(([key, e]) => ({kind: 'pair', value: key.split('|'), weight: e.misses, cost: 2})));

    const symbols = [];
    const pairs = [];
    let remaining = slots;
    while (remaining > 0) {
        const fitting = candidates.filter(c => c.cost <= remaining);
        if (!fitting.length) break;
        const total = fitting.reduce((sum, c) => sum + c.weight, 0);
        let r = Math.random() * total;
        let chosen = fitting[fitting.length - 1];
        for (const c of fitting) {
            r -= c.weight;
            if (r <= 0) {
                chosen = c;
                break;
            }
        }
        candidates.splice(candidates.indexOf(chosen), 1);
        remaining -= chosen.cost;
        if (chosen.kind === 'symbol') symbols.push(chosen.value);
        else pairs.push(chosen.value);
    }
    return {symbols: symbols, pairs: pairs};
}

// Returns the symbol in canonical form, or null if the model returned something that isn't a single symbol of the script.
function normalizeSymbol(script, symbol) {
    if (typeof symbol !== 'string') return null;
    symbol = symbol.trim().normalize('NFC');
    const found = script.symbolsOf(symbol);
    return found.length === 1 && found[0] === symbol ? symbol : null;
}

function cleanMistakes(script, item, rawMistakes) {
    const present = new Set(item.symbols);
    const result = [];
    const seen = new Set();
    for (const raw of Array.isArray(rawMistakes) ? rawMistakes : []) {
        const symbol = normalizeSymbol(script, raw && raw.symbol);
        if (!symbol || !present.has(symbol) || seen.has(symbol)) continue;
        seen.add(symbol);
        let confusedWith = normalizeSymbol(script, raw.confusedWith);
        if (confusedWith === symbol) confusedWith = null;
        result.push({symbol: symbol, confusedWith: confusedWith});
    }
    return result;
}

function normalizeForComparison(text) {
    return text.normalize('NFC').replace(/[\s\p{P}]/gu, '');
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

let el = {};
let currentItem = null; // {scriptId, text, transliteration, translation, symbols}
let busy = false;

// area: el.generateArea or el.gradeArea, the status, reasoning and error shown under that area's button
function setBusy(value, area) {
    busy = value;
    area.busy.hidden = !value;
    el.generate.disabled = value;
    el.next.disabled = value;
    el.submit.disabled = value || !currentItem;
}

// Shows what the current request is doing, and streams any reasoning the model shares into the collapsed
// reasoning panel. Call done() when the request has finished.
function startProgress(label, area) {
    const started = performance.now();
    let phase = 'waiting for the model';
    let reasoningText = '';
    const reasoningEl = area.reasoning.querySelector('.sp_reasoning');
    reasoningEl.textContent = '';
    area.reasoning.hidden = true;
    const update = () => {
        area.busy.textContent = label + ': ' + phase + '… ' + Math.floor((performance.now() - started) / 1000) + ' s';
    };
    update();
    const timer = setInterval(update, 250);
    return {
        reasoning(text) {
            if (phase !== 'thinking') {
                phase = 'thinking';
                update();
            }
            if (!text) return;
            reasoningText += text;
            reasoningEl.textContent = reasoningText;
            area.reasoning.hidden = false;
        },
        section() {
            if (reasoningText && !reasoningText.endsWith('\n\n')) reasoningText += reasoningText.endsWith('\n') ? '\n' : '\n\n';
        },
        text(text) {
            if (phase !== 'writing the answer') {
                phase = 'writing the answer';
                update();
            }
        },
        done() {
            clearInterval(timer);
        },
    };
}

function showError(target, message) {
    target.textContent = message || '';
}

function renderUsage() {
    el.usage.textContent = usage.requests
        ? 'This session: ' + usage.requests + ' request' + (usage.requests === 1 ? '' : 's') + ', '
            + usage.input.toLocaleString() + ' input tokens, ' + usage.output.toLocaleString() + ' output tokens.'
            + (usage.last ? ' Last request: ' + usage.last.total.toFixed(1) + ' s, '
                + usage.last.output.toLocaleString() + ' output tokens.' : '')
        : '';
}

// a blank box means automatic, so show the automatic value as its placeholder
function renderMaxTokenPlaceholders() {
    for (const purpose of ['generate', 'grade']) {
        el[purpose + 'MaxTokens'].placeholder = 'auto (' + autoMaxTokens(purpose).toLocaleString() + ')';
    }
}

function renderKeyStatus() {
    const provider = settings.provider;
    if (unlockedKeys[provider]) {
        el.keyStatus.textContent = 'Unlocked';
    } else if (lsGet('key.' + provider, null)) {
        el.keyStatus.textContent = 'Locked – enter your passphrase and press Unlock';
    } else {
        el.keyStatus.textContent = 'No key saved';
    }
    el.refreshModels.disabled = !unlockedKeys[provider];
    const guide = KEY_GUIDES[provider];
    el.keyGuide.textContent = 'How to create ' + (/^[AEIOU]/.test(guide.name) ? 'an ' : 'a ') + guide.name + ' API key';
    el.keyGuide.href = guide.url;
}

function renderModels() {
    const provider = settings.provider;
    const list = modelList(provider);
    const selected = lsGet('model.' + provider, null);
    el.model.textContent = '';
    for (const id of list) {
        el.model.appendChild(new Option(id, id));
    }
    el.model.appendChild(new Option('Custom…', '__custom__'));
    if (selected === '__custom__' || (selected && list.includes(selected))) {
        el.model.value = selected;
    } else {
        el.model.value = list[0];
    }
    el.customModel.hidden = el.model.value !== '__custom__';
    el.customModel.value = lsGet('customModel.' + provider, '');
}

function renderPalette() {
    const script = currentScript();
    el.palette.textContent = '';
    const palette = script.palette || [];
    for (const c of palette) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = c;
        button.title = 'Insert ' + c;
        button.addEventListener('click', () => insertAtCursor(el.answer, c));
        el.palette.appendChild(button);
    }
    el.palette.hidden = palette.length === 0;
}

function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
}

function renderScriptInfo() {
    const script = currentScript();
    el.scriptInfo.textContent = 'Transliterate letter by letter, the way ' + script.language
        + ' is usually romanized. Any established romanization is accepted, but not just spelling how it sounds.'
        + (script.separator ? ' Words are separated by ' + script.separator + '.' : '');
}

function makeTable(caption, headers, rows) {
    const table = document.createElement('table');
    table.className = 'sp_stats_table';
    table.createCaption().textContent = caption;
    const head = table.createTHead().insertRow();
    for (const h of headers) {
        const th = document.createElement('th');
        th.textContent = h;
        head.appendChild(th);
    }
    const body = table.createTBody();
    for (const row of rows) {
        const tr = body.insertRow();
        row.forEach((value, i) => {
            const td = tr.insertCell();
            td.textContent = value;
            if (i === 0) td.className = 'sp_symbol';
        });
    }
    return table;
}

function renderStats() {
    const script = currentScript();
    const stats = loadStats(script.id);
    el.stats.textContent = '';
    const byMisses = (a, b) => b[1].misses - a[1].misses;
    const incorrect = Object.entries(stats.incorrect).sort(byMisses);
    const confused = Object.entries(stats.confused).sort(byMisses);
    const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
    el.statsSummary.textContent = incorrect.length || confused.length
        ? [incorrect.length && plural(incorrect.length, 'symbol'), confused.length && plural(confused.length, 'pair')]
            .filter(Boolean).join(' and ') + ' to practice'
        : 'None yet';
    if (!incorrect.length && !confused.length) {
        el.stats.textContent = 'No problem symbols yet for the ' + script.name + '.';
        return;
    }
    if (incorrect.length) {
        el.stats.appendChild(makeTable('Symbols you got wrong', ['Symbol', 'Misses', 'Correct in a row'],
            incorrect.map(([symbol, e]) => [symbol, e.misses, e.streak + '/' + MASTERY_STREAK])));
    }
    if (confused.length) {
        el.stats.appendChild(makeTable('Symbols you confused', ['Pair', 'Misses', 'Correct in a row'],
            confused.map(([key, e]) => [key.split('|').join(' ↔ '), e.misses, e.streak + '/' + MASTERY_STREAK])));
    }
}

function clearPractice() {
    currentItem = null;
    el.sentence.textContent = '';
    el.note.textContent = '';
    el.answer.value = '';
    el.results.hidden = true;
    el.submit.disabled = true;
    el.gradeArea.reasoning.hidden = true;
    showError(el.gradeArea.error, '');
}

async function generate() {
    if (busy) return;
    const script = currentScript();
    const difficulty = currentDifficulty();
    showError(el.generateArea.error, '');
    clearPractice();
    setBusy(true, el.generateArea);
    try {
        const required = sampleRequirements(script.id, difficulty.slots);
        const allRequired = Array.from(new Set(required.symbols.concat(...required.pairs)));
        const system = generationSystemPrompt(script, difficulty);
        const user = generationUserPrompt(required.symbols, required.pairs);

        let result = null;
        let missing = [];
        for (let attempt = 0; attempt < 2; attempt++) {
            const progress = startProgress(attempt ? 'Generating again (some symbols were missing)' : 'Generating text', el.generateArea);
            try {
                // no reasoning, to keep generation fast; grading uses the chosen effort
                result = await callLLM(system, user, GENERATION_SCHEMA, progress, 'none', 'generate');
            } finally {
                progress.done();
            }
            if (!result || typeof result.text !== 'string' || !result.text.trim()) {
                throw new Error('The model did not return any text.');
            }
            const present = new Set(script.symbolsOf(result.text));
            missing = allRequired.filter(s => !present.has(s));
            if (!missing.length) break;
        }

        const text = result.text.trim().normalize('NFC');
        currentItem = {
            scriptId: script.id,
            text: text,
            transliteration: (result.transliteration || '').trim(),
            translation: (result.translation || '').trim(),
            symbols: script.symbolsOf(text),
        };
        el.sentence.lang = script.lang;
        el.sentence.textContent = text;
        if (missing.length) {
            el.note.textContent = 'The model could not fit every symbol you need to practice; missing: ' + missing.join(', ');
        }
        el.answer.focus();
    } catch (e) {
        showError(el.generateArea.error, e.message);
    } finally {
        setBusy(false, el.generateArea);
    }
}

async function submit() {
    if (busy || !currentItem) return;
    const answer = el.answer.value.trim();
    if (!answer) {
        showError(el.gradeArea.error, 'Type your transliteration first.');
        return;
    }
    const script = SCRIPTS_BY_ID[currentItem.scriptId];
    const item = currentItem;
    showError(el.gradeArea.error, '');
    setBusy(true, el.gradeArea);
    try {
        let mistakes, remark = '';
        if (settings.skipExact && item.transliteration
            && normalizeForComparison(answer) === normalizeForComparison(item.transliteration)) {
            mistakes = [];
        } else {
            const progress = startProgress('Grading', el.gradeArea);
            let result;
            try {
                result = await callLLM(gradingSystemPrompt(script), gradingUserPrompt(item, answer), GRADING_SCHEMA, progress, settings.effort, 'grade');
            } finally {
                progress.done();
            }
            mistakes = cleanMistakes(script, item, result && result.mistakes);
            if (result && typeof result.remark === 'string') remark = result.remark.trim();
        }
        if (currentItem !== item) return;
        applyGrading(script.id, item.symbols, mistakes);
        showResults(item, answer, mistakes, remark);
        // prevent grading the same text twice
        currentItem = null;
        renderStats();
    } catch (e) {
        showError(el.gradeArea.error, e.message);
    } finally {
        setBusy(false, el.gradeArea);
    }
}

function showResults(item, answer, mistakes, remark) {
    el.mistakes.textContent = '';
    el.resultSummary.textContent = mistakes.length
        ? 'You got ' + mistakes.length + ' symbol' + (mistakes.length === 1 ? '' : 's') + ' wrong:'
        : 'Perfect – no mistakes!';
    for (const m of mistakes) {
        const li = document.createElement('li');
        const symbol = document.createElement('span');
        symbol.className = 'sp_symbol';
        symbol.textContent = m.symbol;
        li.appendChild(symbol);
        if (m.confusedWith) {
            li.appendChild(document.createTextNode(' – you read it as '));
            const other = document.createElement('span');
            other.className = 'sp_symbol';
            other.textContent = m.confusedWith;
            li.appendChild(other);
        } else {
            li.appendChild(document.createTextNode(' – incorrect'));
        }
        el.mistakes.appendChild(li);
    }
    el.remark.textContent = remark || '';
    el.remark.hidden = !remark;
    el.yourAnswer.textContent = answer;
    el.reference.textContent = item.transliteration;
    el.translation.textContent = item.translation;
    el.results.hidden = false;
}

async function saveKey() {
    const apiKey = el.apiKey.value.trim();
    const passphrase = el.passphrase.value;
    if (!apiKey || !passphrase) {
        showError(el.settingsError, 'Enter both an API key and a passphrase to save the key.');
        return;
    }
    showError(el.settingsError, '');
    try {
        const stored = await encryptApiKey(apiKey, passphrase);
        lsSet('key.' + settings.provider, stored);
        unlockedKeys[settings.provider] = apiKey;
        el.apiKey.value = '';
        el.passphrase.value = '';
        renderKeyStatus();
        refreshModels(true);
    } catch (e) {
        showError(el.settingsError, 'Could not encrypt the key: ' + e.message);
    }
}

async function unlockKey() {
    const stored = lsGet('key.' + settings.provider, null);
    if (!stored) {
        showError(el.settingsError, 'No key is saved for this provider. Enter an API key and a passphrase, then press Save key.');
        return;
    }
    if (!el.passphrase.value) {
        showError(el.settingsError, 'Enter your passphrase.');
        return;
    }
    showError(el.settingsError, '');
    el.keyStatus.textContent = 'Unlocking…';
    try {
        unlockedKeys[settings.provider] = await decryptApiKey(stored, el.passphrase.value);
        el.passphrase.value = '';
        renderKeyStatus();
        refreshModels(true);
    } catch (e) {
        renderKeyStatus();
        showError(el.settingsError, 'Wrong passphrase.');
    }
}

function forgetKey() {
    if (!confirm('Forget the saved API key for this provider?')) return;
    lsRemove('key.' + settings.provider);
    delete unlockedKeys[settings.provider];
    renderKeyStatus();
}

async function refreshModels(quiet) {
    const provider = settings.provider;
    const apiKey = unlockedKeys[provider];
    if (!apiKey) return;
    try {
        const ids = await PROVIDERS[provider].listModels(apiKey);
        if (ids.length) {
            lsSet('models.' + provider, orderModels(provider, ids));
            if (provider === settings.provider) renderModels();
        }
    } catch (e) {
        if (!quiet) showError(el.settingsError, 'Could not fetch the model list: ' + e.message);
    }
}

function onEnterSubmit(input, action) {
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            action();
        }
    });
}

function init() {
    const byId = id => document.getElementById(id);
    el = {
        provider: byId('provider'), model: byId('model'), customModel: byId('custom_model'), refreshModels: byId('refresh_models'),
        apiKey: byId('api_key'), passphrase: byId('passphrase'), saveKey: byId('save_key'), unlockKey: byId('unlock_key'),
        forgetKey: byId('forget_key'), keyStatus: byId('key_status'),
        effort: byId('effort'), generateMaxTokens: byId('generate_max_tokens'), gradeMaxTokens: byId('grade_max_tokens'), skipExact: byId('skip_exact'), usage: byId('usage'),
        script: byId('script'), difficulty: byId('difficulty'), scriptInfo: byId('script_info'),
        settingsError: byId('settings_error'), keyGuide: byId('key_guide'),
        generate: byId('generate'), sentence: byId('sentence'), note: byId('note'),
        generateArea: {busy: byId('generate_busy'), reasoning: byId('generate_reasoning'), error: byId('generate_error')},
        gradeArea: {busy: byId('grade_busy'), reasoning: byId('grade_reasoning'), error: byId('grade_error')},
        palette: byId('palette'), answer: byId('answer'), submit: byId('submit'),
        results: byId('results'), resultSummary: byId('result_summary'), mistakes: byId('mistakes'), remark: byId('remark'),
        yourAnswer: byId('your_answer'), reference: byId('reference'), translation: byId('translation'), next: byId('next'),
        stats: byId('stats'), statsSummary: byId('stats_summary'), resetStats: byId('reset_stats'), masteryCount: byId('mastery_count'),
    };

    el.masteryCount.textContent = MASTERY_STREAK;

    for (const script of SCRIPTS) el.script.appendChild(new Option(script.name, script.id));
    for (const difficulty of DIFFICULTIES) el.difficulty.appendChild(new Option(difficulty.label, difficulty.id));

    el.provider.value = settings.provider;
    el.effort.value = settings.effort;
    for (const purpose of ['generate', 'grade']) {
        const input = el[purpose + 'MaxTokens'];
        input.value = settings[purpose + 'MaxTokens'] || '';
        input.addEventListener('change', () => {
            const value = parseInt(input.value, 10);
            saveSetting(purpose + 'MaxTokens', value > 0 ? value : null);
        });
    }
    el.skipExact.checked = settings.skipExact;
    el.script.value = settings.script;
    el.difficulty.value = settings.difficulty;

    el.provider.addEventListener('change', () => {
        saveSetting('provider', el.provider.value);
        renderModels();
        renderKeyStatus();
        showError(el.settingsError, '');
    });
    el.model.addEventListener('change', () => {
        lsSet('model.' + settings.provider, el.model.value);
        el.customModel.hidden = el.model.value !== '__custom__';
        if (!el.customModel.hidden) el.customModel.focus();
    });
    el.customModel.addEventListener('input', () => lsSet('customModel.' + settings.provider, el.customModel.value));
    el.refreshModels.addEventListener('click', () => refreshModels(false));
    el.saveKey.addEventListener('click', saveKey);
    el.unlockKey.addEventListener('click', unlockKey);
    el.forgetKey.addEventListener('click', forgetKey);
    onEnterSubmit(el.passphrase, () => (el.apiKey.value.trim() ? saveKey() : unlockKey()));

    el.effort.addEventListener('change', () => {
        saveSetting('effort', el.effort.value);
        renderMaxTokenPlaceholders();
    });
    el.skipExact.addEventListener('change', () => saveSetting('skipExact', el.skipExact.checked));

    el.script.addEventListener('change', () => {
        saveSetting('script', el.script.value);
        clearPractice();
        renderPalette();
        renderScriptInfo();
        renderStats();
    });
    el.difficulty.addEventListener('change', () => {
        saveSetting('difficulty', el.difficulty.value);
        renderMaxTokenPlaceholders();
    });

    el.generate.addEventListener('click', generate);
    el.next.addEventListener('click', generate);
    el.submit.addEventListener('click', submit);
    el.answer.addEventListener('keydown', event => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            submit();
        }
    });
    el.resetStats.addEventListener('click', () => {
        if (!confirm('Reset the problem symbols for the ' + currentScript().name + '?')) return;
        saveStats(settings.script, {incorrect: {}, confused: {}});
        renderStats();
    });

    renderModels();
    renderKeyStatus();
    renderPalette();
    renderScriptInfo();
    renderStats();
    renderUsage();
    renderMaxTokenPlaceholders();
    clearPractice();
}

// exposed for debugging in the console
window.scriptPractice = {SCRIPTS: SCRIPTS_BY_ID, generationSystemPrompt, gradingSystemPrompt, symbolsOf: (id, text) => SCRIPTS_BY_ID[id].symbolsOf(text)};

window.addEventListener('DOMContentLoaded', init);

})();
