import {
  doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ========== MEAL LOGGING ==========

export async function logMeal(uid, meal) {
  const today = formatLocalDate(new Date());

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
  const today = formatLocalDate(new Date());
  const q = query(
    collection(db, 'users', uid, 'meals'),
    where('date', '==', today),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTodayLog(uid) {
  const today = formatLocalDate(new Date());
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
    const dateStr = formatLocalDate(d);
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
    const dateStr = formatLocalDate(d);
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
  const today = formatLocalDate(new Date());
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
  const today = meal.date || formatLocalDate(new Date());

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
  const today = oldMeal.date || formatLocalDate(new Date());

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

// ========== ONBOARDING ==========

export async function completeOnboarding(uid: string) {
  await updateDoc(doc(db, 'users', uid), { onboardingComplete: true });
}

// ========== WEEKLY CHALLENGES ==========

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function createChallenge(uid: string, partnerId: string, calorieGoal: number, partnerCalorieGoal: number, cheatDay: string, partnerCheatDay: string, autoRenew: boolean = true) {
  const challengeRef = await addDoc(collection(db, 'challenges'), {
    createdBy: uid,
    participants: [uid, partnerId],
    startDate: null,
    endDate: null,
    goals: {
      [uid]: { dailyGoal: calorieGoal, cheatDay },
      [partnerId]: { dailyGoal: partnerCalorieGoal, cheatDay: partnerCheatDay },
    },
    autoRenew,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  return challengeRef.id;
}

export async function acceptChallenge(challengeId: string, overrideStartDate?: string) {
  const DAYS_MAP: Record<string, number> = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };

  const challengeSnap = await getDoc(doc(db, 'challenges', challengeId));
  if (!challengeSnap.exists()) throw new Error('Challenge not found');

  const challenge = challengeSnap.data();
  const creatorId = challenge.createdBy;
  const creatorGoals = challenge.goals[creatorId];

  const startDate = overrideStartDate || formatLocalDate(new Date());
  const startD = parseLocalDate(startDate);
  const cheatDayNum = DAYS_MAP[creatorGoals.cheatDay];
  const daysToCheat = (cheatDayNum - startD.getDay() + 7) % 7;
  if (daysToCheat === 0) throw new Error('Cannot start on cheat day');

  const endD = new Date(startD);
  endD.setDate(endD.getDate() + daysToCheat);

  const updatedGoals: Record<string, any> = {};
  for (const [uid, goals] of Object.entries(challenge.goals) as [string, any][]) {
    updatedGoals[uid] = {
      ...goals,
      weeklyBudget: goals.dailyGoal * daysToCheat,
      totalDays: daysToCheat,
    };
  }

  await updateDoc(doc(db, 'challenges', challengeId), {
    startDate,
    endDate: formatLocalDate(endD),
    goals: updatedGoals,
    status: 'active',
    acceptedAt: new Date().toISOString(),
  });
}

export async function declineChallenge(challengeId: string) {
  await updateDoc(doc(db, 'challenges', challengeId), {
    status: 'declined',
  });
}

export async function getPendingChallenge(uid: string) {
  const q = query(
    collection(db, 'challenges'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getActiveChallenge(uid: string) {
  const q = query(
    collection(db, 'challenges'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function getChallengeProgress(uid: string, startDate: string, endDate: string) {
  let total = 0;
  const days = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const today = new Date();
  const todayStr = formatLocalDate(today);

  for (let d = new Date(start); d <= end && formatLocalDate(d) <= todayStr; d.setDate(d.getDate() + 1)) {
    const dateStr = formatLocalDate(d);
    const snap = await getDoc(doc(db, 'users', uid, 'dailyLogs', dateStr));
    const cal = snap.exists() ? snap.data().totalCalories : 0;
    total += cal;
    days.push({
      date: dateStr,
      day: new Date(d).toLocaleDateString('en-US', { weekday: 'short' }),
      calories: cal,
      isToday: dateStr === todayStr,
    });
  }

  return { total, days };
}

export async function completeChallenge(challengeId: string, results: any) {
  await updateDoc(doc(db, 'challenges', challengeId), {
    status: 'completed',
    results,
    completedAt: new Date().toISOString(),
  });
}

export async function getPastChallenges(uid: string) {
  const q = query(
    collection(db, 'challenges'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'completed')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function toggleAutoRenew(challengeId: string, autoRenew: boolean) {
  await updateDoc(doc(db, 'challenges', challengeId), { autoRenew });
}