import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function extractTransactionData(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract transaction data from the following text (receipt, SMS, etc.). Identify merchant, amount, category, and date.
      Return the data in a clean JSON object.
      Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = response.text || "{}";
    return JSON.parse(result);
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
}
