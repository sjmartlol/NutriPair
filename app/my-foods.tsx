import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addCustomFood, deleteCustomFood, getCustomFoods, getTodayLog, logMeal } from '../services/database';
import { searchFoods, type FoodResult } from '../services/foodSearch';

const { UserContext } = require('./_layout');

function FoodRow({ food, onLog, onDelete, onSave }: { food: any; onLog: () => void; onDelete?: () => void; onSave?: () => void }) {
  const sourceLabel =
    food?.source === 'barcode' ? 'Barcode' :
    food?.source === 'ai' ? 'AI' :
    food?.source === 'api' ? 'Database' : 'Custom';

  const sourceColor =
    food?.source === 'barcode' ? '#8BA4D4' :
    food?.source === 'ai' ? '#D4A45A' :
    food?.source === 'api' ? '#2D2D2D' : '#7BA876';

  return (
    <View style={{ backgroundColor: 'white', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#E0DED9', marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#2D2D2D' }}>{food.name}</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: `${sourceColor}15` }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: sourceColor, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {sourceLabel}
              </Text>
            </View>
          </View>
          {!!food.brand && <Text style={{ fontSize: 11, color: '#BBB', marginTop: 2 }}>{food.brand}</Text>}
          <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            {food.serving || '1 serving'} · {food.calories} cal · {food.protein || 0}g P · {food.carbs || 0}g C · {food.fat || 0}g F
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <TouchableOpacity onPress={onLog} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: '#F0F5EE' }}>
            <Text style={{ color: '#7BA876', fontWeight: '700', fontSize: 12 }}>+ Log</Text>
          </TouchableOpacity>
          {onSave && (
            <TouchableOpacity onPress={onSave} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: '#F5F5F3' }}>
              <Text style={{ color: '#666', fontWeight: '700', fontSize: 12 }}>Save</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: '#FDF2F0' }}>
              <Text style={{ color: '#D45A5A', fontWeight: '700', fontSize: 12 }}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function MyFoodsScreen() {
  const ctx: any = useContext(UserContext);
  const user: any = ctx?.user;
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  const [foods, setFoods] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'custom' | 'barcode' | 'api'>('all');
  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<any>(null);
  const searchRef = useRef<TextInput | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [pendingLogFood, setPendingLogFood] = useState<any>(null);
  const [mealType, setMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'>('Breakfast');
  const [servingsCount, setServingsCount] = useState('1');
  const [logging, setLogging] = useState(false);

  const [name, setName] = useState('');
  const [serving, setServing] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const loadFoods = async () => {
    if (!user?.uid) return;
    const f = await getCustomFoods(user.uid);
    setFoods(f);
  };

  useEffect(() => {
    loadFoods();
  }, [user?.uid]);

  useEffect(() => {
    if (mode === 'search') setTimeout(() => searchRef.current?.focus(), 250);
    if (mode === 'database') {
      setFilter('api');
      setTimeout(() => searchRef.current?.focus(), 250);
    }
    if (mode === 'create') setShowCreate(true);
    if (mode === 'custom') setFilter('custom');
    if (mode === 'scan') setFilter('barcode');
  }, [mode]);

  const filteredSavedFoods = foods.filter((food) => {
    if (filter === 'all') return true;
    const source = (food.source || 'custom') as 'custom' | 'barcode' | 'api';
    if (filter === 'barcode') return source === 'barcode' || source === 'ai';
    return source === filter;
  });

  useEffect(() => {
    if (query.trim().length < 2) {
      setApiResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      const r = await searchFoods(query.trim());
      setApiResults(r || []);
      setSearching(false);
    }, 450);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query]);

  const openLog = (food: any) => {
    setPendingLogFood(food);
    setMealType('Breakfast');
    setServingsCount('1');
  };

  const doLog = async () => {
    if (!user?.uid || !pendingLogFood) return;
    const count = Math.max(0.1, Number(servingsCount) || 1);
    const payload = {
      ...pendingLogFood,
      mealType,
      servingsCount: count,
      calories: Number(((Number(pendingLogFood.calories) || 0) * count).toFixed(2)),
      protein: Number(((Number(pendingLogFood.protein) || 0) * count).toFixed(2)),
      carbs: Number(((Number(pendingLogFood.carbs) || 0) * count).toFixed(2)),
      fat: Number(((Number(pendingLogFood.fat) || 0) * count).toFixed(2)),
      serving: `${count} × ${pendingLogFood.serving || '1 serving'}`,
    };
    setLogging(true);
    try {
      await logMeal(user.uid, payload);
      const updated = await getTodayLog(user.uid);
      ctx?.setTodayLog?.(updated);
      setPendingLogFood(null);
      Alert.alert('Logged!', `${payload.name} added to ${mealType}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setLogging(false);
  };

  const saveApi = async (food: FoodResult) => {
    try {
      const saved = await addCustomFood(user.uid, { ...food, source: 'api', externalId: food.id });
      setFoods(prev => [{ ...food, id: saved.id }, ...prev]);
      Alert.alert('Saved!', `${food.name} added to My Foods`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const createManual = async () => {
    if (!name.trim() || !calories.trim()) return;
    try {
      const saved = await addCustomFood(user.uid, {
        name: name.trim(),
        serving: serving.trim() || '1 serving',
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        source: 'custom',
      });
      setFoods(prev => [{ id: saved.id, name: name.trim(), serving: serving.trim() || '1 serving', calories: Number(calories) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 }, ...prev]);
      setShowCreate(false);
      setName(''); setServing(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 4, paddingRight: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#999' }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>My Foods</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 4, paddingLeft: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#7BA876' }}>Done</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13, color: '#999', marginTop: 6 }}>Search, save, and log foods.</Text>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 12, borderWidth: 1.5, borderColor: '#E0DED9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
            <Text style={{ color: '#999', marginRight: 8 }}>🔍</Text>
            <TextInput
              ref={(r) => { searchRef.current = r; }}
              value={query}
              onChangeText={setQuery}
              placeholder="Search foods..."
              placeholderTextColor="#999"
              style={{ flex: 1, fontSize: 15, color: '#2D2D2D', paddingVertical: 10 }}
            />
          </View>
          <TouchableOpacity onPress={() => setShowCreate(true)} style={{ paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center', backgroundColor: '#2D2D2D' }}>
            <Text style={{ color: 'white', fontWeight: '700' }}>Create</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8, paddingRight: 24 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'custom', label: 'Custom' },
            { id: 'barcode', label: 'Scanned' },
            { id: 'api', label: 'Database' },
          ].map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id as any)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? '#2D2D2D' : 'white',
                  borderWidth: active ? 0 : 1.5,
                  borderColor: '#E0DED9',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? 'white' : '#666' }}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 40 }}>
        {query.trim().length >= 2 && (
          <>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 8 }}>
              {searching ? 'Searching API...' : 'API results'}
            </Text>
            {apiResults.map(food => (
              <FoodRow key={food.id} food={food} onLog={() => openLog(food)} onSave={() => saveApi(food)} />
            ))}
            <View style={{ height: 10 }} />
          </>
        )}

        <Text style={{ fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 8 }}>Saved foods</Text>
        {filteredSavedFoods.map(food => (
          <FoodRow
            key={food.id}
            food={food}
            onLog={() => openLog(food)}
            onDelete={() => {
              Alert.alert('Delete food?', `Remove "${food.name}" from My Foods?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteCustomFood(user.uid, food.id);
                    setFoods(prev => prev.filter(f => f.id !== food.id));
                  },
                },
              ]);
            }}
          />
        ))}
      </ScrollView>

      <Modal visible={!!pendingLogFood} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setPendingLogFood(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>Log food</Text>
              <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{pendingLogFood?.name}</Text>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {pendingLogFood?.serving || '1 serving'} · {pendingLogFood?.calories || 0} cal
              </Text>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                {pendingLogFood?.protein || 0}g P · {pendingLogFood?.carbs || 0}g C · {pendingLogFood?.fat || 0}g F
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#999', marginTop: 14, marginBottom: 6 }}>Meal type</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).map(t => (
                  <TouchableOpacity key={t} onPress={() => setMealType(t)} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: mealType === t ? '#2D2D2D' : 'white', borderWidth: mealType === t ? 0 : 1.5, borderColor: '#E0DED9' }}>
                    <Text style={{ color: mealType === t ? 'white' : '#666', fontSize: 12, fontWeight: '700' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#999', marginTop: 14, marginBottom: 6 }}>Servings count</Text>
              <TextInput value={servingsCount} onChangeText={setServingsCount} keyboardType="decimal-pad" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 10, padding: 12, fontSize: 16, fontWeight: '700', textAlign: 'center' }} />
              {(() => {
                const count = Math.max(0.1, Number(servingsCount) || 1);
                const calories = (Number(pendingLogFood?.calories) || 0) * count;
                const protein = (Number(pendingLogFood?.protein) || 0) * count;
                const carbs = (Number(pendingLogFood?.carbs) || 0) * count;
                const fat = (Number(pendingLogFood?.fat) || 0) * count;
                return (
                  <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#E8E8E6' }}>
                    <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Auto-calculated totals</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#2D2D2D' }}>
                      {Math.round(calories)} cal · {protein.toFixed(1)}g P · {carbs.toFixed(1)}g C · {fat.toFixed(1)}g F
                    </Text>
                  </View>
                );
              })()}
              <TouchableOpacity onPress={doLog} disabled={logging} style={{ marginTop: 16, backgroundColor: logging ? '#A8C5A0' : '#7BA876', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>{logging ? 'Logging...' : 'Log to goal'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showCreate} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setShowCreate(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 14 }}>Create food</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Food name *" placeholderTextColor="#999" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 10, padding: 12, marginBottom: 10 }} />
              <TextInput value={serving} onChangeText={setServing} placeholder="Serving size" placeholderTextColor="#999" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 10, padding: 12, marginBottom: 10 }} />
              <TextInput value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="Calories *" placeholderTextColor="#999" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 10, padding: 12, marginBottom: 10 }} />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="Protein" placeholderTextColor="#999" style={{ flex: 1, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 10, padding: 12 }} />
                <TextInput value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="Carbs" placeholderTextColor="#999" style={{ flex: 1, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 10, padding: 12 }} />
                <TextInput value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="Fat" placeholderTextColor="#999" style={{ flex: 1, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 10, padding: 12 }} />
              </View>
              <TouchableOpacity onPress={createManual} style={{ backgroundColor: '#7BA876', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Save food</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

