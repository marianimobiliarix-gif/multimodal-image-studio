
import { GoogleGenAI } from "@google/genai";
import { Base64Image, GenerationResult } from "../types";

const getGeminiApiKey = (): string => {
  // 1. Check Vite standard client environment variable
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // 2. Check process.env fallbacks (Node/Vercel/Vite define)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    if (process.env.API_KEY) return process.env.API_KEY;
  }
  return '';
};

export const generateImageVariant = async (
  prompt: string,
  base64Images: Base64Image[],
  index: number
): Promise<GenerationResult> => {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
      return {
        id: `gen-${index}-${Date.now()}`,
        url: null,
        error: "Cheia API Gemini nu este configurată. Te rugăm să configurezi variabila VITE_GEMINI_API_KEY sau GEMINI_API_KEY în mediul aplicației.",
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const imageParts = base64Images.map(img => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));

    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [...imageParts, textPart] },
    });

    let imageUrl: string | null = null;

    // Iterate through parts to find the image part
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      return {
        id: `gen-${index}-${Date.now()}`,
        url: null,
        error: "The model did not return an image part. It might have returned only text.",
      };
    }

    return {
      id: `gen-${index}-${Date.now()}`,
      url: imageUrl,
      error: null,
    };
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    return {
      id: `gen-${index}-${Date.now()}`,
      url: null,
      error: err.message || "An unexpected error occurred during generation.",
    };
  }
};
