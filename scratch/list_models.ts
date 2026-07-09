import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../apps/api/.env') });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const list = await ai.models.list();
    console.log('list keys:', Object.keys(list));
    // If it's a pager/async iterator, let's see:
    for await (const model of list) {
      console.log('Model:', model.name);
    }
  } catch (err) {
    console.error('Error listing models:', err);
  }
}

run();
