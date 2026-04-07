import { useState, useContext, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { getActiveChallenge, createChallenge, getChallengeProgress, completeChallenge, getPastChallenges, getPartnerData, toggleAutoRenew } from '../../services/database';

const { UserContext } = require('../_layout');

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_EMOJIS: Record<string, string> = { Monday: '1️⃣', Tuesday: '2️⃣', Wednesday: '3️⃣', Thursday: '4️⃣', Friday: '5️⃣', Saturday: '🎉', Sunday: '🌟' };

export default function ChallengeScreen() {
  const ctx = useContext(UserContext);
  const user = ctx?.user;
  const profile = ctx?.profile;

  const [challenge, setChallenge] = useState<any>(null);
  const [myProgress, setMyProgress] = useState<any>(null);
  const [partnerProgress, setPartnerProgress] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [pastChallenges, setPastChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [myCheatDay, setMyCheatDay] = useState('Saturday');
  const [showPast, setShowPast] = useState(false);
  const [autoRenewOption, setAutoRenewOption] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    loadChallenge();
  }, [user?.uid, ctx?.todayLog]);

  const loadChallenge = async () => {
    setLoading(true);
    try {
      const active = await getActiveChallenge(user.uid);
      setChallenge(active);

      if (active) {
        const myP = await getChallengeProgress(user.uid, active.startDate, active.endDate);
        setMyProgress(myP);

        const partnerId = active.participants.find((p: string) => p !== user.uid);
        if (partnerId) {
          const pData = await getPartnerData(partnerId);
          setPartner(pData);
          const partP = await getChallengeProgress(partnerId, active.startDate, active.endDate);
          setPartnerProgress(partP);
        }

        const todayCheck = formatLocalDate(new Date());
        if (todayCheck > active.endDate && active.status === 'active') {
          const pId = active.participants.find((p: string) => p !== user.uid);
          const partP = await getChallengeProgress(pId, active.startDate, active.endDate);
          const myGoalsCheck = active.goals[user.uid];
          const partnerGoalsCheck = active.goals[pId];

          await completeChallenge(active.id, {
            [user.uid]: { total: myP.total, budget: myGoalsCheck.weeklyBudget, hit: myP.total <= myGoalsCheck.weeklyBudget, cheatEarned: Math.max(0, myGoalsCheck.weeklyBudget - myP.total) },
            [pId]: { total: partP.total, budget: partnerGoalsCheck.weeklyBudget, hit: partP.total <= partnerGoalsCheck.weeklyBudget, cheatEarned: Math.max(0, partnerGoalsCheck.weeklyBudget - partP.total) },
          });

          // Auto-renew if enabled
          if (active.autoRenew) {
            const [eY, eM, eD] = active.endDate.split('-').map(Number);
            const dayAfterEnd = new Date(eY, eM - 1, eD);
            dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
            const nextStart = formatLocalDate(dayAfterEnd);

            await createChallenge(
              user.uid, pId, nextStart,
              myGoalsCheck.dailyGoal, partnerGoalsCheck.dailyGoal,
              myGoalsCheck.cheatDay, partnerGoalsCheck.cheatDay
            );
          }

          setChallenge(null);
          await loadChallenge();
          return;
        }
      }

      const past = await getPastChallenges(user.uid);
      setPastChallenges(past);
    } catch (err) {
      console.error('Challenge load error:', err);
    }
    setLoading(false);
  };

  const handleStartChallenge = async () => {
    if (!profile?.partnerId) {
      Alert.alert('Need a partner', 'Pair with a partner first!');
      return;
    }
    setCreating(true);
    try {
      const startStr = formatLocalDate(new Date());

      const pData = await getPartnerData(profile.partnerId);
      const partnerGoal = pData?.calorieGoal || 2000;

      await createChallenge(
        user.uid, profile.partnerId, startStr,
        profile.calorieGoal || 2000, partnerGoal,
        myCheatDay, 'Saturday', autoRenewOption
      );

      setShowSetup(false);
      Alert.alert('Challenge started! 🏆', `Your cheat day is ${myCheatDay}. Earn it by staying under budget!`);
      await loadChallenge();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F3' }}>
        <Text style={{ color: '#999' }}>Loading...</Text>
      </View>
    );
  }

  // ===== NO ACTIVE CHALLENGE =====
  if (!challenge) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
            <Text style={{ fontSize: 22, fontWeight: '700' }}>Challenge</Text>
          </View>

          <View style={{ alignItems: 'center', paddingHorizontal: 24, marginTop: 40 }}>
            <Text style={{ fontSize: 56 }}>🍕</Text>
            <Text style={{ fontSize: 24, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
              Earn Your Cheat Meal
            </Text>
            <Text style={{ fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
              Stay under your weekly calorie budget and earn a guilt-free cheat meal. The more you save, the bigger the feast!
            </Text>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 16 }}>How it works</Text>
            {[
              { emoji: '📊', title: 'Weekly budget', desc: `Your daily goal × 7 = ${((profile?.calorieGoal || 2000) * 7).toLocaleString()} cal` },
              { emoji: '🥗', title: 'Eat clean during the week', desc: 'Come in under your daily goal to bank extra calories' },
              { emoji: '🍕', title: 'Earn your cheat meal', desc: 'Saved 500 cal this week? That\'s a 500 cal cheat meal!' },
              { emoji: '👥', title: 'Do it together', desc: 'Both partners track their own earned cheat meals' },
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
            <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Example</Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Weekly budget</Text>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>14,000 cal</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Mon–Sat eaten</Text>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>11,200 cal</Text>
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>🍕 Cheat meal earned</Text>
                <Text style={{ color: '#7BA876', fontWeight: '700', fontSize: 18 }}>2,800 cal</Text>
              </View>
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
            <TouchableOpacity onPress={() => setShowSetup(true)} style={{
              backgroundColor: '#7BA876', padding: 16, borderRadius: 14, alignItems: 'center',
              shadowColor: '#7BA876', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
            }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Start a challenge</Text>
            </TouchableOpacity>
          </View>

          {/* Past challenges */}
          {pastChallenges.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
              <TouchableOpacity onPress={() => setShowPast(!showPast)}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                  Past challenges ({pastChallenges.length}) {showPast ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
              {showPast && pastChallenges.map((ch) => {
                const myResult = ch.results?.[user.uid];
                return (
                  <View key={ch.id} style={{
                    backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 8,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600' }}>{ch.startDate} — {ch.endDate}</Text>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                        backgroundColor: myResult?.hit ? '#F0F5EE' : '#FFF5F3',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: myResult?.hit ? '#7BA876' : '#D4845A' }}>
                          {myResult?.hit ? 'Won ✓' : 'Missed'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#999' }}>
                      {myResult?.total?.toLocaleString()} / {myResult?.budget?.toLocaleString()} cal
                    </Text>
                    {myResult?.hit && myResult?.cheatEarned > 0 && (
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#7BA876', marginTop: 4 }}>
                        🍕 Earned a {myResult.cheatEarned.toLocaleString()} cal cheat meal!
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Cheat Day Setup Modal */}
        <Modal visible={showSetup} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setShowSetup(false)} />
            <View style={{
              backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: 24, paddingBottom: 40,
            }}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Pick your cheat day</Text>
              <Text style={{ fontSize: 14, color: '#999', marginBottom: 20 }}>
                Which day do you want to use your earned cheat meal?
              </Text>

              <View style={{ gap: 6, marginBottom: 24 }}>
                {DAYS_OF_WEEK.map(day => (
                  <TouchableOpacity key={day} onPress={() => setMyCheatDay(day)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: 12,
                    backgroundColor: myCheatDay === day ? '#F0F5EE' : 'white',
                    borderWidth: myCheatDay === day ? 2 : 1.5,
                    borderColor: myCheatDay === day ? '#7BA876' : '#E0DED9',
                  }}>
                    <Text style={{ fontSize: 20 }}>{DAY_EMOJIS[day]}</Text>
                    <Text style={{
                      fontSize: 15, fontWeight: '600',
                      color: myCheatDay === day ? '#7BA876' : '#2D2D2D',
                    }}>{day}</Text>
                    {(day === 'Saturday' || day === 'Sunday') && (
                      <View style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FFF8F0' }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#D4A45A' }}>Popular</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setAutoRenewOption(!autoRenewOption)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  padding: 14, borderRadius: 12, backgroundColor: 'white',
                  borderWidth: 1.5, borderColor: '#E0DED9', marginBottom: 16,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>Auto-renew weekly</Text>
                  <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Start a new challenge the day after this one ends</Text>
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

              <TouchableOpacity onPress={handleStartChallenge} disabled={creating} style={{
                backgroundColor: creating ? '#A8C5A0' : '#7BA876', padding: 16,
                borderRadius: 14, alignItems: 'center',
                shadowColor: '#7BA876', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
              }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                  {creating ? 'Starting...' : `Start challenge — Cheat day: ${myCheatDay}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ===== ACTIVE CHALLENGE =====
  const myGoals = challenge.goals[user.uid];
  const partnerId = challenge.participants.find((p: string) => p !== user.uid);
  const partnerGoals = challenge.goals[partnerId];

  const myBudget = myGoals?.weeklyBudget || 14000;
  const myDailyGoal = myGoals?.dailyGoal || 2000;
  const myCheatDayName = myGoals?.cheatDay || 'Saturday';
  const partnerBudget = partnerGoals?.weeklyBudget || 14000;

  const myTotal = myProgress?.total || 0;
  const partnerTotal = partnerProgress?.total || 0;

  const today = new Date();
  const todayStr = formatLocalDate(today);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Calculate the user's cheat day date from the challenge start
  const [sy, sm, sd] = challenge.startDate.split('-').map(Number);
  const startDateObj = new Date(sy, sm - 1, sd);
  const cheatDayNum = DAYS_OF_WEEK.indexOf(myCheatDayName) === 6 ? 0 : DAYS_OF_WEEK.indexOf(myCheatDayName) + 1;
  const daysToCheat = (cheatDayNum - startDateObj.getDay() + 7) % 7;
  const myCheatDate = new Date(sy, sm - 1, sd + daysToCheat);
  const daysLeft = Math.max(0, Math.round((myCheatDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate non-cheat days consumed (exclude cheat day if it's passed)
  const cheatDayIndex = DAYS_OF_WEEK.indexOf(myCheatDayName);
  const isCheatDayToday = today.getDay() === (cheatDayIndex + 1) % 7 || (cheatDayIndex === 6 && today.getDay() === 0);
  const cheatDayPassed = myProgress?.days?.some((d: any) => {
    const dayDate = new Date(d.date);
    return dayDate.getDay() === (cheatDayIndex + 1) % 7 || (cheatDayIndex === 6 && dayDate.getDay() === 0);
  });

  // Calculate earned cheat meal
  const nonCheatTotal = myProgress?.days
    ?.filter((d: any) => {
      const dayDate = new Date(d.date);
      const dayOfWeek = dayDate.getDay();
      const cheatDayNum = cheatDayIndex === 6 ? 0 : cheatDayIndex + 1;
      return dayOfWeek !== cheatDayNum;
    })
    .reduce((s: number, d: any) => s + d.calories, 0) || 0;

  const nonCheatDaysElapsed = myProgress?.days
    ?.filter((d: any) => {
      const dayDate = new Date(d.date);
      const dayOfWeek = dayDate.getDay();
      const cheatDayNum = cheatDayIndex === 6 ? 0 : cheatDayIndex + 1;
      return dayOfWeek !== cheatDayNum && !d.isToday;
    }).length || 0;

  const savedCalories = Math.max(0, (myDailyGoal * (myProgress?.days?.length || 0)) - myTotal);
  const earnedCheatMeal = Math.max(0, myBudget - nonCheatTotal - (myDailyGoal * Math.max(0, daysLeft - (isCheatDayToday || !cheatDayPassed ? 1 : 0))));
  const simpleEarned = Math.max(0, myBudget - myTotal);

  // Partner earned
  const partnerDailyGoal = partnerGoals?.dailyGoal || 2000;
  const partnerSimpleEarned = Math.max(0, partnerBudget - partnerTotal);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F3' }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Challenge</Text>
        <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left · Cheat day: {myCheatDayName}
        </Text>
      </View>

      {/* Cheat Meal Earned Card */}
      <View style={{
        marginHorizontal: 24, marginTop: 20,
        backgroundColor: '#2D2D2D', borderRadius: 20, padding: 24, overflow: 'hidden',
      }}>
        <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(123,168,118,0.1)' }} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          🍕 Your earned cheat meal
        </Text>
        <Text style={{ fontSize: 48, fontWeight: '700', color: '#7BA876' }}>
          {simpleEarned.toLocaleString()}
        </Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>calories available</Text>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Weekly budget</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: 'white' }}>{myBudget.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Consumed</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: 'white' }}>{myTotal.toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Cheat day</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#7BA876' }}>{myCheatDayName}</Text>
          </View>
        </View>
      </View>

      {/* My Weekly Progress */}
      <View style={{
        marginHorizontal: 24, marginTop: 16, backgroundColor: 'white',
        borderRadius: 20, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: '600' }}>Your progress</Text>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
            backgroundColor: myTotal <= myBudget ? '#F0F5EE' : '#FFF5F3',
          }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: myTotal <= myBudget ? '#7BA876' : '#D4845A' }}>
              {myTotal <= myBudget ? 'On track ✓' : 'Over budget'}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{myTotal.toLocaleString()} cal</Text>
            <Text style={{ fontSize: 13, color: '#999' }}>/ {myBudget.toLocaleString()}</Text>
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
              const pct = myDailyGoal > 0 ? day.calories / myDailyGoal : 0;
              const over = pct > 1.05;
              const isCheat = (() => {
                const d = new Date(day.date);
                const dow = d.getDay();
                const cheatNum = cheatDayIndex === 6 ? 0 : cheatDayIndex + 1;
                return dow === cheatNum;
              })();
              const barColor = isCheat ? '#D4A45A' : over ? '#D4845A' : day.calories > 0 ? '#7BA876' : '#E8E8E6';
              const barH = Math.min(Math.max(pct / 1.3 * 100, 5), 100);
              return (
                <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ height: 45, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <View style={{ width: '65%', borderRadius: 3, backgroundColor: barColor, height: `${barH}%`, minHeight: 3 }} />
                  </View>
                  <Text style={{ fontSize: 9, marginTop: 3, fontWeight: day.isToday ? '700' : '400', color: day.isToday ? '#2D2D2D' : '#CCC' }}>{day.day}</Text>
                  {isCheat && <Text style={{ fontSize: 8, color: '#D4A45A' }}>🍕</Text>}
                </View>
              );
            })}
          </View>
        )}

        {/* Adjusted daily tip */}
        {daysLeft > 0 && simpleEarned > 0 && (
          <View style={{ backgroundColor: '#F5F5F3', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14 }}>💡</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              Eat <Text style={{ fontWeight: '700' }}>{Math.round((myBudget - myTotal) / daysLeft).toLocaleString()} cal/day</Text> to stay on budget
            </Text>
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
            <Text style={{ fontSize: 15, fontWeight: '600', flex: 1 }}>{partner?.name}'s progress</Text>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
              backgroundColor: partnerTotal <= partnerBudget ? '#F0F5EE' : '#FFF5F3',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: partnerTotal <= partnerBudget ? '#7BA876' : '#D4845A' }}>
                {partnerTotal <= partnerBudget ? 'On track' : 'Over'}
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
            <Text style={{ fontSize: 14 }}>🍕</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              {partner?.name}'s earned cheat meal: <Text style={{ fontWeight: '700', color: '#8BA4D4' }}>{partnerSimpleEarned.toLocaleString()} cal</Text>
            </Text>
          </View>
        </View>
      )}

      {/* Status Banner */}
      <View style={{
        marginHorizontal: 24, marginTop: 16, borderRadius: 16, padding: 20,
        backgroundColor: myTotal <= myBudget && partnerTotal <= partnerBudget ? '#F0F5EE' : '#FFF8F0',
        borderWidth: 1, borderColor: myTotal <= myBudget && partnerTotal <= partnerBudget ? '#D8E4D5' : '#F0E6DA',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 28 }}>
            {myTotal <= myBudget && partnerTotal <= partnerBudget ? '🏆' : '⚡'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700' }}>
              {myTotal <= myBudget && partnerTotal <= partnerBudget
                ? 'You\'re both earning your cheat meals!'
                : 'Stay on track to earn your cheat meal!'}
            </Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in this challenge
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
            Automatically start a new challenge when this one ends
          </Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            const newValue = !challenge.autoRenew;
            await toggleAutoRenew(challenge.id, newValue);
            setChallenge({ ...challenge, autoRenew: newValue });
          }}
          style={{
            width: 52, height: 30, borderRadius: 15, padding: 2,
            backgroundColor: challenge.autoRenew ? '#7BA876' : '#E0DED9',
            justifyContent: 'center',
          }}
        >
          <View style={{
            width: 26, height: 26, borderRadius: 13, backgroundColor: 'white',
            alignSelf: challenge.autoRenew ? 'flex-end' : 'flex-start',
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2,
          }} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}