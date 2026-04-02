export interface FoodResult {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving: string;
  brand?: string;
}

export async function searchFoods(query: string): Promise<FoodResult[]> {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(
      `https://world.openfoodfacts.net/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=true&page_size=15&fields=product_name,brands,nutriments,serving_size,code`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NutriPair/1.0',
        },
      }
    );
    const data = await response.json();

    if (!data.products) return [];

    return data.products
      .filter((p: any) => p.product_name && p.nutriments)
      .map((p: any) => {
        const n = p.nutriments || {};
        const hasServing = n['energy-kcal_serving'] != null;

        return {
          id: `off-${p.code}`,
          name: p.product_name,
          brand: p.brands || undefined,
          calories: Math.round(hasServing ? n['energy-kcal_serving'] : (n['energy-kcal_100g'] || 0)),
          protein: Math.round((hasServing ? n['proteins_serving'] : (n['proteins_100g'] || 0)) * 10) / 10,
          carbs: Math.round((hasServing ? n['carbohydrates_serving'] : (n['carbohydrates_100g'] || 0)) * 10) / 10,
          fat: Math.round((hasServing ? n['fat_serving'] : (n['fat_100g'] || 0)) * 10) / 10,
          serving: hasServing ? (p.serving_size || '1 serving') : '100g',
        };
      })
      .filter((f: FoodResult) => f.calories > 0);
  } catch (error) {
    console.error('Food search error:', error);
    return [];
  }
}

export async function lookupBarcode(barcode: string): Promise<FoodResult | null> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.net/api/v2/product/${barcode}?fields=product_name,brands,nutriments,serving_size,serving_quantity,code`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NutriPair/1.0',
        },
      }
    );
    const data = await response.json();

    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments || {};

    const hasServing = n['energy-kcal_serving'] != null;

    const calories = Math.round(hasServing ? n['energy-kcal_serving'] : (n['energy-kcal_100g'] || 0));
    const protein = Math.round((hasServing ? n['proteins_serving'] : (n['proteins_100g'] || 0)) * 10) / 10;
    const carbs = Math.round((hasServing ? n['carbohydrates_serving'] : (n['carbohydrates_100g'] || 0)) * 10) / 10;
    const fat = Math.round((hasServing ? n['fat_serving'] : (n['fat_100g'] || 0)) * 10) / 10;

    const serving = hasServing
      ? (p.serving_size || '1 serving')
      : '100g';

    return {
      id: `off-${p.code}`,
      name: p.product_name || 'Unknown product',
      brand: p.brands || undefined,
      calories,
      protein,
      carbs,
      fat,
      serving,
    };
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return null;
  }
}