import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY no está configurada.');
}

export const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    timeout: 120000, // 2 minutos para permitir respuestas largas de streaming de chat
    retryOptions: {
      attempts: 1
    }
  }
});

export const MODEL_NAME = 'gemini-2.5-flash';

export async function* streamChat(systemInstruction: string, history: { role: string; content: string }[], message: string) {
  const contents = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }));

  // Agregar el mensaje actual del usuario
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const responseStream = await ai.models.generateContentStream({
    model: MODEL_NAME,
    contents,
    config: {
      systemInstruction,
      temperature: 0.7,
    }
  });

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
