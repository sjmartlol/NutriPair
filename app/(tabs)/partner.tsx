import { useState, useContext, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getPartnerData, findUserByCode, pairPartners, listenToDayLog, getTodaysMeals } from '../../services/database';
import { getUserProfile } from '../../services/auth';
import { getPartnerPushToken, sendNudgeNotification } from '../../services/notifications';

const { UserContext } = require('../_layout');

const NUDGE_PRESETS = [
  { emoji: '🍽️', text: "Don't forget to log lunch!" },
  { emoji: '💪', text: "You've got this today!" },
  { emoji: '🔥', text: 'Keep that streak alive!' },
  { emoji: '🥗', text: "What's for dinner tonight?" },
  { emoji: '💧', text: 'Stay hydrated!' },
  { emoji: '🎯', text: 'Almost at your goal — finish strong!' },
];

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 140;
  const sw = 8;
  const r = (size / 2) - sw;
  const c = 2 * Math.PI * r;
  const pct = Math.min((consumed / goal) * 100, 100);
  const offset = c - (pct / 100) * c;
  const remaining = goal - consumed;
  const ratio = consumed / goal;
  const color = ratio >= 0.95 && ratio <= 1.1 ? '#7BA876' : ratio >= 0.85 ? '#D4A45A' : '#8BA4D4';

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E8E6" strokeWidth={sw} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={offset}
          rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#2D2D2D' }}>{consumed}</Text>
        <Text style={{ fontSize: 11, color: '#999' }}>of {goal} cal</Text>
      </View>
      <Text style={{ marginTop: 6, fontSize: 13, color: remaining > 0 ? color : '#7BA876', fontWeight: '500' }}>
        {remaining > 0 ? `${remaining} cal remaining` : 'Goal reached!'}
      </Text>
    </View>
  );
}

function MacroBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = Math.min((current / goal) * 100, 100);
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

// ===== PAIRING SCREEN (shown when no partner is linked) =====
function PairingScreen({ user, profile, onPaired }: { user: any; profile: any; onPaired: () => void }) {
  const [code, setCode] = useState('');
  const [pairing, setPairing] = useState(false);

  const handlePair = async () => {
    if (!code.trim()) return;
    setPairing(true);
    try {
      const partner = await findUserByCode(code.trim().toUpperCase());
      if (!partner) {
        Alert.alert('Not found', 'No user found with that code. Double-check and try again.');
        setPairing(false);
        return;
      }
      if (partner.uid === user.uid) {
        Alert.alert('Oops', "That's your own code!");
        setPairing(false);
        return;
      }
      if (partner.partnerId) {
        Alert.alert('Already paired', `${partner.name} is already paired with someone.`);
        setPairing(false);
        return;
      }
      await pairPartners(user.uid, partner.uid);
      Alert.alert('Paired!', `You're now connected with ${partner.name}! 🎉`);
      onPaired();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setPairing(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F3' }}
      contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Partner</Text>
      </View>

      <View style={{ alignItems: 'center', paddingHorizontal: 24, marginTop: 40 }}>
        <Text style={{ fontSize: 48 }}>👥</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 16 }}>No partner yet</Text>
        <Text style={{ fontSize: 14, color: '#999', marginTop: 4, textAlign: 'center' }}>
          Pair up to track nutrition together and keep each other accountable!
        </Text>
      </View>

      {/* Your code */}
      <View style={{
        marginHorizontal: 24, marginTop: 32, backgroundColor: 'white',
        borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E8E8E6',
      }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Your invite code
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#7BA876', letterSpacing: 3 }}>
          {profile?.partnerCode || 'Loading...'}
        </Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
          Share this code with your partner
        </Text>
      </View>

      {/* Enter partner code */}
      <View style={{
        marginHorizontal: 24, marginTop: 16, backgroundColor: 'white',
        borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E8E8E6',
      }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Or enter their code
        </Text>
        <TextInput
          placeholder="NUTRI-0000"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          style={{
            fontSize: 20, fontWeight: '600', textAlign: 'center', letterSpacing: 3,
            padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0DED9',
            backgroundColor: 'white', color: '#2D2D2D',
          }}
          placeholderTextColor="#CCC"
        />
        <TouchableOpacity onPress={handlePair} disabled={pairing || !code.trim()} style={{
          marginTop: 16, backgroundColor: code.trim() ? '#7BA876' : '#D8D8D6',
          padding: 14, borderRadius: 12, alignItems: 'center',
        }}>
          <Text style={{ color: code.trim() ? 'white' : '#999', fontWeight: '600', fontSize: 15 }}>
            {pairing ? 'Pairing...' : 'Pair with partner'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ===== MAIN PARTNER VIEW (shown when paired) =====
export default function PartnerScreen() {
  const ctx = useContext(UserContext);
  const user = ctx?.user;
  const profile = ctx?.profile;

  const [partner, setPartner] = useState<any>(null);
  const [partnerLog, setPartnerLog] = useState<any>(null);
  const [partnerMeals, setPartnerMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [customMsg, setCustomMsg] = useState('');

  const loadPartner = async () => {
    if (!profile?.partnerId) {
      setLoading(false);
      return;
    }
    try {
      const data = await getPartnerData(profile.partnerId);
      setPartner(data);
      if (data?.todayLog) setPartnerLog(data.todayLog);
      if (data?.meals) setPartnerMeals(data.meals);
    } catch (err) {
      console.error('Error loading partner:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPartner();
  }, [profile?.partnerId]);

  // Real-time listener for partner's daily log
  useEffect(() => {
    if (!profile?.partnerId) return;
    const today = new Date().toISOString().split('T')[0];
    const unsubscribe = listenToDayLog(profile.partnerId, today, (data: any) => {
      setPartnerLog(data);
    });
    return () => unsubscribe();
  }, [profile?.partnerId]);

  const handlePaired = async () => {
    const updated = await getUserProfile(user.uid);
    ctx.setProfile(updated);
    loadPartner();
  };

  const sendNudge = async (message?: string) => {
    setNudgeSent(true);
    try {
      const token = await getPartnerPushToken(profile.partnerId);
      if (token) {
        const msg = message || customMsg.trim() || "Hey! Don't forget to log your meals! 🍽️";
        await sendNudgeNotification(token, profile.name, msg);
      }
    } catch (err) {
      console.error('Nudge error:', err);
    }
    setTimeout(() => {
      setShowNudge(false);
      setNudgeSent(false);
      setCustomMsg('');
      Alert.alert('Nudge sent!', `${partner?.name} will get a notification 👋`);
    }, 1200);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F3' }}>
        <Text style={{ color: '#999' }}>Loading...</Text>
      </View>
    );
  }

  if (!profile?.partnerId) {
    return <PairingScreen user={user} profile={profile} onPaired={handlePaired} />;
  }

  const consumed = partnerLog?.totalCalories || 0;
  const partnerGoal = partner?.calorieGoal || 1800;

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F3' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>Partner</Text>
        </View>

        {/* Partner Profile Card */}
        <View style={{
          marginHorizontal: 24, marginTop: 16, backgroundColor: 'white',
          borderRadius: 20, padding: 24,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <View style={{
              width: 52, height: 52, borderRadius: 16,
              backgroundColor: '#8BA4D4', justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 22 }}>
                {partner?.name?.charAt(0) || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>{partner?.name || 'Partner'}</Text>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>🔥 {partner?.streak || 0} day streak</Text>
            </View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: consumed > 0 ? '#F0F5EE' : '#FFF5F3',
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
            }}>
              <View style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: consumed > 0 ? '#7BA876' : '#D4845A',
              }} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: consumed > 0 ? '#7BA876' : '#D4845A' }}>
                {consumed > 0 ? 'Active today' : 'No logs yet'}
              </Text>
            </View>
          </View>

          <CalorieRing consumed={consumed} goal={partnerGoal} />

          <View style={{ flexDirection: 'row', gap: 14, marginTop: 20 }}>
            <MacroBar label="Protein" current={partnerLog?.totalProtein || 0} goal={130} color="#7BA876" />
            <MacroBar label="Carbs" current={partnerLog?.totalCarbs || 0} goal={220} color="#D4A45A" />
            <MacroBar label="Fat" current={partnerLog?.totalFat || 0} goal={55} color="#D4845A" />
          </View>
        </View>

        {/* Send Nudge Button */}
        <TouchableOpacity onPress={() => setShowNudge(true)} style={{
          marginHorizontal: 24, marginTop: 16, backgroundColor: '#8BA4D4',
          borderRadius: 16, padding: 18, flexDirection: 'row',
          alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <Text style={{ fontSize: 22 }}>👋</Text>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: 'white' }}>Send nudge</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Cheer them on</Text>
          </View>
        </TouchableOpacity>

        {/* Partner's Meals */}
        <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 12 }}>
            {partner?.name}'s meals today
          </Text>
          <View style={{
            backgroundColor: 'white', borderRadius: 16, overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
          }}>
            {partnerMeals.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#999', fontSize: 14 }}>No meals logged yet today</Text>
              </View>
            ) : (
              partnerMeals.map((meal: any, i: number) => (
                <View key={meal.id || i} style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  padding: 14, paddingHorizontal: 18,
                  borderBottomWidth: i < partnerMeals.length - 1 ? 1 : 0, borderBottomColor: '#F0F0EE',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F5F3',
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 16 }}>
                        {meal.mealType === 'Breakfast' ? '🥚' : meal.mealType === 'Lunch' ? '🥗' : meal.mealType === 'Dinner' ? '🍗' : '🥤'}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600' }}>{meal.name}</Text>
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{meal.mealType}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#666' }}>{meal.calories} cal</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Nudge Modal */}
      <Modal visible={showNudge} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
            activeOpacity={1}
            onPress={() => { if (!nudgeSent) setShowNudge(false); }}
          />
          <View style={{
            backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 24, paddingBottom: 40, maxHeight: '80%',
          }}>
            {nudgeSent ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36, backgroundColor: '#F0F5EE',
                  justifyContent: 'center', alignItems: 'center', marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 36 }}>👋</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700' }}>Nudge sent!</Text>
                <Text style={{ fontSize: 14, color: '#999', marginTop: 6 }}>
                  {partner?.name} will get a notification
                </Text>
              </View>
            ) : (
              <>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 20, fontWeight: '700' }}>Send a nudge</Text>
                  <TouchableOpacity onPress={() => setShowNudge(false)}>
                    <Text style={{ fontSize: 18, color: '#999' }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>Pick a message or write your own</Text>

                <ScrollView style={{ maxHeight: 300 }}>
                  {NUDGE_PRESETS.map((n, i) => (
                    <TouchableOpacity key={i} onPress={() => sendNudge(n.text)} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 14, borderRadius: 12, backgroundColor: 'white',
                      borderWidth: 1.5, borderColor: '#E8E8E6', marginBottom: 8,
                    }}>
                      <Text style={{ fontSize: 20 }}>{n.emoji}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: '#2D2D2D' }}>{n.text}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput
                    placeholder={`Message ${partner?.name}...`}
                    value={customMsg}
                    onChangeText={setCustomMsg}
                    style={{
                      flex: 1, padding: 12, borderRadius: 12,
                      borderWidth: 1.5, borderColor: '#E0DED9',
                      fontSize: 14, backgroundColor: 'white',
                    }}
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity onPress={() => sendNudge(customMsg.trim() || undefined)}style={{
                    width: 48, height: 48, borderRadius: 12,
                    backgroundColor: '#8BA4D4', justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ color: 'white', fontSize: 16 }}>▶</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}