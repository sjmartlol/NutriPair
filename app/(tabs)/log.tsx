import { CameraView, useCameraPermissions } from 'expo-camera';
import { lookupBarcode } from '../../services/foodSearch';
import { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { logMeal, getTodayLog, getCustomFoods, addCustomFood } from '../../services/database';
import { searchFoods, FoodResult } from '../../services/foodSearch';

const { UserContext } = require('../_layout');

const BUILT_IN_FOODS = [
  { id: 'b1', name: "Grilled Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 3.6, serving: "100g" },
  { id: 'b2', name: "Brown Rice", calories: 216, protein: 5, carbs: 45, fat: 1.8, serving: "1 cup" },
  { id: 'b3', name: "Scrambled Eggs (2)", calories: 182, protein: 12, carbs: 2, fat: 14, serving: "2 eggs" },
  { id: 'b4', name: "Greek Yogurt", calories: 100, protein: 17, carbs: 6, fat: 0.7, serving: "170g" },
  { id: 'b5', name: "Banana", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, serving: "1 medium" },
  { id: 'b6', name: "Avocado Toast", calories: 290, protein: 7, carbs: 30, fat: 16, serving: "1 slice" },
  { id: 'b7', name: "Salmon Fillet", calories: 208, protein: 20, carbs: 0, fat: 13, serving: "100g" },
  { id: 'b8', name: "Mixed Green Salad", calories: 45, protein: 2, carbs: 8, fat: 0.5, serving: "1 bowl" },
  { id: 'b9', name: "Protein Shake", calories: 220, protein: 30, carbs: 12, fat: 5, serving: "1 shake" },
  { id: 'b10', name: "Oatmeal", calories: 154, protein: 5, carbs: 27, fat: 2.6, serving: "1 cup" },
  { id: 'b11', name: "Turkey Sandwich", calories: 350, protein: 24, carbs: 36, fat: 12, serving: "1 sandwich" },
  { id: 'b12', name: "Apple", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, serving: "1 medium" },
];

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

const QUICK_ADD: Record<string, string[]> = {
  Breakfast: ['b3', 'b10', 'b6'],
  Lunch: ['b8', 'b11', 'b4'],
  Dinner: ['b1', 'b2', 'b7'],
  Snack: ['b5', 'b12', 'b9'],
};

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${color}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: '#666' }}>{value}{unit} {label}</Text>
    </View>
  );
}

function FoodRow({ food, added, onToggle, tag }: { food: any; added: boolean; onToggle: () => void; tag?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEECE9' }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#2D2D2D' }}>{food.name}</Text>
          {tag && (
            <View style={{ backgroundColor: tag === 'Custom' ? '#F0F5EE' : '#EEF2FA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: tag === 'Custom' ? '#7BA876' : '#8BA4D4', textTransform: 'uppercase', letterSpacing: 0.5 }}>{tag}</Text>
            </View>
          )}
        </View>
        {food.brand && <Text style={{ fontSize: 11, color: '#BBB', marginTop: 1 }}>{food.brand}</Text>}
        <Text style={{ fontSize: 12, color: '#999', marginTop: 3, marginBottom: 6 }}>{food.serving} · {food.calories} cal</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <MacroPill label="P" value={food.protein} unit="g" color="#7BA876" />
          <MacroPill label="C" value={food.carbs} unit="g" color="#D4A45A" />
          <MacroPill label="F" value={food.fat} unit="g" color="#D4845A" />
        </View>
      </View>
      <TouchableOpacity onPress={onToggle} style={{
        width: 36, height: 36, borderRadius: 10, marginLeft: 12,
        borderWidth: added ? 0 : 1.5, borderColor: '#D8D8D6',
        backgroundColor: added ? '#7BA876' : 'transparent',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ color: added ? 'white' : '#999', fontSize: 18, fontWeight: '300' }}>
          {added ? '✓' : '+'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function CreateFoodModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (food: any) => void }) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [serving, setServing] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = name.trim() && calories.trim();

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      serving: serving.trim() || '1 serving',
    });
    setName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setServing('');
    setSaving(false);
  };

  const inputStyle = {
    backgroundColor: 'white', padding: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E0DED9', fontSize: 14, color: '#2D2D2D',
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>Create custom food</Text>
              <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: '#999' }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Food name *</Text>
            <TextInput style={{ ...inputStyle, marginBottom: 12 }} placeholder="e.g. Mom's pasta salad" placeholderTextColor="#CCC" value={name} onChangeText={setName} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Serving size</Text>
            <TextInput style={{ ...inputStyle, marginBottom: 12 }} placeholder="e.g. 1 bowl, 100g" placeholderTextColor="#CCC" value={serving} onChangeText={setServing} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Calories *</Text>
            <TextInput style={{ ...inputStyle, marginBottom: 16, fontSize: 18, fontWeight: '600' }} placeholder="0" placeholderTextColor="#CCC" value={calories} onChangeText={setCalories} keyboardType="numeric" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Macros (optional)</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {[
                { val: protein, set: setProtein, label: 'Protein', color: '#7BA876' },
                { val: carbs, set: setCarbs, label: 'Carbs', color: '#D4A45A' },
                { val: fat, set: setFat, label: 'Fat', color: '#D4845A' },
              ].map(m => (
                <View key={m.label} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 11, color: '#999' }}>{m.label}</Text>
                  </View>
                  <TextInput style={{ ...inputStyle, textAlign: 'center', padding: 10 }} placeholder="0g" placeholderTextColor="#CCC" value={m.val} onChangeText={m.set} keyboardType="numeric" />
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleSave} disabled={!isValid || saving} style={{
              backgroundColor: isValid ? '#7BA876' : '#D8D8D6', padding: 14, borderRadius: 12, alignItems: 'center',
            }}>
              <Text style={{ color: isValid ? 'white' : '#999', fontWeight: '600', fontSize: 15 }}>{saving ? 'Saving...' : 'Add custom food'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function LogMealScreen() {
  const ctx = useContext(UserContext);
  const user = ctx?.user;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('Breakfast');
  const [addedFoods, setAddedFoods] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCreateFood, setShowCreateFood] = useState(false);
  const [customFoods, setCustomFoods] = useState<any[]>([]);

  // API search state
  const [apiResults, setApiResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const foods = await getCustomFoods(user.uid);
      setCustomFoods(foods);
    })();
  }, [user?.uid]);

  // Debounced search — waits 500ms after you stop typing, then searches
  useEffect(() => {
    if (searchQuery.length < 2) {
      setApiResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchFoods(searchQuery);
      setApiResults(results);
      setSearching(false);
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  // Local matches (custom + built-in)
  const localMatches = searchQuery.length >= 2
    ? [...customFoods.map(f => ({ ...f, _tag: 'Custom' })), ...BUILT_IN_FOODS]
        .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const quickFoodIds = QUICK_ADD[selectedMealType] || [];
  const quickFoods = BUILT_IN_FOODS.filter(f => quickFoodIds.includes(f.id));

  const totalCalories = addedFoods.reduce((s, f) => s + f.calories, 0);
  const totalProtein = addedFoods.reduce((s, f) => s + f.protein, 0);
  const isAdded = (id: any) => addedFoods.some(f => f.id === id);

  const handleToggle = (food: any) => {
    if (isAdded(food.id)) setAddedFoods(addedFoods.filter(f => f.id !== food.id));
    else setAddedFoods([...addedFoods, food]);
  };

  const handleSave = async () => {
    if (!user || addedFoods.length === 0) return;
    setSaving(true);
    try {
      for (const food of addedFoods) {
        await logMeal(user.uid, { ...food, mealType: selectedMealType });
      }
      const updatedLog = await getTodayLog(user.uid);
      ctx.setTodayLog(updatedLog);
      setAddedFoods([]);
      Alert.alert('Meal logged!', `+${totalCalories} calories added`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  const handleCreateFood = async (food: any) => {
    try {
      const saved = await addCustomFood(user.uid, food);
      setCustomFoods([{ ...food, id: saved.id }, ...customFoods]);
      setAddedFoods([...addedFoods, { ...food, id: saved.id }]);
      setShowCreateFood(false);
      Alert.alert('Created!', `"${food.name}" added to your foods`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const scanLock = useRef(false);

  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setShowScanner(false);

    const food = await lookupBarcode(data).catch(() => null);

    if (food && food.calories > 0) {
      Alert.alert(
        food.name,
        `${food.brand ? `${food.brand}\n` : ''}${food.calories} cal · ${food.protein}g P · ${food.carbs}g C · ${food.fat}g F`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { scanLock.current = false; } },
          { text: 'Add to meal', onPress: () => {
            setAddedFoods(prev => [...prev, food]);
            scanLock.current = false;
          }},
        ]
      );
    } else if (food) {
      Alert.alert('No nutrition data', `Found "${food.name}" but no calorie info available.`, [
        { text: 'OK', onPress: () => { scanLock.current = false; } },
      ]);
    } else {
      Alert.alert('Not found', 'This barcode wasn\'t in the database. Try searching by name.', [
        { text: 'OK', onPress: () => { scanLock.current = false; } },
      ]);
    }
  };
  
  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera needed', 'Please allow camera access to scan barcodes.');
        return;
      }
    }
    scanLock.current = false;
    setShowScanner(true);
  };

  const isSearching = searchQuery.length >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: addedFoods.length > 0 ? 160 : 40 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>Log a meal</Text>
          <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>Logging as {ctx?.profile?.name}</Text>
        </View>

        {/* Meal Type Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ paddingLeft: 24, marginTop: 16 }}
          contentContainerStyle={{ gap: 8, paddingRight: 24 }}>
          {MEAL_TYPES.map(type => {
            const active = selectedMealType === type;
            const emoji = type === 'Breakfast' ? '🥚' : type === 'Lunch' ? '🥗' : type === 'Dinner' ? '🍗' : '🥤';
            return (
              <TouchableOpacity key={type} onPress={() => setSelectedMealType(type)} style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
                backgroundColor: active ? '#2D2D2D' : 'white',
                borderWidth: active ? 0 : 1.5, borderColor: '#E0DED9',
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}>
                <Text>{emoji}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: active ? 'white' : '#666' }}>{type}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Bar */}
        <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
            borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
            borderWidth: 1.5, borderColor: '#E0DED9',
          }}>
            <Text style={{ color: '#999', marginRight: 10 }}>🔍</Text>
            <TextInput
              placeholder="Search thousands of foods..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ flex: 1, fontSize: 15, color: '#2D2D2D' }}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ color: '#999', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
	  {/* Barcode + Create Row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TouchableOpacity onPress={openScanner} style={{
              flex: 1, paddingVertical: 11, paddingHorizontal: 16,
              borderRadius: 10, backgroundColor: '#2D2D2D',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Text style={{ fontSize: 16 }}>📷</Text>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Scan barcode</Text>
            </TouchableOpacity>
          {/* Create Custom Food Button */}
          <TouchableOpacity onPress={() => setShowCreateFood(true)} style={{
              flex: 1, paddingVertical: 11, paddingHorizontal: 16,
              borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C8C6C1',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Text style={{ color: '#888', fontSize: 16 }}>+</Text>
              <Text style={{ color: '#888', fontSize: 13, fontWeight: '600' }}>Custom food</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Search Results */}
        {isSearching ? (
          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            {/* Local matches */}
            {localMatches.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', marginBottom: 8 }}>
                  Your foods
                </Text>
                {localMatches.map(food => (
                  <FoodRow key={food.id} food={food} added={isAdded(food.id)}
                    onToggle={() => handleToggle(food)} tag={(food as any)._tag} />
                ))}
              </>
            )}

            {/* API results */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', marginTop: 16, marginBottom: 8 }}>
              {searching ? 'Searching food database...' : `${apiResults.length} results from food database`}
            </Text>

            {searching ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color="#7BA876" />
              </View>
            ) : apiResults.length === 0 && localMatches.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>🔍</Text>
                <Text style={{ color: '#999', marginBottom: 12 }}>No foods found</Text>
                <TouchableOpacity onPress={() => { setSearchQuery(''); setShowCreateFood(true); }}>
                  <Text style={{ color: '#7BA876', fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' }}>
                    Create it as a custom food
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              apiResults.map(food => (
                <FoodRow key={food.id} food={food} added={isAdded(food.id)}
                  onToggle={() => handleToggle(food)} tag="API" />
              ))
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
            {/* Custom Foods */}
            {customFoods.length > 0 && (
              <>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 12 }}>Your custom foods</Text>
                {customFoods.map(food => (
                  <FoodRow key={food.id} food={food} added={isAdded(food.id)}
                    onToggle={() => handleToggle(food)} tag="Custom" />
                ))}
                <View style={{ height: 16 }} />
              </>
            )}

            <Text style={{ fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 12 }}>
              Quick add — {selectedMealType}
            </Text>
            {quickFoods.map(food => (
              <FoodRow key={food.id} food={food} added={isAdded(food.id)} onToggle={() => handleToggle(food)} />
            ))}

            <Text style={{ fontSize: 14, fontWeight: '600', color: '#999', marginTop: 24, marginBottom: 12 }}>
              All foods
            </Text>
            {BUILT_IN_FOODS.map(food => (
              <FoodRow key={food.id} food={food} added={isAdded(food.id)} onToggle={() => handleToggle(food)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Save Bar */}
      {addedFoods.length > 0 && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E8E8E6',
          paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#999' }}>{addedFoods.length} item{addedFoods.length !== 1 ? 's' : ''}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <MacroPill label="" value={totalCalories} unit=" cal" color="#2D2D2D" />
              <MacroPill label="P" value={Math.round(totalProtein)} unit="g" color="#7BA876" />
            </View>
          </View>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={{
            backgroundColor: saving ? '#A8C5A0' : '#7BA876', padding: 14,
            borderRadius: 12, alignItems: 'center',
          }}>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>
              {saving ? 'Saving...' : `Save to ${selectedMealType}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Barcode Scanner Modal */}
      <Modal visible={showScanner} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ paddingTop: 56, paddingHorizontal: 24, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: 'white' }}>Scan barcode</Text>
              <TouchableOpacity onPress={() => { setShowScanner(false); setScanningBarcode(false); }}>
                <Text style={{ fontSize: 16, color: 'white', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              Point your camera at a food barcode
            </Text>
          </View>

          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
            onBarcodeScanned={handleBarcodeScan}
          />

          <View style={{
            position: 'absolute', top: '40%', left: '15%', right: '15%',
            height: 120, borderWidth: 2, borderColor: '#7BA876',
            borderRadius: 12, backgroundColor: 'transparent',
          }}>
            <View style={{ position: 'absolute', bottom: -30, left: 0, right: 0, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                Align barcode in frame
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      <CreateFoodModal visible={showCreateFood} onClose={() => setShowCreateFood(false)} onSave={handleCreateFood} />
    </View>
  );
}