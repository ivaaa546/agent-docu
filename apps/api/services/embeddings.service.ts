import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno locales
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY no está configurada en las variables de entorno.');
}

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    timeout: 15000,
    retryOptions: {
      attempts: 1 // Evitar reintentos internos del SDK y que Next.js cancele la conexión por timeout (socket hang up)
    }
  }
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getEmbedding = async (text: string, retries = 5): Promise<number[]> => {
  if (!apiKey) {
    // Retornamos un vector dummy si no hay API key para no romper el desarrollo local
    return new Array(768).fill(0.1);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: text,
        config: {
          outputDimensionality: 768,
          httpOptions: {
            timeout: 10000,
            retryOptions: { attempts: 1 }
          }
        }
      });

      if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
        throw new Error('No se recibieron valores del modelo de embedding');
      }

      return response.embeddings[0].values;
    } catch (err: any) {
      const errMsg = err.message || '';

      // 1. Límite duro o facturación (permanente): lanzar inmediatamente
      if (errMsg.includes('exceeded your current quota') || errMsg.includes('billing details')) {
        console.error('[Embeddings] Error permanente de cuota o facturación en la API de Gemini.');
        throw new Error('Límite de cuota de Gemini API excedido. Por favor, revisa tu plan y límites en Google AI Studio.');
      }

      // 2. Límite de velocidad RPM / temporal (Too Many Requests, 429, RESOURCE_EXHAUSTED)
      const isRpmRateLimit = err.status === 429 || 
        errMsg.includes('429') || 
        errMsg.includes('Too Many Requests') || 
        errMsg.includes('RESOURCE_EXHAUSTED') || 
        errMsg.includes('Rate limit') ||
        errMsg.includes('quota');

      if (isRpmRateLimit) {
        if (attempt < retries) {
          console.warn(`[Embeddings] Límite de velocidad (Too Many Requests). Esperando 7s para reintentar (intento ${attempt}/${retries})...`);
          await sleep(7000);
          continue;
        } else {
          throw new Error('Límite de peticiones por minuto (RPM) de Gemini API excedido (Too Many Requests). Por favor, espera un minuto o divide el documento en archivos más pequeños.');
        }
      }

      if (attempt === retries) {
        console.error(`[Embeddings] Error tras ${retries} intentos:`, errMsg);
        throw err;
      }
      await sleep(1500 * attempt);
    }
  }

  throw new Error('Fallo inesperado al obtener el embedding');
};
