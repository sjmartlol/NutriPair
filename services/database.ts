import {
  doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ========== MEAL LOGGING ==========

export async function logMeal(uid, meal) {
  const today = new Date().toISOString().split('T')[0];

  await addDoc(collection(db, 'users', uid, 'meals'), {
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein || 0,
    carbs: meal.carbs || 0,
    fat: meal.fat || 0,
    serving: meal.serving,
    mealType: meal.mealType || 'Snack',
    date: today,
    timestamp: new Date()
  });

  const dailyRef = doc(db, 'users', uid, 'dailyLogs', today);
  const dailySnap = await getDoc(dailyRef);

  if (dailySnap.exists()) {
    const cur = dailySnap.data();
    await updateDoc(dailyRef, {
      totalCalories: cur.totalCalories + meal.calories,
      totalProtein: cur.totalProtein + (meal.protein || 0),
      totalCarbs: cur.totalCarbs + (meal.carbs || 0),
      totalFat: cur.totalFat + (meal.fat || 0),
      mealsLogged: cur.mealsLogged + 1
    });
  } else {
    await setDoc(dailyRef, {
      totalCalories: meal.calories,
      totalProtein: meal.protein || 0,
      totalCarbs: meal.carbs || 0,
      totalFat: meal.fat || 0,
      mealsLogged: 1,
      date: today
    });
  }
}

export async function getTodaysMeals(uid) {
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, 'users', uid, 'meals'),
    where('date', '==', today),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTodayLog(uid) {
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDoc(doc(db, 'users', uid, 'dailyLogs', today));
  if (snap.exists()) return snap.data();
  return { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, mealsLogged: 0 };
}

export function listenToDayLog(uid, date, callback) {
  return onSnapshot(doc(db, 'users', uid, 'dailyLogs', date), (snap) => {
    if (snap.exists()) callback(snap.data());
    else callback({ totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, mealsLogged: 0 });
  });
}

// ========== STREAK & HISTORY ==========

export async function getDailyLogHistory(uid, days = 45) {
  const logs = {};
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const snap = await getDoc(doc(db, 'users', uid, 'dailyLogs', dateStr));
    if (snap.exists()) logs[dateStr] = snap.data();
  }
  return logs;
}

export function calculateStreak(dailyLogs, calorieGoal) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const log = dailyLogs[dateStr];
    if (!log) { if (i === 0) continue; break; }
    const ratio = log.totalCalories / calorieGoal;
    if (ratio >= 0.95 && ratio <= 1.1) streak++;
    else { if (i === 0) continue; break; }
  }
  return streak;
}

// ========== PRESETS ==========

export async function getPresets(uid) {
  const snapshot = await getDocs(collection(db, 'users', uid, 'presets'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addPreset(uid, preset) {
  return await addDoc(collection(db, 'users', uid, 'presets'), preset);
}

export async function updatePreset(uid, presetId, data) {
  await updateDoc(doc(db, 'users', uid, 'presets', presetId), data);
}

export async function deletePreset(uid, presetId) {
  await deleteDoc(doc(db, 'users', uid, 'presets', presetId));
}

// ========== PARTNER PAIRING ==========

export async function findUserByCode(partnerCode) {
  const q = query(collection(db, 'users'), where('partnerCode', '==', partnerCode));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { uid: d.id, ...d.data() };
}

export async function pairPartners(uid1, uid2) {
  await updateDoc(doc(db, 'users', uid1), { partnerId: uid2 });
  await updateDoc(doc(db, 'users', uid2), { partnerId: uid1 });
}

export async function getPartnerData(partnerId) {
  const profile = await getDoc(doc(db, 'users', partnerId));
  if (!profile.exists()) return null;
  const today = new Date().toISOString().split('T')[0];
  const todayLog = await getDoc(doc(db, 'users', partnerId, 'dailyLogs', today));
  const meals = await getTodaysMeals(partnerId);
  return {
    ...profile.data(),
    uid: partnerId,
    todayLog: todayLog.exists() ? todayLog.data() : null,
    meals
  };
}

// ========== CUSTOM FOODS ==========

export async function getCustomFoods(uid: string) {
  const snapshot = await getDocs(collection(db, 'users', uid, 'customFoods'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCustomFood(uid: string, food: any) {
  const docRef = await addDoc(collection(db, 'users', uid, 'customFoods'), {
    name: food.name,
    calories: food.calories,
    protein: food.protein || 0,
    carbs: food.carbs || 0,
    fat: food.fat || 0,
    serving: food.serving || '1 serving',
    createdAt: new Date().toISOString(),
  });
  return { id: docRef.id, ...food };
}

export async function deleteCustomFood(uid: string, foodId: string) {
  await deleteDoc(doc(db, 'users', uid, 'customFoods', foodId));
}

// ========== USER SETTINGS ==========

export async function updateGoals(uid: string, goals: {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}) {
  await updateDoc(doc(db, 'users', uid), {
    calorieGoal: goals.calorieGoal,
    proteinGoal: goals.proteinGoal,
    carbsGoal: goals.carbsGoal,
    fatGoal: goals.fatGoal,
  });
}

// ========== DELETE/EDIT MEALS ==========

export async function deleteMeal(uid: string, mealId: string, meal: any) {
  const today = meal.date || new Date().toISOString().split('T')[0];

  // Delete the meal document
  await deleteDoc(doc(db, 'users', uid, 'meals', mealId));

  // Update daily log totals
  const dailyRef = doc(db, 'users', uid, 'dailyLogs', today);
  const dailySnap = await getDoc(dailyRef);

  if (dailySnap.exists()) {
    const cur = dailySnap.data();
    await updateDoc(dailyRef, {
      totalCalories: Math.max(0, cur.totalCalories - (meal.calories || 0)),
      totalProtein: Math.max(0, cur.totalProtein - (meal.protein || 0)),
      totalCarbs: Math.max(0, cur.totalCarbs - (meal.carbs || 0)),
      totalFat: Math.max(0, cur.totalFat - (meal.fat || 0)),
      mealsLogged: Math.max(0, cur.mealsLogged - 1),
    });
  }
}

export async function updateMealEntry(uid: string, mealId: string, oldMeal: any, newMeal: any) {
  const today = oldMeal.date || new Date().toISOString().split('T')[0];

  // Update the meal document
  await updateDoc(doc(db, 'users', uid, 'meals', mealId), {
    name: newMeal.name,
    calories: newMeal.calories,
    protein: newMeal.protein,
    carbs: newMeal.carbs,
    fat: newMeal.fat,
    serving: newMeal.serving,
  });

  // Update daily log with the difference
  const dailyRef = doc(db, 'users', uid, 'dailyLogs', today);
  const dailySnap = await getDoc(dailyRef);

  if (dailySnap.exists()) {
    const cur = dailySnap.data();
    await updateDoc(dailyRef, {
      totalCalories: Math.max(0, cur.totalCalories - oldMeal.calories + newMeal.calories),
      totalProtein: Math.max(0, cur.totalProtein - (oldMeal.protein || 0) + (newMeal.protein || 0)),
      totalCarbs: Math.max(0, cur.totalCarbs - (oldMeal.carbs || 0) + (newMeal.carbs || 0)),
      totalFat: Math.max(0, cur.totalFat - (oldMeal.fat || 0) + (newMeal.fat || 0)),
    });
  }
}

// ========== PROFILE ==========

export async function updateUserName(uid: string, name: string) {
  await updateDoc(doc(db, 'users', uid), { name });
}