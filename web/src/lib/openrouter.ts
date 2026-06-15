import OpenAI from 'openai'

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': 'https://info-sentry.local',
    'X-Title': 'Info-Sentry',
  },
})

export const CHAT_MODEL = 'google/gemini-2.5-flash-lite'
