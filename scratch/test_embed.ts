import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../apps/api/.env') });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: 'Hello',
    });
    console.log('Response keys:', Object.keys(response));
    console.log('Response embeddings:', response.embeddings);
    if (response.embeddings && response.embeddings[0]) {
      console.log('First embedding values length:', response.embeddings[0].values.length);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
