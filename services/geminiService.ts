import { GoogleGenAI, Type } from "@google/genai";
import { FuelItem, FuelType, HourPlan, UserSettings } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

export const searchCustomFood = async (query: string): Promise<FuelItem | null> => {
  try {
    const ai = getAiClient();
    const model = 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model,
      contents: `Identify the nutritional content for a standard serving of: "${query}". 
      Return a JSON object with a short name, estimated carbs (grams), type (SOLID, DRINK, GEL, CHEW, OTHER), approximate sodium (mg), and approximate potassium (mg).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            carbs: { type: Type.NUMBER },
            sodium: { type: Type.NUMBER },
            potassium: { type: Type.NUMBER },
            type: { type: Type.STRING, enum: ['SOLID', 'DRINK', 'GEL', 'CHEW', 'OTHER'] },
          },
          required: ["name", "carbs", "type"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    
    return {
      id: `custom-${Date.now()}`,
      name: data.name,
      brand: 'Custom AI Search',
      carbs: data.carbs,
      sodium: data.sodium || 0,
      potassium: data.potassium || 0,
      type: data.type as FuelType || FuelType.OTHER,
      isCustom: true
    };

  } catch (error) {
    console.error("Gemini Search Error:", error);
    return null;
  }
};

export const analyzePlan = async (
  plan: HourPlan[], 
  settings: UserSettings
): Promise<string> => {
  try {
    const ai = getAiClient();
    const model = 'gemini-2.5-flash';

    // Construct a readable summary of the plan
    const planSummary = plan.map(h => {
      const items = h.items.map(i => `${i.brand ? i.brand + ' ' : ''}${i.name} (${i.carbs}g carbs)`).join(', ');
      const totalCarbs = h.items.reduce((acc, i) => acc + i.carbs, 0);
      return `Hour ${h.hourIndex + 1}: ${totalCarbs}g total. Items: ${items || 'None'}`;
    }).join('\n');

    const prompt = `
      Act as an elite marathon nutrition coach. Analyze the following fueling plan.
      
      Runner Goal Time: ${settings.targetTimeHours}h ${settings.targetTimeMinutes}m
      Target Carbs/Hour: ${settings.targetCarbsPerHour}g
      
      Current Plan:
      ${planSummary}
      
      Provide a concise, helpful critique. 
      1. Are they hitting the target? 
      2. Is the mix of sources (drink vs gel vs solid) appropriate for late race stages?
      3. Give one specific actionable tip.
      
      Keep it under 100 words. Use a motivating tone.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || "Unable to generate analysis.";

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Sorry, AI analysis is currently unavailable. Please check your API key.";
  }
};

export const suggestStrategy = async (timeHours: number, timeMinutes: number): Promise<{ target: number, reason: string }> => {
    try {
        const ai = getAiClient();
        const model = 'gemini-2.5-flash';
        
        const prompt = `
            I am running a marathon in ${timeHours} hours and ${timeMinutes} minutes.
            Suggest a target grams of carbohydrates per hour I should aim for.
            Return JSON with "target" (number) and "reason" (short string).
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        target: { type: Type.NUMBER },
                        reason: { type: Type.STRING }
                    }
                }
            }
        });
        
        const text = response.text;
        if(!text) return { target: 60, reason: "Default fallback due to error." };
        return JSON.parse(text);
    } catch (e) {
        return { target: 60, reason: "Standard recommendation for most runners." };
    }
}