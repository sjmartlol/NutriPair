// services/foodVision.ts
// Uses Google Gemini Flash to analyze food photos

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export interface FoodEstimate {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function analyzeFoodPhoto(base64Image: string): Promise<FoodEstimate[]> {
  try {
    const response = await fetch(
     `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analyze this food photo and estimate the nutritional content. Return ONLY a JSON array of food items, no other text. Each item should have:
- "name": food name (string)
- "calories": estimated calories (number)  
- "protein": grams of protein (number)
- "carbs": grams of carbs (number)
- "fat": grams of fat (number)
- "serving": estimated portion size (string like "1 cup", "2 slices", "1 medium bowl")
- "confidence": how confident you are in the estimate - "high", "medium", or "low"

If you see multiple food items on the plate, list each separately.
Be realistic with portion sizes you can see in the photo.
Return ONLY the JSON array, no markdown, no backticks, no explanation.`
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          }
        }),
      }
    );

    const data = await response.json();

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const errorMsg = data?.error?.message || JSON.stringify(data).substring(0, 200);
      throw new Error(`AI error: ${errorMsg}`);
    }

    const text = data.candidates[0].content.parts[0].text.trim();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const items: FoodEstimate[] = JSON.parse(cleaned);

    return items.filter(item => item.name && item.calories > 0);
  } catch (error) {
    console.error('Food vision error:', error);
    throw new Error('Could not analyze the photo. Try again with a clearer image.');
  }
}