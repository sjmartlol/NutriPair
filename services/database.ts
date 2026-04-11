import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc, getDocs,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
    where
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

export async function getMyFoods(uid: string) {
  const foods = await getCustomFoods(uid);
  return foods;
}

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
    // Optional metadata (safe to ignore elsewhere)
    source: food.source || 'custom',
    barcode: food.barcode || null,
    externalId: food.externalId || null,
    servingsCount: food.servingsCount || null,
    baseCalories: food.baseCalories || null,
    baseProtein: food.baseProtein || null,
    baseCarbs: food.baseCarbs || null,
    baseFat: food.baseFat || null,
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

export async function setTodayCalorieGoalOverride(uid: string, calorieGoal: number, calorieBankId?: string) {
  const today = formatLocalDate(new Date());
  await setDoc(doc(db, 'users', uid, 'dailyGoalOverrides', today), {
    date: today,
    calorieGoal,
    calorieBankId: calorieBankId || null,
    updatedAt: new Date().toISOString(),
  });
}

export async function getTodayCalorieGoalOverride(uid: string) {
  const today = formatLocalDate(new Date());
  const snap = await getDoc(doc(db, 'users', uid, 'dailyGoalOverrides', today));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function clearTodayCalorieGoalOverride(uid: string) {
  const today = formatLocalDate(new Date());
  await deleteDoc(doc(db, 'users', uid, 'dailyGoalOverrides', today));
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

// ========== CALORIE BANKING ==========

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

const DAYS_MAP: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

function getNextDateForWeekday(startDateStr: string, weekday: string): string {
  const start = parseLocalDate(startDateStr);
  const target = DAYS_MAP[weekday];
  const delta = (target - start.getDay() + 7) % 7;
  const result = new Date(start);
  result.setDate(result.getDate() + (delta === 0 ? 7 : delta));
  return formatLocalDate(result);
}

function resolveTargetDate(startDate: string, config: any) {
  if (config?.oneOffTargetDate) return config.oneOffTargetDate;
  return getNextDateForWeekday(startDate, config?.recurringTargetDay || 'Saturday');
}

export async function createCalorieBank(
  uid: string,
  partnerId: string | null,
  myConfig: any,
  partnerConfig?: any,
  autoRenew: boolean = true
) {
  const participants = partnerId ? [uid, partnerId] : [uid];
  const goals: Record<string, any> = {
    [uid]: {
      dailyGoal: myConfig.dailyGoal,
      recurringTargetDay: myConfig.recurringTargetDay || 'Saturday',
      oneOffTargetDate: myConfig.oneOffTargetDate || null,
      targetGoalCalories: myConfig.targetGoalCalories || null,
    },
  };

  if (partnerId) {
    goals[partnerId] = {
      dailyGoal: partnerConfig?.dailyGoal || 2000,
      recurringTargetDay: partnerConfig?.recurringTargetDay || 'Saturday',
      oneOffTargetDate: partnerConfig?.oneOffTargetDate || null,
      targetGoalCalories: partnerConfig?.targetGoalCalories || null,
    };
  }

  const bankRef = await addDoc(collection(db, 'calorieBanks'), {
    createdBy: uid,
    participants,
    startDate: null,
    endDate: null,
    goals,
    autoRenew,
    status: partnerId ? 'pending' : 'active',
    createdAt: new Date().toISOString(),
    acceptedAt: partnerId ? null : new Date().toISOString(),
  });

  if (!partnerId) {
    await acceptCalorieBankInvite(bankRef.id);
  }

  return bankRef.id;
}

export async function acceptCalorieBankInvite(calorieBankId: string, overrideStartDate?: string) {
  const bankSnap = await getDoc(doc(db, 'calorieBanks', calorieBankId));
  if (!bankSnap.exists()) throw new Error('Calorie bank not found');

  const bank = bankSnap.data();
  const startDate = overrideStartDate || formatLocalDate(new Date());
  const updatedGoals: Record<string, any> = {};

  let resolvedEndDate: string | null = null;
  for (const [memberUid, goals] of Object.entries(bank.goals) as [string, any][]) {
    const targetDate = resolveTargetDate(startDate, goals);
    if (!resolvedEndDate || targetDate < resolvedEndDate) resolvedEndDate = targetDate;
    const days = Math.max(1, Math.round((parseLocalDate(targetDate).getTime() - parseLocalDate(startDate).getTime()) / (1000 * 60 * 60 * 24)));
    updatedGoals[memberUid] = {
      ...goals,
      targetDate,
      totalDays: days,
      budget: (goals.dailyGoal || 2000) * days,
    };
  }

  await updateDoc(doc(db, 'calorieBanks', calorieBankId), {
    startDate,
    endDate: resolvedEndDate,
    goals: updatedGoals,
    status: 'active',
    acceptedAt: new Date().toISOString(),
  });
}

export async function declineCalorieBank(calorieBankId: string) {
  await updateDoc(doc(db, 'calorieBanks', calorieBankId), {
    status: 'declined',
  });
}

export async function getPendingCalorieBank(uid: string) {
  const q = query(
    collection(db, 'calorieBanks'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getActiveCalorieBank(uid: string) {
  const q = query(
    collection(db, 'calorieBanks'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function getCalorieBankProgress(
  uid: string,
  calorieBankId: string,
  startDate: string,
  endDate: string,
  dailyGoal: number,
  includeManualEntries: boolean = true
) {
  let total = 0;
  const days = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const today = new Date();
  const todayStr = formatLocalDate(today);
  // `endDate` is treated as the target/spend day, so banking accrues before it.
  for (let d = new Date(start); d < end && formatLocalDate(d) <= todayStr; d.setDate(d.getDate() + 1)) {
    const dateStr = formatLocalDate(d);
    const snap = await getDoc(doc(db, 'users', uid, 'dailyLogs', dateStr));
    const data = snap.exists() ? snap.data() : null;
    const cal = data?.totalCalories || 0;
    const hasLogData = !!data && ((data.mealsLogged || 0) > 0 || cal > 0);
    total += cal;
    // Do not auto-bank on the bank start day; banking begins after setup day.
    // Also do not auto-bank a full day from missing/no-log days.
    const isStartDay = dateStr === startDate;
    const autoBanked = !isStartDay && hasLogData ? Math.max(0, dailyGoal - cal) : 0;
    days.push({
      date: dateStr,
      day: new Date(d).toLocaleDateString('en-US', { weekday: 'short' }),
      calories: cal,
      autoBanked,
      isToday: dateStr === todayStr,
    });
  }

  const manual = includeManualEntries
    ? await getCalorieBankAdjustments(uid, calorieBankId)
    : { entries: [], totalAdjustments: 0, totalSpent: 0 };
  const autoBankedTotal = days.reduce((sum: number, day: any) => sum + day.autoBanked, 0);
  const availableBank = Math.max(0, autoBankedTotal + manual.totalAdjustments - manual.totalSpent);
  return {
    totalCalories: total,
    days,
    autoBankedTotal,
    manualAdjustments: manual.totalAdjustments,
    manualSpent: manual.totalSpent,
    availableBank,
    entries: manual.entries,
  };
}

export async function completeCalorieBank(calorieBankId: string, results: any) {
  await updateDoc(doc(db, 'calorieBanks', calorieBankId), {
    status: 'completed',
    results,
    completedAt: new Date().toISOString(),
  });
}

export async function getPastCalorieBanks(uid: string) {
  const q = query(
    collection(db, 'calorieBanks'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'completed')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function toggleCalorieBankAutoRenew(calorieBankId: string, autoRenew: boolean) {
  await updateDoc(doc(db, 'calorieBanks', calorieBankId), { autoRenew });
}

export async function setCalorieBankAutoAdjustTarget(
  calorieBankId: string,
  uid: string,
  enabled: boolean,
  baseDailyGoal?: number
) {
  const payload: Record<string, any> = {
    [`goals.${uid}.autoAdjustDailyTarget`]: enabled,
  };
  if (typeof baseDailyGoal === 'number') {
    payload[`goals.${uid}.baseDailyGoal`] = baseDailyGoal;
  }
  await updateDoc(doc(db, 'calorieBanks', calorieBankId), payload);
}

export async function setCalorieBankSpendAffectsGoal(calorieBankId: string, uid: string, enabled: boolean) {
  await updateDoc(doc(db, 'calorieBanks', calorieBankId), {
    [`goals.${uid}.spendAffectsTodayGoal`]: enabled,
  });
}

export async function addCalorieBankAdjustment(
  uid: string,
  calorieBankId: string,
  amount: number,
  entryType: 'adjustment' | 'spend',
  note: string = ''
) {
  if (!amount || amount < 0) throw new Error('Amount must be positive');
  return addDoc(collection(db, 'users', uid, 'calorieBankEntries'), {
    calorieBankId,
    amount,
    type: entryType,
    note,
    createdAt: new Date().toISOString(),
    date: formatLocalDate(new Date()),
  });
}

export async function getCalorieBankAdjustments(uid: string, calorieBankId: string) {
  const q = query(
    collection(db, 'users', uid, 'calorieBankEntries'),
    where('calorieBankId', '==', calorieBankId)
  );
  const snapshot = await getDocs(q);
  const entries = snapshot.docs
    .map((d: any) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
  const totalAdjustments = entries
    .filter((e: any) => e.type === 'adjustment')
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const totalSpent = entries
    .filter((e: any) => e.type === 'spend')
    .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  return { entries, totalAdjustments, totalSpent };
}

// ========== LEGACY CHALLENGE WRAPPERS ==========
// Kept for compatibility while screens migrate fully to calorie banking.
export async function createChallenge(uid: string, partnerId: string, calorieGoal: number, partnerCalorieGoal: number, cheatDay: string, partnerCheatDay: string, autoRenew: boolean = true) {
  return createCalorieBank(
    uid,
    partnerId,
    { dailyGoal: calorieGoal, recurringTargetDay: cheatDay },
    { dailyGoal: partnerCalorieGoal, recurringTargetDay: partnerCheatDay },
    autoRenew
  );
}

export async function acceptChallenge(challengeId: string, overrideStartDate?: string) {
  return acceptCalorieBankInvite(challengeId, overrideStartDate);
}

export async function declineChallenge(challengeId: string) {
  return declineCalorieBank(challengeId);
}

export async function getPendingChallenge(uid: string) {
  return getPendingCalorieBank(uid);
}

export async function getActiveChallenge(uid: string) {
  return getActiveCalorieBank(uid);
}

export async function getChallengeProgress(uid: string, startDate: string, endDate: string) {
  const active = await getActiveCalorieBank(uid);
  if (!active) return { total: 0, days: [] };
  const progress = await getCalorieBankProgress(uid, active.id, startDate, endDate, active.goals?.[uid]?.dailyGoal || 2000);
  return { total: progress.totalCalories, days: progress.days };
}

export async function completeChallenge(challengeId: string, results: any) {
  return completeCalorieBank(challengeId, results);
}

export async function getPastChallenges(uid: string) {
  return getPastCalorieBanks(uid);
}

export async function toggleAutoRenew(challengeId: string, autoRenew: boolean) {
  return toggleCalorieBankAutoRenew(challengeId, autoRenew);
}