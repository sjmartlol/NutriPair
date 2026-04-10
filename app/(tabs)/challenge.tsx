import { useState, useContext, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import {
  getActiveCalorieBank,
  createCalorieBank,
  acceptCalorieBankInvite,
  declineCalorieBank,
  getPendingCalorieBank,
  getCalorieBankProgress,
  completeCalorieBank,
  getPastCalorieBanks,
  getPartnerData,
  toggleCalorieBankAutoRenew,
  addCalorieBankAdjustment,
  setCalorieBankAutoAdjustTarget,
  updateGoals,
  setTodayCalorieGoalOverride,
  getTodayCalorieGoalOverride,
  clearTodayCalorieGoalOverride,
} from '../../services/database';
import { getPartnerPushToken, sendCalorieBankInvite } from '../../services/notifications';

import { UserContext } from '../_layout';

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_EMOJIS: Record<string, string> = { Monday: '1', Tuesday: '2', Wednesday: '3', Thursday: '4', Friday: '5', Saturday: 'T', Sunday: 'S' };

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function CalorieBankScreen() {
  const ctx = useContext(UserContext);
  const user = ctx?.user;
  const profile = ctx?.profile;

  const [bank, setBank] = useState<any>(null);
  const [pendingBank, setPendingBank] = useState<any>(null);
  const [pendingPartner, setPendingPartner] = useState<any>(null);
  const [myProgress, setMyProgress] = useState<any>(null);
  const [partnerProgress, setPartnerProgress] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [pastBanks, setPastBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [myTargetDay, setMyTargetDay] = useState('Saturday');
  const [targetGoalCalories, setTargetGoalCalories] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [showManualAdjust, setShowManualAdjust] = useState(false);
  const [showSpend, setShowSpend] = useState(false);
  const [manualModeEnabled, setManualModeEnabled] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [autoRenewOption, setAutoRenewOption] = useState(true);
  const [startMode, setStartMode] = useState<'solo' | 'partner'>('solo');
  const [autoAdjustTargetEnabled, setAutoAdjustTargetEnabled] = useState(false);
  const [todayGoalOverride, setTodayGoalOverride] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    loadCalorieBank();
  }, [ctx?.todayLog, loadCalorieBank, user?.uid]);

  const loadCalorieBank = useCallback(async () => {
    setLoading(true);
    try {
      const active = await getActiveCalorieBank(user.uid);
      setBank(active);

      if (active) {
        setPendingBank(null);
        setPendingPartner(null);
        setAutoAdjustTargetEnabled(!!active.goals?.[user.uid]?.autoAdjustDailyTarget);
        const override = await getTodayCalorieGoalOverride(user.uid);
        if (override?.calorieBankId && override.calorieBankId !== active.id) {
          await clearTodayCalorieGoalOverride(user.uid);
          setTodayGoalOverride(null);
        } else {
          setTodayGoalOverride(override?.calorieGoal || null);
        }

        const myDailyGoal = active.goals?.[user.uid]?.dailyGoal || profile?.calorieGoal || 2000;
        const myP = await getCalorieBankProgress(user.uid, active.id, active.startDate, active.endDate, myDailyGoal);
        setMyProgress(myP);

        const partnerId = active.participants.find((p: string) => p !== user.uid);
        if (partnerId) {
          const pData = await getPartnerData(partnerId);
          setPartner(pData);
          const partnerDailyGoal = active.goals?.[partnerId]?.dailyGoal || 2000;
          const partP = await getCalorieBankProgress(partnerId, active.id, active.startDate, active.endDate, partnerDailyGoal, false);
          setPartnerProgress(partP);
        }

        const todayCheck = formatLocalDate(new Date());
        if (todayCheck > active.endDate && active.status === 'active') {
          const pId = active.participants.find((p: string) => p !== user.uid);
          const results: any = {
            [user.uid]: {
              autoBanked: myP.autoBankedTotal || 0,
              adjustments: myP.manualAdjustments || 0,
              spent: myP.manualSpent || 0,
              availableBank: myP.availableBank || 0,
              targetGoalCalories: active.goals?.[user.uid]?.targetGoalCalories || null,
              hitTarget: active.goals?.[user.uid]?.targetGoalCalories
                ? (myP.availableBank || 0) >= active.goals[user.uid].targetGoalCalories
                : null,
            },
          };
          if (pId) {
            const partnerDailyGoal = active.goals?.[pId]?.dailyGoal || 2000;
            const partP = await getCalorieBankProgress(pId, active.id, active.startDate, active.endDate, partnerDailyGoal, false);
            results[pId] = {
              autoBanked: partP.autoBankedTotal || 0,
              adjustments: partP.manualAdjustments || 0,
              spent: partP.manualSpent || 0,
              availableBank: partP.availableBank || 0,
              targetGoalCalories: active.goals?.[pId]?.targetGoalCalories || null,
              hitTarget: active.goals?.[pId]?.targetGoalCalories
                ? (partP.availableBank || 0) >= active.goals[pId].targetGoalCalories
                : null,
            };
          }

          await completeCalorieBank(active.id, results);

          if (active.autoRenew) {
            const [eY, eM, eD] = active.endDate.split('-').map(Number);
            const dayAfterEnd = new Date(eY, eM - 1, eD);
            dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
            const nextStart = formatLocalDate(dayAfterEnd);
            const myGoals = active.goals[user.uid];
            const partnerGoals = pId ? active.goals[pId] : null;
            const newId = await createCalorieBank(
              user.uid,
              pId || null,
              myGoals,
              partnerGoals || undefined,
              true
            );
            if (newId) await acceptCalorieBankInvite(newId, nextStart);
          }

          setBank(null);
          await loadCalorieBank();
          return;
        }
      } else {
        setAutoAdjustTargetEnabled(false);
        const override = await getTodayCalorieGoalOverride(user.uid);
        if (override) await clearTodayCalorieGoalOverride(user.uid);
        setTodayGoalOverride(null);
        const pending = await getPendingCalorieBank(user.uid);
        setPendingBank(pending);
        if (pending) {
          const pId = pending.participants.find((p: string) => p !== user.uid);
          if (pId) {
            const pData = await getPartnerData(pId);
            setPendingPartner(pData);
          }
        }
      }

      const past = await getPastCalorieBanks(user.uid);
      setPastBanks(past);
    } catch (err) {
      console.error('Calorie bank load error:', err);
    }
    setLoading(false);
  }, [profile?.calorieGoal, user?.uid]);

  const handleStartBank = async () => {
    setCreating(true);
    try {
      const myConfig = {
        dailyGoal: profile?.calorieGoal || 2000,
        baseDailyGoal: profile?.calorieGoal || 2000,
        recurringTargetDay: myTargetDay,
        targetGoalCalories: Number(targetGoalCalories) || null,
        autoAdjustDailyTarget: autoAdjustTargetEnabled,
      };
      let partnerConfig: any = undefined;
      const usePartnerMode = startMode === 'partner' && !!profile?.partnerId;
      if (usePartnerMode) {
        const pData = await getPartnerData(profile.partnerId);
        partnerConfig = {
          dailyGoal: pData?.calorieGoal || 2000,
          recurringTargetDay: 'Saturday',
        };
      }

      await createCalorieBank(
        user.uid,
        usePartnerMode ? profile.partnerId : null,
        myConfig,
        partnerConfig,
        autoRenewOption
      );

      if (usePartnerMode) {
        try {
          const token = await getPartnerPushToken(profile.partnerId);
          if (token) {
            await sendCalorieBankInvite(token, profile.name || 'Your partner', myTargetDay);
          }
        } catch {
          // Ignore push errors; banking flow should still continue.
        }
        Alert.alert('Invite sent!', 'Waiting for your partner to accept your calorie banking invite.');
      } else {
        Alert.alert('Calorie Bank started!', 'You are now banking calories in solo mode.');
      }

      setShowSetup(false);
      await loadCalorieBank();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setCreating(false);
  };

  const handleManualEntry = async (entryType: 'adjustment' | 'spend') => {
    if (!bank?.id) return;
    const amount = Number(manualAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive calorie amount.');
      return;
    }
    if (entryType === 'spend' && amount > (myProgress?.availableBank || 0)) {
      Alert.alert('Too high', 'You cannot spend more than your available bank.');
      return;
    }
    try {
      await addCalorieBankAdjustment(user.uid, bank.id, amount, entryType, manualNote.trim());
      const latestOverride = await getTodayCalorieGoalOverride(user.uid);
      const currentEffectiveGoal = latestOverride?.calorieGoal || todayGoalOverride || profile?.calorieGoal || 2000;
      if (entryType === 'adjustment') {
        const nextGoal = Math.max(500, currentEffectiveGoal - amount);
        await setTodayCalorieGoalOverride(user.uid, nextGoal, bank.id);
        setTodayGoalOverride(nextGoal);
      }
      if (entryType === 'spend') {
        const nextGoal = currentEffectiveGoal + amount;
        await setTodayCalorieGoalOverride(user.uid, nextGoal, bank.id);
        setTodayGoalOverride(nextGoal);
      }
      setManualAmount('');
      setManualNote('');
      setShowManualAdjust(false);
      setShowSpend(false);
      await loadCalorieBank();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleAcceptInvite = async () => {
    if (!pendingBank) return;
    setAccepting(true);
    try {
      await acceptCalorieBankInvite(pendingBank.id);
      Alert.alert('Invite accepted!', 'Your calorie bank is now active.');
      setPendingBank(null);
      await loadCalorieBank();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setAccepting(false);
  };

  const handleDeclineInvite = async () => {
    if (!pendingBank) return;
    Alert.alert('Decline invite?', 'Are you sure you want to decline this calorie banking invite?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive', onPress: async () => {
          try {
            await declineCalorieBank(pendingBank.id);
            setPendingBank(null);
            await loadCalorieBank();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        }
      },
    ]);
  };

  const handleCancelInvite = async () => {
    if (!pendingBank) return;
    Alert.alert('Cancel invite?', 'This will cancel the calorie banking invite you sent.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel invite', style: 'destructive', onPress: async () => {
          try {
            await declineCalorieBank(pendingBank.id);
            setPendingBank(null);
            await loadCalorieBank();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        }
      },
    ]);
  };

  const handleEndBank = () => {
    if (!bank?.id) return;
    Alert.alert(
      'End this calorie bank?',
      'This will complete the current cycle now and move it to history.',
      [
        { text: 'Keep running', style: 'cancel' },
        {
          text: 'End now',
          style: 'destructive',
          onPress: async () => {
            try {
              const results: any = {
                [user.uid]: {
                  autoBanked: myProgress?.autoBankedTotal || 0,
                  adjustments: myProgress?.manualAdjustments || 0,
                  spent: myProgress?.manualSpent || 0,
                  availableBank: myProgress?.availableBank || 0,
                  targetGoalCalories: bank.goals?.[user.uid]?.targetGoalCalories || null,
                  hitTarget: bank.goals?.[user.uid]?.targetGoalCalories
                    ? (myProgress?.availableBank || 0) >= bank.goals[user.uid].targetGoalCalories
                    : null,
                  endedEarly: true,
                },
              };
              if (partner) {
                const partnerId = bank.participants.find((p: string) => p !== user.uid);
                if (partnerId) {
                  results[partnerId] = {
                    autoBanked: partnerProgress?.autoBankedTotal || 0,
                    adjustments: partnerProgress?.manualAdjustments || 0,
                    spent: partnerProgress?.manualSpent || 0,
                    availableBank: partnerProgress?.availableBank || 0,
                    targetGoalCalories: bank.goals?.[partnerId]?.targetGoalCalories || null,
                    hitTarget: bank.goals?.[partnerId]?.targetGoalCalories
                      ? (partnerProgress?.availableBank || 0) >= bank.goals[partnerId].targetGoalCalories
                      : null,
                    endedEarly: true,
                  };
                }
              }
              await completeCalorieBank(bank.id, results);
              await clearTodayCalorieGoalOverride(user.uid);
              setBank(null);
              await loadCalorieBank();
              Alert.alert('Cycle ended', 'Your calorie bank cycle has been ended.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    const myGoals = bank?.goals?.[user?.uid];
    const autoAdjust = !!myGoals?.autoAdjustDailyTarget;
    const targetGoal = myGoals?.targetGoalCalories || 0;
    const myDailyGoal = myGoals?.baseDailyGoal || myGoals?.dailyGoal || profile?.calorieGoal || 2000;
    const availableBank = myProgress?.availableBank || 0;
    const daysLeft = bank?.endDate
      ? Math.max(
          0,
          Math.round(
            (parseLocalDate(bank.endDate).getTime() - parseLocalDate(formatLocalDate(new Date())).getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : 0;
    const remainingToGoal = Math.max(0, targetGoal - availableBank);
    const requiredBankPerDay = targetGoal > 0 && daysLeft > 0 ? Math.ceil(remainingToGoal / daysLeft) : 0;
    const adjustedDailyTarget = Math.max(0, myDailyGoal - requiredBankPerDay);

    if (!bank?.id || !autoAdjust) return;
    if (!targetGoal || daysLeft <= 0) return;
    if (!profile?.proteinGoal || !profile?.carbsGoal || !profile?.fatGoal) return;
    const nextTarget = Math.max(500, adjustedDailyTarget);
    if (profile?.calorieGoal === nextTarget) return;

    (async () => {
      try {
        await updateGoals(user.uid, {
          calorieGoal: nextTarget,
          proteinGoal: profile.proteinGoal,
          carbsGoal: profile.carbsGoal,
          fatGoal: profile.fatGoal,
        });
        ctx.setProfile({ ...profile, calorieGoal: nextTarget });
      } catch (err) {
        console.error('Auto-adjust target update error:', err);
      }
    })();
  }, [bank, ctx, myProgress?.availableBank, profile, user?.uid]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F3' }}>
        <Text style={{ color: '#999' }}>Loading...</Text>
      </View>
    );
  }

  // ===== PENDING INVITE =====
  if (!bank && pendingBank) {
    const isCreator = pendingBank.createdBy === user.uid;
    const pendingGoals = pendingBank.goals[user.uid];
    const otherUid = pendingBank.participants.find((p: string) => p !== user.uid);
    const otherGoals = otherUid ? pendingBank.goals[otherUid] : null;

    if (isCreator) {
      return (
        <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
              <Text style={{ fontSize: 22, fontWeight: '700' }}>Calorie Bank</Text>
              <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>Invite sent</Text>
            </View>

            <View style={{ alignItems: 'center', paddingHorizontal: 24, marginTop: 60 }}>
              <ActivityIndicator size="large" color="#7BA876" style={{ marginBottom: 20 }} />
              <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
                Waiting for {pendingPartner?.name || 'partner'}...
              </Text>
              <Text style={{ fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
                Your calorie banking invite has been sent. Once your partner accepts, the cycle starts.
              </Text>
            </View>

            <View style={{
              marginHorizontal: 24, marginTop: 32, backgroundColor: 'white',
              borderRadius: 16, padding: 20,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Cycle details</Text>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: '#666' }}>Recurring target day</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>{pendingGoals?.recurringTargetDay}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: '#666' }}>Your daily goal</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>{pendingGoals?.dailyGoal?.toLocaleString()} cal</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: '#666' }}>Auto-renew</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>{pendingBank.autoRenew ? 'On' : 'Off'}</Text>
                </View>
              </View>
            </View>

            <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
              <TouchableOpacity onPress={handleCancelInvite} style={{
                padding: 16, borderRadius: 14, alignItems: 'center',
                borderWidth: 1.5, borderColor: '#E0DED9',
              }}>
                <Text style={{ fontWeight: '600', fontSize: 15, color: '#D4845A' }}>Cancel invite</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    // Partner view — accept/decline
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
            <Text style={{ fontSize: 22, fontWeight: '700' }}>Calorie Bank</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>New invite</Text>
          </View>

          <View style={{ alignItems: 'center', paddingHorizontal: 24, marginTop: 40 }}>
            <Text style={{ fontSize: 56 }}>🏆</Text>
            <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
              {pendingPartner?.name || 'Your partner'} invited you!
            </Text>
            <Text style={{ fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
              Accept to start banking calories together.
            </Text>
          </View>

          <View style={{
            marginHorizontal: 24, marginTop: 28, backgroundColor: 'white',
            borderRadius: 16, padding: 20,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Cycle details</Text>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: '#666' }}>Target day</Text>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>{otherGoals?.recurringTargetDay || 'Saturday'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: '#666' }}>Your daily goal</Text>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>{pendingGoals?.dailyGoal?.toLocaleString()} cal</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, color: '#666' }}>Auto-renew</Text>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>{pendingBank.autoRenew ? 'On' : 'Off'}</Text>
              </View>
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 28, gap: 10 }}>
            <TouchableOpacity onPress={handleAcceptInvite} disabled={accepting} style={{
              backgroundColor: accepting ? '#A8C5A0' : '#7BA876', padding: 16,
              borderRadius: 14, alignItems: 'center',
              shadowColor: '#7BA876', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
            }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                {accepting ? 'Accepting...' : 'Accept invite'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDeclineInvite} style={{
              padding: 16, borderRadius: 14, alignItems: 'center',
              borderWidth: 1.5, borderColor: '#E0DED9',
            }}>
              <Text style={{ fontWeight: '600', fontSize: 15, color: '#D4845A' }}>Decline</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ===== NO ACTIVE BANK =====
  if (!bank) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
            <Text style={{ fontSize: 22, fontWeight: '700' }}>Calorie Bank</Text>
          </View>

          <View style={{ alignItems: 'center', paddingHorizontal: 24, marginTop: 40 }}>
            <Text style={{ fontSize: 56 }}>🍕</Text>
            <Text style={{ fontSize: 24, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
              Bank calories for your target day
            </Text>
            <Text style={{ fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
              Save calories automatically by eating under your goal. Add manual adjustments, spend from your bank, and track progress toward your target day.
            </Text>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 16 }}>How it works</Text>
            {[
              { emoji: '📊', title: 'Automatic banking', desc: 'Each day under goal adds calories to your bank.' },
              { emoji: '✍️', title: 'Manual adjustments', desc: 'Add manual credits/debits if needed.' },
              { emoji: '🎯', title: 'Target day + goal', desc: 'Set a recurring or one-off target day and optional savings goal.' },
              { emoji: '👥', title: 'Optional partner mode', desc: 'Invite a partner or run solo.' },
            ].map((item, i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 8,
              }}>
                <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Example */}
          <View style={{
            marginHorizontal: 24, marginTop: 16, backgroundColor: '#2D2D2D',
            borderRadius: 16, padding: 20,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Example bank</Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Auto banked this cycle</Text>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>1,600 cal</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Manual adjustments</Text>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>+200 cal</Text>
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Available bank</Text>
                <Text style={{ color: '#7BA876', fontWeight: '700', fontSize: 18 }}>1,800 cal</Text>
              </View>
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
            <TouchableOpacity onPress={() => setShowSetup(true)} style={{
              backgroundColor: '#7BA876', padding: 16, borderRadius: 14, alignItems: 'center',
              shadowColor: '#7BA876', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
            }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Start Calorie Bank</Text>
            </TouchableOpacity>
          </View>

          {/* Past cycles */}
          {pastBanks.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
              <TouchableOpacity onPress={() => setShowPast(!showPast)}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                  Past cycles ({pastBanks.length}) {showPast ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
              {showPast && pastBanks.map((ch) => {
                const myResult = ch.results?.[user.uid] || {};
                return (
                  <View key={ch.id} style={{
                    backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 8,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600' }}>{ch.startDate} — {ch.endDate}</Text>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                        backgroundColor: myResult?.hitTarget ? '#F0F5EE' : '#FFF5F3',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: myResult?.hitTarget ? '#7BA876' : '#D4845A' }}>
                          {myResult?.hitTarget ? 'Goal hit ✓' : 'Cycle done'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#999' }}>
                      Available bank: {(myResult?.availableBank || 0).toLocaleString()} cal
                    </Text>
                    {(myResult?.targetGoalCalories || 0) > 0 && (
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#7BA876', marginTop: 4 }}>
                        Goal: {myResult.targetGoalCalories.toLocaleString()} cal
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Setup Modal */}
        <Modal visible={showSetup} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setShowSetup(false)} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView
                style={{
                  backgroundColor: '#F5F5F3',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  maxHeight: '88%',
                }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
              >
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Calorie Bank setup</Text>
                <Text style={{ fontSize: 14, color: '#999', marginBottom: 20 }}>
                  Pick your recurring target day and optional savings goal.
                </Text>

                {profile?.partnerId && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Start mode
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setStartMode('solo')}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: 'center',
                          backgroundColor: startMode === 'solo' ? '#F0F5EE' : 'white',
                          borderWidth: 1.5,
                          borderColor: startMode === 'solo' ? '#7BA876' : '#E0DED9',
                        }}
                      >
                        <Text style={{ fontWeight: '700', color: startMode === 'solo' ? '#7BA876' : '#666' }}>Solo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setStartMode('partner')}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: 'center',
                          backgroundColor: startMode === 'partner' ? '#F0F5EE' : 'white',
                          borderWidth: 1.5,
                          borderColor: startMode === 'partner' ? '#7BA876' : '#E0DED9',
                        }}
                      >
                        <Text style={{ fontWeight: '700', color: startMode === 'partner' ? '#7BA876' : '#666' }}>With partner</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={{ gap: 6, marginBottom: 24 }}>
                  {DAYS_OF_WEEK.map(day => (
                    <TouchableOpacity key={day} onPress={() => setMyTargetDay(day)} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 14, borderRadius: 12,
                      backgroundColor: myTargetDay === day ? '#F0F5EE' : 'white',
                      borderWidth: myTargetDay === day ? 2 : 1.5,
                      borderColor: myTargetDay === day ? '#7BA876' : '#E0DED9',
                    }}>
                      <Text style={{ fontSize: 20 }}>{DAY_EMOJIS[day]}</Text>
                      <Text style={{
                        fontSize: 15, fontWeight: '600',
                        color: myTargetDay === day ? '#7BA876' : '#2D2D2D',
                      }}>{day}</Text>
                      {(day === 'Friday' || day === 'Saturday') && (
                        <View style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FFF8F0' }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: '#D4A45A' }}>Popular</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Savings goal (optional calories)
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  <TextInput
                    value={targetGoalCalories}
                    onChangeText={setTargetGoalCalories}
                    placeholder="1500"
                    keyboardType="numeric"
                    placeholderTextColor="#C2C2C2"
                    style={{
                      flex: 1,
                      backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9',
                      borderRadius: 12, padding: 12,
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => Keyboard.dismiss()}
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: '#E8EFE6',
                    }}
                  >
                    <Text style={{ color: '#5F8A5A', fontWeight: '700' }}>Done</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    const next = !manualModeEnabled;
                    setManualModeEnabled(next);
                    if (!next) {
                      // Rule: when manual entries are off, auto-adjust must be on.
                      setAutoAdjustTargetEnabled(true);
                    }
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 14, borderRadius: 12, backgroundColor: 'white',
                    borderWidth: 1.5, borderColor: '#E0DED9', marginBottom: 16,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>Enable manual entries</Text>
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Allow manual adjustments and spend logs in this cycle</Text>
                  </View>
                  <View style={{
                    width: 44, height: 26, borderRadius: 13, padding: 2,
                    backgroundColor: manualModeEnabled ? '#7BA876' : '#E0DED9',
                    justifyContent: 'center',
                  }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, backgroundColor: 'white',
                      alignSelf: manualModeEnabled ? 'flex-end' : 'flex-start',
                    }} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (!manualModeEnabled && autoAdjustTargetEnabled) {
                      Alert.alert(
                        'Auto-adjust required',
                        'Turn on manual entries first if you want to disable auto-adjust.'
                      );
                      return;
                    }
                    setAutoAdjustTargetEnabled(!autoAdjustTargetEnabled);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 14, borderRadius: 12, backgroundColor: 'white',
                    borderWidth: 1.5, borderColor: '#E0DED9', marginBottom: 16,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>Auto-adjust daily target</Text>
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Automatically lower daily target to hit your savings goal</Text>
                  </View>
                  <View style={{
                    width: 44, height: 26, borderRadius: 13, padding: 2,
                    backgroundColor: autoAdjustTargetEnabled ? '#7BA876' : '#E0DED9',
                    justifyContent: 'center',
                  }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, backgroundColor: 'white',
                      alignSelf: autoAdjustTargetEnabled ? 'flex-end' : 'flex-start',
                    }} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setAutoRenewOption(!autoRenewOption)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 14, borderRadius: 12, backgroundColor: 'white',
                    borderWidth: 1.5, borderColor: '#E0DED9', marginBottom: 16,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>Auto-renew cycles</Text>
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Start next cycle automatically after this one ends</Text>
                  </View>
                  <View style={{
                    width: 44, height: 26, borderRadius: 13, padding: 2,
                    backgroundColor: autoRenewOption ? '#7BA876' : '#E0DED9',
                    justifyContent: 'center',
                  }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, backgroundColor: 'white',
                      alignSelf: autoRenewOption ? 'flex-end' : 'flex-start',
                    }} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleStartBank} disabled={creating} style={{
                  backgroundColor: creating ? '#A8C5A0' : '#7BA876', padding: 16,
                  borderRadius: 14, alignItems: 'center',
                  shadowColor: '#7BA876', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
                }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                    {creating
                      ? 'Starting...'
                      : (startMode === 'partner' && profile?.partnerId)
                        ? `Send invite — ${myTargetDay}`
                        : `Start solo bank — ${myTargetDay}`}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    );
  }

  // ===== ACTIVE BANK =====
  const myGoals = bank.goals[user.uid];
  const partnerId = bank.participants.find((p: string) => p !== user.uid);
  const partnerGoals = partnerId ? bank.goals[partnerId] : null;

  const myBudget = myGoals?.budget || 14000;
  const bankDailyGoal = myGoals?.dailyGoal || 2000;
  const currentDailyGoal = todayGoalOverride || profile?.calorieGoal || bankDailyGoal;
  const baseDailyGoal = myGoals?.baseDailyGoal || bankDailyGoal;
  const myTargetDayName = myGoals?.recurringTargetDay || 'Saturday';
  const partnerBudget = partnerGoals?.budget || 14000;

  const myTotal = myProgress?.totalCalories || 0;
  const partnerTotal = partnerProgress?.totalCalories || 0;
  const availableBank = myProgress?.availableBank || 0;
  const autoBankedTotal = myProgress?.autoBankedTotal || 0;
  const manualAdjustments = myProgress?.manualAdjustments || 0;
  const manualSpent = myProgress?.manualSpent || 0;
  const targetGoal = myGoals?.targetGoalCalories || 0;
  const autoAdjustDailyTarget = !!myGoals?.autoAdjustDailyTarget;
  const targetProgress = targetGoal > 0 ? Math.min(100, Math.round((availableBank / targetGoal) * 100)) : 0;
  const daysLeft = bank?.endDate ? Math.max(0, Math.round((parseLocalDate(bank.endDate).getTime() - parseLocalDate(formatLocalDate(new Date())).getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const remainingToGoal = Math.max(0, targetGoal - availableBank);
  const requiredBankPerDay = targetGoal > 0 && daysLeft > 0 ? Math.ceil(remainingToGoal / daysLeft) : 0;
  const suggestionBaseGoal = autoAdjustDailyTarget ? baseDailyGoal : currentDailyGoal;
  const adjustedDailyTarget = Math.max(0, suggestionBaseGoal - requiredBankPerDay);


  const partnerAvailable = partnerProgress?.availableBank || 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F3' }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Calorie Bank</Text>
        <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left · Target day: {myTargetDayName}
        </Text>
      </View>

      {/* Bank Card */}
      <View style={{
        marginHorizontal: 24, marginTop: 20,
        backgroundColor: '#2D2D2D', borderRadius: 20, padding: 24, overflow: 'hidden',
      }}>
        <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(123,168,118,0.1)' }} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Available calories to spend
        </Text>
        <Text style={{ fontSize: 48, fontWeight: '700', color: '#7BA876' }}>
          {availableBank.toLocaleString()}
        </Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>cal available in bank</Text>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Auto banked</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: 'white' }}>{autoBankedTotal.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Manual</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: 'white' }}>+{manualAdjustments.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Spent</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#D4A45A' }}>-{manualSpent.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Cycle Progress */}
      <View style={{
        marginHorizontal: 24, marginTop: 16, backgroundColor: 'white',
        borderRadius: 20, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: '600' }}>Cycle progress</Text>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
            backgroundColor: availableBank >= 0 ? '#F0F5EE' : '#FFF5F3',
          }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: availableBank >= 0 ? '#7BA876' : '#D4845A' }}>
              {availableBank >= 0 ? 'Banking ✓' : 'Negative'}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{myTotal.toLocaleString()} cal</Text>
            <Text style={{ fontSize: 13, color: '#999' }}>/ {myBudget.toLocaleString()} cycle budget</Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: '#E8E8E6' }}>
            <View style={{
              height: '100%', borderRadius: 5,
              backgroundColor: myTotal <= myBudget ? '#7BA876' : '#D4845A',
              width: `${Math.min((myTotal / myBudget) * 100, 100)}%`,
            }} />
          </View>
        </View>

        {/* Daily bars */}
        {myProgress?.days && (
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
            {myProgress.days.map((day: any) => {
              const pct = bankDailyGoal > 0 ? day.calories / bankDailyGoal : 0;
              const over = pct > 1.05;
              const barColor = over ? '#D4845A' : day.calories > 0 ? '#7BA876' : '#E8E8E6';
              const barH = Math.min(Math.max(pct / 1.3 * 100, 5), 100);
              return (
                <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ height: 45, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <View style={{ width: '65%', borderRadius: 3, backgroundColor: barColor, height: `${barH}%`, minHeight: 3 }} />
                  </View>
                  <Text style={{ fontSize: 9, marginTop: 3, fontWeight: day.isToday ? '700' : '400', color: day.isToday ? '#2D2D2D' : '#CCC' }}>{day.day}</Text>
                </View>
              );
            })}
          </View>
        )}

        {targetGoal > 0 && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: '#666' }}>Target goal progress</Text>
              <Text style={{ fontSize: 12, fontWeight: '700' }}>{availableBank.toLocaleString()} / {targetGoal.toLocaleString()}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E8E8E6' }}>
              <View style={{ height: '100%', borderRadius: 4, backgroundColor: '#7BA876', width: `${targetProgress}%` }} />
            </View>
            {remainingToGoal > 0 && daysLeft > 0 && (
              <View style={{ marginTop: 10, backgroundColor: '#F6FAF5', borderRadius: 10, padding: 10 }}>
                <Text style={{ fontSize: 12, color: '#4B6A47' }}>
                  To hit your goal, bank <Text style={{ fontWeight: '700' }}>{requiredBankPerDay.toLocaleString()} cal/day</Text> for the next {daysLeft} day{daysLeft !== 1 ? 's' : ''}.
                </Text>
                <Text style={{ fontSize: 12, color: '#4B6A47', marginTop: 4 }}>
                  Suggested daily intake target: <Text style={{ fontWeight: '700' }}>{adjustedDailyTarget.toLocaleString()} cal/day</Text>.
                </Text>
              </View>
            )}
            {remainingToGoal <= 0 && (
              <View style={{ marginTop: 10, backgroundColor: '#F0F5EE', borderRadius: 10, padding: 10 }}>
                <Text style={{ fontSize: 12, color: '#4B6A47', fontWeight: '700' }}>Goal reached. Keep this pace to maintain your bank.</Text>
              </View>
            )}
          </View>
        )}

        {daysLeft > 0 && availableBank > 0 && (
          <View style={{ backgroundColor: '#F5F5F3', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14 }}>💡</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              You are banking <Text style={{ fontWeight: '700' }}>{Math.round(availableBank / Math.max(daysLeft, 1)).toLocaleString()} cal/day</Text> toward your target
            </Text>
          </View>
        )}

        {manualModeEnabled && (
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => setShowManualAdjust(true)} style={{ flex: 1, backgroundColor: '#F6FAF5', borderWidth: 1, borderColor: '#D8EAD5', borderRadius: 10, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#7BA876', fontWeight: '600' }}>+ Manual adjust</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSpend(true)} style={{ flex: 1, backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#F0E1CD', borderRadius: 10, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#D4A45A', fontWeight: '600' }}>- Log spend</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Partner Progress */}
      {partner && (
        <View style={{
          marginHorizontal: 24, marginTop: 12, backgroundColor: 'white',
          borderRadius: 20, padding: 20,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#8BA4D4', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>{partner?.name?.charAt(0)}</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', flex: 1 }}>{partner?.name}&apos;s progress</Text>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
              backgroundColor: partnerAvailable >= 0 ? '#F0F5EE' : '#FFF5F3',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: partnerAvailable >= 0 ? '#7BA876' : '#D4845A' }}>
                {partnerAvailable >= 0 ? 'Banking' : 'Negative'}
              </Text>
            </View>
          </View>

          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>{partnerTotal.toLocaleString()}</Text>
              <Text style={{ fontSize: 13, color: '#999' }}>/ {partnerBudget.toLocaleString()}</Text>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: '#E8E8E6' }}>
              <View style={{
                height: '100%', borderRadius: 5,
                backgroundColor: partnerTotal <= partnerBudget ? '#8BA4D4' : '#D4845A',
                width: `${Math.min((partnerTotal / partnerBudget) * 100, 100)}%`,
              }} />
            </View>
          </View>

          <View style={{ backgroundColor: '#F5F5F3', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14 }}>💼</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              {partner?.name}&apos;s available bank: <Text style={{ fontWeight: '700', color: '#8BA4D4' }}>{partnerAvailable.toLocaleString()} cal</Text>
            </Text>
          </View>
        </View>
      )}

      {/* Status Banner */}
      <View style={{
        marginHorizontal: 24, marginTop: 16, borderRadius: 16, padding: 20,
        backgroundColor: myTotal <= myBudget && (!partner || partnerTotal <= partnerBudget) ? '#F0F5EE' : '#FFF8F0',
        borderWidth: 1, borderColor: myTotal <= myBudget && (!partner || partnerTotal <= partnerBudget) ? '#D8E4D5' : '#F0E6DA',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 28 }}>
            {myTotal <= myBudget && (!partner || partnerTotal <= partnerBudget) ? '🏆' : '⚡'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700' }}>
              {myTotal <= myBudget && (!partner || partnerTotal <= partnerBudget)
                ? 'Your calorie bank is on track!'
                : 'Stay under goal to keep banking!'}
            </Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in this cycle
            </Text>
          </View>
        </View>
      </View>
     
      {/* Auto-Renew Toggle */}
      <View style={{
        marginHorizontal: 24, marginTop: 12, backgroundColor: 'white',
        borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600' }}>Auto-renew weekly</Text>
          <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
            Automatically start a new calorie banking cycle
          </Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            const newValue = !bank.autoRenew;
            await toggleCalorieBankAutoRenew(bank.id, newValue);
            setBank({ ...bank, autoRenew: newValue });
          }}
          style={{
            width: 52, height: 30, borderRadius: 15, padding: 2,
            backgroundColor: bank.autoRenew ? '#7BA876' : '#E0DED9',
            justifyContent: 'center',
          }}
        >
          <View style={{
            width: 26, height: 26, borderRadius: 13, backgroundColor: 'white',
            alignSelf: bank.autoRenew ? 'flex-end' : 'flex-start',
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2,
          }} />
        </TouchableOpacity>
      </View>

      <View style={{
        marginHorizontal: 24, marginTop: 10, backgroundColor: 'white',
        borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600' }}>Auto-adjust daily target</Text>
          <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
            Auto apply suggested target ({Math.max(500, adjustedDailyTarget).toLocaleString()} cal/day)
          </Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            const next = !autoAdjustDailyTarget;
            if (!manualModeEnabled && !next) {
              Alert.alert(
                'Auto-adjust required',
                'Turn on manual entries first if you want to disable auto-adjust.'
              );
              return;
            }
            try {
              const baseline = bank.goals?.[user.uid]?.baseDailyGoal || profile?.calorieGoal || bank.goals?.[user.uid]?.dailyGoal || 2000;
              await setCalorieBankAutoAdjustTarget(bank.id, user.uid, next, baseline);
              if (!next) {
                await updateGoals(user.uid, {
                  calorieGoal: baseline,
                  proteinGoal: profile?.proteinGoal || 150,
                  carbsGoal: profile?.carbsGoal || 250,
                  fatGoal: profile?.fatGoal || 65,
                });
                ctx.setProfile({
                  ...profile,
                  calorieGoal: baseline,
                });
              }
              setBank({
                ...bank,
                goals: {
                  ...bank.goals,
                  [user.uid]: {
                    ...bank.goals[user.uid],
                    baseDailyGoal: baseline,
                    autoAdjustDailyTarget: next,
                  },
                },
              });
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }}
          style={{
            width: 52, height: 30, borderRadius: 15, padding: 2,
            backgroundColor: autoAdjustDailyTarget ? '#7BA876' : '#E0DED9',
            justifyContent: 'center',
          }}
        >
          <View style={{
            width: 26, height: 26, borderRadius: 13, backgroundColor: 'white',
            alignSelf: autoAdjustDailyTarget ? 'flex-end' : 'flex-start',
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2,
          }} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 10 }}>
        <TouchableOpacity
          onPress={handleEndBank}
          style={{
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: '#F0DAD5',
            backgroundColor: '#FFF8F7',
          }}
        >
          <Text style={{ color: '#D45A5A', fontWeight: '700' }}>End calorie bank</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showManualAdjust} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setShowManualAdjust(false)} />
          <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>Manual adjustment</Text>
            <TextInput value={manualAmount} onChangeText={setManualAmount} keyboardType="numeric" placeholder="Calories" placeholderTextColor="#BBB" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 12, padding: 12, marginBottom: 10 }} />
            <TextInput value={manualNote} onChangeText={setManualNote} placeholder="Note (optional)" placeholderTextColor="#BBB" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 12, padding: 12, marginBottom: 14 }} />
            <TouchableOpacity onPress={() => handleManualEntry('adjustment')} style={{ backgroundColor: '#7BA876', padding: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Save adjustment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSpend} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setShowSpend(false)} />
          <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>Log spend</Text>
            <TextInput value={manualAmount} onChangeText={setManualAmount} keyboardType="numeric" placeholder="Calories spent" placeholderTextColor="#BBB" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 12, padding: 12, marginBottom: 10 }} />
            <TextInput value={manualNote} onChangeText={setManualNote} placeholder="What was this for?" placeholderTextColor="#BBB" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 12, padding: 12, marginBottom: 14 }} />
            <TouchableOpacity onPress={() => handleManualEntry('spend')} style={{ backgroundColor: '#D4A45A', padding: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Save spend</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}