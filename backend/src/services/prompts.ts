import { config } from '../utils/config';
import * as gemini from './geminiPrompts';
import * as ollama from './ollamaPrompts';

const isGemini = Boolean(config.geminiApiKey);

export const FIXED_QUERY = isGemini ? gemini.GEMINI_FIXED_QUERY : ollama.OLLAMA_FIXED_QUERY;
export const FIXED_PROMPT = isGemini ? gemini.GEMINI_FIXED_PROMPT : ollama.OLLAMA_FIXED_PROMPT;
export const FIXED_PROMPT_FULL = isGemini ? gemini.GEMINI_FIXED_PROMPT_FULL : ollama.OLLAMA_FIXED_PROMPT_FULL;

export const DYNAMIC_QUERY = isGemini ? gemini.GEMINI_DYNAMIC_QUERY : ollama.OLLAMA_DYNAMIC_QUERY;
export const DYNAMIC_PROMPT = isGemini ? gemini.GEMINI_DYNAMIC_PROMPT : ollama.OLLAMA_DYNAMIC_PROMPT;
export const DYNAMIC_PROMPT_FULL = isGemini ? gemini.GEMINI_DYNAMIC_PROMPT_FULL : ollama.OLLAMA_DYNAMIC_PROMPT_FULL;

export const SUPPLIER_PROMPT = isGemini ? gemini.GEMINI_SUPPLIER_PROMPT : ollama.OLLAMA_SUPPLIER_PROMPT;
export const SUPPLIER_PROMPT_FULL = isGemini ? gemini.GEMINI_SUPPLIER_PROMPT_FULL : ollama.OLLAMA_SUPPLIER_PROMPT_FULL;

export const SUMMARY_QUERY = isGemini ? gemini.GEMINI_SUMMARY_QUERY : ollama.OLLAMA_SUMMARY_QUERY;
export const SUMMARY_PROMPT = isGemini ? gemini.GEMINI_SUMMARY_PROMPT : ollama.OLLAMA_SUMMARY_PROMPT;
export const SUMMARY_PROMPT_FULL = isGemini ? gemini.GEMINI_SUMMARY_PROMPT_FULL : ollama.OLLAMA_SUMMARY_PROMPT_FULL;
