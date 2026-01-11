
import { GoogleGenAI } from "@google/genai";

// Create a new instance right before use to ensure the most up-to-date API key is used.
// Guideline: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeFinances = async (transactions: any[]) => {
  const ai = getAI();
  const prompt = `Analiza los siguientes movimientos financieros y bríndame 3 consejos cortos y amigables para mejorar mis finanzas. Sé motivador y profesional, usando el estilo "Full Geta".
  Movimientos: ${JSON.stringify(transactions)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "Eres un asesor financiero juvenil y experto llamado GetaBot. Hablas en español de forma cercana y usas emojis."
      }
    });
    // The .text property directly returns the string output.
    return response.text;
  } catch (error) {
    console.error("Error analyzing finances:", error);
    return "¡Ups! No pude analizar tus gastos en este momento. ¡Sigue ahorrando! 🚀";
  }
};
