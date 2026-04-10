import { useContext, useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getUserProfile } from '../../services/auth';
import {
  updateGoals,
  getTodaysMeals,
  deleteMeal,
  updateMealEntry,
  getTodayLog,
  addCustomFood,
  getDailyLogHistory,
  calculateStreak,
  getTodayCalorieGoalOverride,
  getActiveCalorieBank,
  clearTodayCalorieGoalOverride,
} from '../../services/database';
import { useRouter, useFocusEffect } from 'expo-router';

const { UserContext } = require('../_layout');

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 160; const sw = 10; const r = (size/2) - sw; const c = 2*Math.PI*r;
  const pct = Math.min((consumed/goal)*100,100); const offset = c-(pct/100)*c;
  const remaining = goal - consumed; const ratio = consumed/goal;
  const color = ratio >= 0.95 && ratio <= 1.1 ? '#7BA876' : ratio >= 0.85 ? '#D4A45A' : '#7BA876';
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8E8E6" strokeWidth={sw} />
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={offset}
          rotation="-90" origin={`${size/2}, ${size/2}`} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#2D2D2D' }}>{consumed}</Text>
        <Text style={{ fontSize: 12, color: '#999' }}>of {goal} cal</Text>
      </View>
      <Text style={{ marginTop: 6, fontSize: 13, color: remaining > 0 ? color : '#7BA876', fontWeight: '500' }}>
        {remaining > 0 ? `${remaining} cal remaining` : 'Goal reached!'}
      </Text>
    </View>
  );
}

function MacroBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = Math.min((current/goal)*100,100);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#2D2D2D' }}>{current}/{goal}g</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E8E8E6' }}>
        <View style={{ height: '100%', borderRadius: 3, backgroundColor: color, width: `${pct}%` }} />
      </View>
    </View>
  );
}

function EditGoalsModal({ visible, profile, onClose, onSave }: any) {
  const [calGoal, setCalGoal] = useState(String(profile?.calorieGoal || 2000));
  const [protGoal, setProtGoal] = useState(String(profile?.proteinGoal || 150));
  const [carbGoal, setCarbGoal] = useState(String(profile?.carbsGoal || 250));
  const [fatGoal, setFatGoal] = useState(String(profile?.fatGoal || 65));
  const [saving, setSaving] = useState(false);
  const calPresets = [1500, 1800, 2000, 2200, 2500];
  const inputStyle = { backgroundColor: 'white', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0DED9', fontSize: 16, fontWeight: '600' as const, color: '#2D2D2D', textAlign: 'center' as const };
  const handleSave = async () => {
    const cal = Number(calGoal);
    if (!cal || cal < 500 || cal > 10000) { Alert.alert('Invalid', 'Calorie goal must be 500-10,000'); return; }
    setSaving(true);
    await onSave({ calorieGoal: cal, proteinGoal: Number(protGoal)||150, carbsGoal: Number(carbGoal)||250, fatGoal: Number(fatGoal)||65 });
    setSaving(false);
  };
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' }}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>Edit goals</Text>
              <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: '#999' }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Daily calorie goal</Text>
            <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 8 }}>
              <TextInput value={calGoal} onChangeText={setCalGoal} keyboardType="numeric" style={{ fontSize: 42, fontWeight: '700', textAlign: 'center', color: '#2D2D2D', width: 160 }} />
              <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>calories per day</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {calPresets.map(v => (
                <TouchableOpacity key={v} onPress={() => setCalGoal(String(v))} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: calGoal===String(v)?1.5:1, borderColor: calGoal===String(v)?'#7BA876':'#E0DED9', backgroundColor: calGoal===String(v)?'#F0F5EE':'white' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: calGoal===String(v)?'#7BA876':'#666' }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Daily macro goals</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
              {[{ label:'Protein', value:protGoal, set:setProtGoal, color:'#7BA876' }, { label:'Carbs', value:carbGoal, set:setCarbGoal, color:'#D4A45A' }, { label:'Fat', value:fatGoal, set:setFatGoal, color:'#D4845A' }].map(m => (
                <View key={m.label} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 11, color: '#999' }}>{m.label}</Text>
                  </View>
                  <TextInput value={m.value} onChangeText={m.set} keyboardType="numeric" style={inputStyle} placeholder="0g" placeholderTextColor="#CCC" />
                  <Text style={{ fontSize: 10, color: '#CCC', textAlign: 'center', marginTop: 4 }}>grams</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ backgroundColor: saving?'#A8C5A0':'#7BA876', padding: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{saving ? 'Saving...' : 'Update goals'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function EditMealModal({ visible, meal, onClose, onSave, onDelete, onSaveToCustom }: any) {
  const [name, setName] = useState(meal?.name || '');
  const [calories, setCalories] = useState(String(meal?.calories || ''));
  const [protein, setProtein] = useState(String(meal?.protein || ''));
  const [carbs, setCarbs] = useState(String(meal?.carbs || ''));
  const [fat, setFat] = useState(String(meal?.fat || ''));
  const [serving, setServing] = useState(meal?.serving || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (meal) {
      setName(meal.name || ''); setCalories(String(meal.calories || ''));
      setProtein(String(meal.protein || '')); setCarbs(String(meal.carbs || ''));
      setFat(String(meal.fat || '')); setServing(meal.serving || '');
    }
  }, [meal]);

  const inputStyle = { backgroundColor: 'white', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0DED9', fontSize: 14, color: '#2D2D2D' };

  const handleSave = async () => {
    if (!name.trim() || !calories) return;
    setSaving(true);
    await onSave({
      name: name.trim(), calories: Number(calories)||0,
      protein: Number(protein)||0, carbs: Number(carbs)||0,
      fat: Number(fat)||0, serving: serving.trim() || '1 serving',
    });
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>Edit meal</Text>
              <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: '#999' }}>✕</Text></TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Name</Text>
            <TextInput style={{ ...inputStyle, marginBottom: 12 }} value={name} onChangeText={setName} />

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Serving</Text>
            <TextInput style={{ ...inputStyle, marginBottom: 12 }} value={serving} onChangeText={setServing} />

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Calories</Text>
            <TextInput style={{ ...inputStyle, marginBottom: 16, fontSize: 18, fontWeight: '600' }} value={calories} onChangeText={setCalories} keyboardType="numeric" />

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Macros</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {[{ val: protein, set: setProtein, label: 'Protein', color: '#7BA876' }, { val: carbs, set: setCarbs, label: 'Carbs', color: '#D4A45A' }, { val: fat, set: setFat, label: 'Fat', color: '#D4845A' }].map(m => (
                <View key={m.label} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 11, color: '#999' }}>{m.label}</Text>
                  </View>
                  <TextInput style={{ ...inputStyle, textAlign: 'center', padding: 10 }} value={m.val} onChangeText={m.set} keyboardType="numeric" placeholder="0g" placeholderTextColor="#CCC" />
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ backgroundColor: saving?'#A8C5A0':'#7BA876', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{saving ? 'Saving...' : 'Save changes'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onSaveToCustom({
              name: name.trim(), calories: Number(calories)||0,
              protein: Number(protein)||0, carbs: Number(carbs)||0,
              fat: Number(fat)||0, serving: serving.trim() || '1 serving',
            })} style={{
              padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 8,
              borderWidth: 1.5, borderColor: '#D4E8D1', backgroundColor: '#F6FAF5',
            }}>
              <Text style={{ color: '#7BA876', fontWeight: '600' }}>Save to my foods</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onDelete} style={{ padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#F0DAD5' }}>
              <Text style={{ color: '#D45A5A', fontWeight: '600' }}>Delete this meal</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const ctx = useContext(UserContext);
  const profile = ctx?.profile;
  const todayLog = ctx?.todayLog;
  const user = ctx?.user;
  const router = useRouter();

  const [showEditGoals, setShowEditGoals] = useState(false);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [editingMeal, setEditingMeal] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [todayGoalOverride, setTodayGoalOverride] = useState<number | null>(null);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const consumed = todayLog?.totalCalories || 0;
  const protein = todayLog?.totalProtein || 0;
  const carbs = todayLog?.totalCarbs || 0;
  const fat = todayLog?.totalFat || 0;
  const calGoal = todayGoalOverride || profile?.calorieGoal || 2000;
  const protGoal = profile?.proteinGoal || 150;
  const carbGoal = profile?.carbsGoal || 250;
  const fatGoal = profile?.fatGoal || 65;

  // Load today's meals
  useEffect(() => {
    if (!user?.uid) return;
    loadMeals();
  }, [user?.uid, todayLog]);

  useEffect(() => {
    if (!user?.uid || !profile?.calorieGoal) return;
    let mounted = true;
    (async () => {
      const history = await getDailyLogHistory(user.uid, 45);
      if (!mounted) return;
      setStreak(calculateStreak(history, profile.calorieGoal));
    })();
    return () => { mounted = false; };
  }, [user?.uid, profile?.calorieGoal, todayLog]);

  const refreshTodayGoalOverride = useCallback(async () => {
    if (!user?.uid) return;
    const activeBank = await getActiveCalorieBank(user.uid);
    const override = await getTodayCalorieGoalOverride(user.uid);
    if (!activeBank || (override?.calorieBankId && override.calorieBankId !== activeBank.id)) {
      if (override) await clearTodayCalorieGoalOverride(user.uid);
      setTodayGoalOverride(null);
      return;
    }
    setTodayGoalOverride(override?.calorieGoal || null);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await refreshTodayGoalOverride();
    })();
    return () => { mounted = false; };
  }, [refreshTodayGoalOverride, user?.uid, todayLog]);

  useFocusEffect(
    useCallback(() => {
      refreshTodayGoalOverride();
      return () => {};
    }, [refreshTodayGoalOverride])
  );

  const loadMeals = async () => {
    const meals = await getTodaysMeals(user.uid);
    setTodayMeals(meals);
  };

  const handleSaveGoals = async (goals: any) => {
    try {
      await updateGoals(user.uid, goals);
      const updated = await getUserProfile(user.uid);
      ctx.setProfile(updated);
      setShowEditGoals(false);
      Alert.alert('Goals updated!', `Calories: ${goals.calorieGoal} · P: ${goals.proteinGoal}g · C: ${goals.carbsGoal}g · F: ${goals.fatGoal}g`);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleEditMealSave = async (newMeal: any) => {
    try {
      await updateMealEntry(user.uid, editingMeal.id, editingMeal, newMeal);
      const updatedLog = await getTodayLog(user.uid);
      ctx.setTodayLog(updatedLog);
      setEditingMeal(null);
      Alert.alert('Updated!', `${newMeal.name} has been updated`);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleDeleteMeal = () => {
    Alert.alert(
      'Delete meal?',
      `Remove "${editingMeal.name}" (${editingMeal.calories} cal)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteMeal(user.uid, editingMeal.id, editingMeal);
              const updatedLog = await getTodayLog(user.uid);
              ctx.setTodayLog(updatedLog);
              setEditingMeal(null);
            } catch (err: any) { Alert.alert('Error', err.message); }
          }
        }
      ]
    );
  };

  const handleSaveToCustom = async (food: any) => {
    try {
      await addCustomFood(user.uid, food);
      setEditingMeal(null);
      Alert.alert('Saved!', `"${food.name}" added to your custom foods`);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleQuickDelete = (meal: any) => {
    Alert.alert(
      'Remove meal?',
      `Delete "${meal.name}" (${meal.calories} cal) from today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await deleteMeal(user.uid, meal.id, meal);
              const updatedLog = await getTodayLog(user.uid);
              ctx.setTodayLog(updatedLog);
            } catch (err: any) { Alert.alert('Error', err.message); }
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
          <Text style={{ fontSize: 14, color: '#999' }}>{greeting}</Text>
          <Text style={{ fontSize: 26, fontWeight: '700', marginTop: 4 }}>{profile?.name} 👋</Text>
        </View>

        {/* Today */}
        <View style={{ paddingHorizontal: 24, marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>Today</Text>
          <Text style={{ fontSize: 13, color: '#999' }}>{dateStr}</Text>
        </View>

        {/* Calorie Card */}
        <View style={{ marginHorizontal: 24, marginTop: 16, backgroundColor: 'white', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
          <CalorieRing consumed={consumed} goal={calGoal} />
          <TouchableOpacity onPress={() => setShowEditGoals(true)} style={{ alignSelf: 'center', marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F5F5F3' }}>
            <Text style={{ fontSize: 12, color: '#999', fontWeight: '500' }}>Tap to edit goals ✏️</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
            <MacroBar label="Protein" current={protein} goal={protGoal} color="#7BA876" />
            <MacroBar label="Carbs" current={carbs} goal={carbGoal} color="#D4A45A" />
            <MacroBar label="Fat" current={fat} goal={fatGoal} color="#D4845A" />
          </View>
          <TouchableOpacity onPress={() => router.push('/log-meal')} style={{
            marginTop: 24, backgroundColor: '#7BA876', padding: 14,
            borderRadius: 12, alignItems: 'center',
            shadowColor: '#7BA876', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8,
          }}>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>+ Log a meal</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Meals */}
        {todayMeals.length > 0 && (
          <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Today&apos;s meals</Text>
            <View style={{ backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
              {todayMeals.map((meal, i) => (
                <View key={meal.id} style={{
                  flexDirection: 'row', alignItems: 'center',
                  borderBottomWidth: i < todayMeals.length - 1 ? 1 : 0, borderBottomColor: '#F0F0EE',
                }}>
                  <TouchableOpacity onPress={() => setEditingMeal(meal)} style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 14, paddingHorizontal: 18, flex: 1,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F5F3', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16 }}>
                          {meal.mealType === 'Breakfast' ? '🥚' : meal.mealType === 'Lunch' ? '🥗' : meal.mealType === 'Dinner' ? '🍗' : '🥤'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{meal.name}</Text>
                        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{meal.mealType} · {meal.serving || ''}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#2D2D2D' }}>{meal.calories} cal</Text>
                      <Text style={{ fontSize: 10, color: '#CCC', marginTop: 2 }}>Tap to edit</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleQuickDelete(meal)}
                    style={{ paddingVertical: 14, paddingRight: 16, paddingLeft: 4 }}
                  >
                    <View style={{
                      width: 28, height: 28, borderRadius: 8,
                      backgroundColor: '#FDF2F0', justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 13, color: '#D45A5A' }}>✕</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Streak */}
        <View style={{ marginHorizontal: 24, marginTop: 16, backgroundColor: '#FFF8F0', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#F0E6DA' }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0A050' }}>
            <Text style={{ fontSize: 22 }}>🔥</Text>
          </View>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '700' }}>{streak} days</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 2 }}>Current streak</Text>
          </View>
        </View>
      </ScrollView>

      <EditGoalsModal visible={showEditGoals} profile={profile} onClose={() => setShowEditGoals(false)} onSave={handleSaveGoals} />
      <EditMealModal visible={!!editingMeal} meal={editingMeal} onClose={() => setEditingMeal(null)} onSave={handleEditMealSave} onDelete={handleDeleteMeal} onSaveToCustom={handleSaveToCustom} />
    </View>
  );
}