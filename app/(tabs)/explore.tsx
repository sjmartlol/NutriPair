import { useState, useContext, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { logOut, getUserProfile } from '../../services/auth';
import { updateUserName, updateGoals, getCustomFoods, getDailyLogHistory, calculateStreak } from '../../services/database';
import { calculateBMR, ACTIVITY_LABELS, GOAL_LABELS, type Gender, type Goal, type ActivityLevel, type BMRInput, type BMRResult } from '../../services/bmrCalculator';

const { UserContext } = require('../_layout');

function StatBox({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: 'white', borderRadius: 14, padding: 16, alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
    }}>
      <Text style={{ fontSize: 20, marginBottom: 6 }}>{icon}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#2D2D2D' }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#999', fontWeight: '500', marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function EditNameModal({ visible, currentName, onClose, onSave }: any) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(currentName); }, [currentName]);
  const handleSave = async () => { if (!name.trim()) return; setSaving(true); await onSave(name.trim()); setSaving(false); };
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} /></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>Edit name</Text>
              <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: '#999' }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Your name</Text>
            <TextInput value={name} onChangeText={setName} autoFocus style={{ backgroundColor: 'white', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0DED9', fontSize: 18, fontWeight: '600', color: '#2D2D2D', marginBottom: 24 }} />
            <TouchableOpacity onPress={handleSave} disabled={!name.trim() || saving} style={{ backgroundColor: name.trim() ? '#7BA876' : '#D8D8D6', padding: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: name.trim() ? 'white' : '#999', fontWeight: '600', fontSize: 15 }}>{saving ? 'Saving...' : 'Update name'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ===== BMR CALCULATOR WIZARD =====
function BMRWizard({ visible, onClose, onApply }: { visible: boolean; onClose: () => void; onApply: (result: BMRResult) => void }) {
  const [step, setStep] = useState(1);
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [result, setResult] = useState<BMRResult | null>(null);

  const reset = () => { setStep(1); setGender('male'); setAge(''); setWeightLbs(''); setHeightFeet(''); setHeightInches(''); setActivityLevel('moderate'); setGoal('maintain'); setResult(null); };

  const handleCalculate = () => {
    const r = calculateBMR({
      gender, age: Number(age), weightLbs: Number(weightLbs),
      heightFeet: Number(heightFeet), heightInches: Number(heightInches),
      activityLevel, goal,
    });
    setResult(r);
    setStep(4);
  };

  const activities: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
  const goals: Goal[] = ['lose', 'maintain', 'gain'];

  const inputStyle = {
    backgroundColor: 'white', padding: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E0DED9', fontSize: 18,
    fontWeight: '600' as const, color: '#2D2D2D', textAlign: 'center' as const,
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => { onClose(); reset(); }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{
            backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            maxHeight: '90%',
          }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>

            {/* Handle */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} />
            </View>

            {/* Progress */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {[1, 2, 3, 4].map(s => (
                <View key={s} style={{
                  width: s === step ? 24 : 8, height: 8, borderRadius: 4,
                  backgroundColor: s <= step ? '#7BA876' : '#E0DED9',
                }} />
              ))}
            </View>

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 4 }}>About you</Text>
                <Text style={{ fontSize: 14, color: '#999', marginBottom: 24 }}>We'll use this to calculate your ideal calorie goal.</Text>

                <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Gender</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                  {[{ val: 'male' as Gender, emoji: '👨', label: 'Male' }, { val: 'female' as Gender, emoji: '👩', label: 'Female' }].map(g => (
                    <TouchableOpacity key={g.val} onPress={() => setGender(g.val)} style={{
                      flex: 1, padding: 16, borderRadius: 14, alignItems: 'center',
                      backgroundColor: gender === g.val ? '#F0F5EE' : 'white',
                      borderWidth: gender === g.val ? 2 : 1.5,
                      borderColor: gender === g.val ? '#7BA876' : '#E0DED9',
                    }}>
                      <Text style={{ fontSize: 28, marginBottom: 4 }}>{g.emoji}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: gender === g.val ? '#7BA876' : '#666' }}>{g.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Age</Text>
                <TextInput value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" placeholderTextColor="#CCC" style={{ ...inputStyle, marginBottom: 16 }} />

                <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Weight (lbs)</Text>
                <TextInput value={weightLbs} onChangeText={setWeightLbs} keyboardType="numeric" placeholder="165" placeholderTextColor="#CCC" style={{ ...inputStyle, marginBottom: 16 }} />

                <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Height</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput value={heightFeet} onChangeText={setHeightFeet} keyboardType="numeric" placeholder="5" placeholderTextColor="#CCC" style={inputStyle} />
                    <Text style={{ fontSize: 11, color: '#CCC', textAlign: 'center', marginTop: 4 }}>feet</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput value={heightInches} onChangeText={setHeightInches} keyboardType="numeric" placeholder="10" placeholderTextColor="#CCC" style={inputStyle} />
                    <Text style={{ fontSize: 11, color: '#CCC', textAlign: 'center', marginTop: 4 }}>inches</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => { if (age && weightLbs && heightFeet) setStep(2); }}
                  disabled={!age || !weightLbs || !heightFeet}
                  style={{
                    backgroundColor: age && weightLbs && heightFeet ? '#7BA876' : '#D8D8D6',
                    padding: 14, borderRadius: 12, alignItems: 'center',
                  }}>
                  <Text style={{ color: age && weightLbs && heightFeet ? 'white' : '#999', fontWeight: '600', fontSize: 15 }}>Continue</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Activity Level */}
            {step === 2 && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Activity level</Text>
                <Text style={{ fontSize: 14, color: '#999', marginBottom: 24 }}>How active are you on a typical week?</Text>

                <View style={{ gap: 8, marginBottom: 24 }}>
                  {activities.map(a => (
                    <TouchableOpacity key={a} onPress={() => setActivityLevel(a)} style={{
                      padding: 16, borderRadius: 14,
                      backgroundColor: activityLevel === a ? '#F0F5EE' : 'white',
                      borderWidth: activityLevel === a ? 2 : 1.5,
                      borderColor: activityLevel === a ? '#7BA876' : '#E0DED9',
                    }}>
                      <Text style={{
                        fontSize: 14, fontWeight: '600',
                        color: activityLevel === a ? '#7BA876' : '#2D2D2D',
                      }}>{ACTIVITY_LABELS[a]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setStep(1)} style={{
                    flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
                    borderWidth: 1.5, borderColor: '#E0DED9',
                  }}>
                    <Text style={{ color: '#999', fontWeight: '600' }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setStep(3)} style={{
                    flex: 2, backgroundColor: '#7BA876', padding: 14, borderRadius: 12, alignItems: 'center',
                  }}>
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: Goal */}
            {step === 3 && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Your goal</Text>
                <Text style={{ fontSize: 14, color: '#999', marginBottom: 24 }}>What are you trying to achieve?</Text>

                <View style={{ gap: 8, marginBottom: 24 }}>
                  {goals.map(g => {
                    const emojis: Record<Goal, string> = { lose: '📉', maintain: '⚖️', gain: '💪' };
                    return (
                      <TouchableOpacity key={g} onPress={() => setGoal(g)} style={{
                        padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
                        backgroundColor: goal === g ? '#F0F5EE' : 'white',
                        borderWidth: goal === g ? 2 : 1.5,
                        borderColor: goal === g ? '#7BA876' : '#E0DED9',
                      }}>
                        <Text style={{ fontSize: 24 }}>{emojis[g]}</Text>
                        <Text style={{
                          fontSize: 15, fontWeight: '600',
                          color: goal === g ? '#7BA876' : '#2D2D2D',
                        }}>{GOAL_LABELS[g]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setStep(2)} style={{
                    flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
                    borderWidth: 1.5, borderColor: '#E0DED9',
                  }}>
                    <Text style={{ color: '#999', fontWeight: '600' }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCalculate} style={{
                    flex: 2, backgroundColor: '#7BA876', padding: 14, borderRadius: 12, alignItems: 'center',
                  }}>
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>Calculate</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 4: Results */}
            {step === 4 && result && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Your results</Text>
                <Text style={{ fontSize: 14, color: '#999', marginBottom: 20 }}>Based on the Mifflin-St Jeor equation</Text>

                {/* Main calorie card */}
                <View style={{
                  backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center',
                  marginBottom: 16, borderWidth: 2, borderColor: '#7BA876',
                }}>
                  <Text style={{ fontSize: 13, color: '#999', fontWeight: '500', marginBottom: 4 }}>Your daily calorie goal</Text>
                  <Text style={{ fontSize: 48, fontWeight: '700', color: '#7BA876' }}>{result.calorieGoal}</Text>
                  <Text style={{ fontSize: 14, color: '#999' }}>calories per day</Text>
                  {result.deficit !== 0 && (
                    <View style={{
                      marginTop: 12, paddingHorizontal: 12, paddingVertical: 6,
                      borderRadius: 8, backgroundColor: result.deficit < 0 ? '#FFF5F3' : '#F0F5EE',
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: result.deficit < 0 ? '#D4845A' : '#7BA876' }}>
                        {result.deficit < 0 ? `${Math.abs(result.deficit)} cal deficit` : `${result.deficit} cal surplus`} from maintenance
                      </Text>
                    </View>
                  )}
                </View>

                {/* Breakdown */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 14, padding: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>BMR</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700' }}>{result.bmr}</Text>
                    <Text style={{ fontSize: 10, color: '#CCC' }}>cal/day</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 14, padding: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>TDEE</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700' }}>{result.tdee}</Text>
                    <Text style={{ fontSize: 10, color: '#CCC' }}>cal/day</Text>
                  </View>
                </View>

                {/* Macros */}
                <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 18, marginBottom: 24 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 12 }}>Recommended macros</Text>
                  {[
                    { label: 'Protein', value: `${result.proteinGoal}g`, cal: `${result.proteinGoal * 4} cal`, color: '#7BA876' },
                    { label: 'Carbs', value: `${result.carbsGoal}g`, cal: `${result.carbsGoal * 4} cal`, color: '#D4A45A' },
                    { label: 'Fat', value: `${result.fatGoal}g`, cal: `${result.fatGoal * 9} cal`, color: '#D4845A' },
                  ].map((m, i) => (
                    <View key={m.label} style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#F0F0EE',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                        <Text style={{ fontSize: 14, fontWeight: '600' }}>{m.label}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: m.color }}>{m.value}</Text>
                        <Text style={{ fontSize: 11, color: '#CCC' }}>{m.cal}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity onPress={() => { onApply(result); reset(); }} style={{
                  backgroundColor: '#7BA876', padding: 16, borderRadius: 12, alignItems: 'center',
                  shadowColor: '#7BA876', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8,
                  marginBottom: 10,
                }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Apply these goals</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setStep(1)} style={{
                  padding: 14, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1.5, borderColor: '#E0DED9',
                }}>
                  <Text style={{ color: '#999', fontWeight: '600' }}>Recalculate</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ===== MAIN PROFILE SCREEN =====
export default function ProfileScreen() {
  const ctx = useContext(UserContext);
  const profile = ctx?.profile;
  const user = ctx?.user;
  const todayLog = ctx?.todayLog;

  const [showEditName, setShowEditName] = useState(false);
  const [showBMR, setShowBMR] = useState(false);
  const [customFoodCount, setCustomFoodCount] = useState(0);
  const [totalMealsLogged, setTotalMealsLogged] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const customFoods = await getCustomFoods(user.uid);
      setCustomFoodCount(customFoods.length);
      const history = await getDailyLogHistory(user.uid, 60);
      const totalMeals = Object.values(history).reduce((sum: number, log: any) => sum + (log.mealsLogged || 0), 0);
      setTotalMealsLogged(totalMeals);
      const s = calculateStreak(history, profile?.calorieGoal || 2000);
      setStreak(s);
    })();
  }, [user?.uid, todayLog]);

  const handleSaveName = async (newName: string) => {
    try {
      await updateUserName(user.uid, newName);
      const updated = await getUserProfile(user.uid);
      ctx.setProfile(updated);
      setShowEditName(false);
      Alert.alert('Updated!', `Your name is now ${newName}`);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleApplyBMR = async (result: BMRResult) => {
    try {
      await updateGoals(user.uid, {
        calorieGoal: result.calorieGoal,
        proteinGoal: result.proteinGoal,
        carbsGoal: result.carbsGoal,
        fatGoal: result.fatGoal,
      });
      const updated = await getUserProfile(user.uid);
      ctx.setProfile(updated);
      setShowBMR(false);
      Alert.alert('Goals updated!', `Calories: ${result.calorieGoal} · P: ${result.proteinGoal}g · C: ${result.carbsGoal}g · F: ${result.fatGoal}g`);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logOut() },
    ]);
  };

  const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F3' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Profile</Text>
      </View>

      {/* Avatar + Name */}
      <View style={{ marginHorizontal: 24, marginTop: 20, backgroundColor: 'white', borderRadius: 20, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: '#7BA876', justifyContent: 'center', alignItems: 'center', shadowColor: '#7BA876', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}>
          <Text style={{ fontSize: 36, fontWeight: '700', color: 'white' }}>{initial}</Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: '700', marginTop: 16 }}>{profile?.name}</Text>
        <Text style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{profile?.email}</Text>
        <TouchableOpacity onPress={() => setShowEditName(true)} style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F5F5F3' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#7BA876' }}>Edit name ✏️</Text>
        </TouchableOpacity>
      </View>

      {/* BMR Calculator Button */}
      <TouchableOpacity onPress={() => setShowBMR(true)} style={{
        marginHorizontal: 24, marginTop: 16, borderRadius: 16, padding: 20,
        backgroundColor: '#2D2D2D', flexDirection: 'row', alignItems: 'center', gap: 14,
      }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(123,168,118,0.2)', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 22 }}>🧮</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: 'white' }}>Calculate your ideal goals</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>BMR calculator based on your body & goals</Text>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>→</Text>
      </TouchableOpacity>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 16 }}>
        <StatBox label="Day streak" value={`${streak}`} icon="🔥" />
        <StatBox label="Meals logged" value={`${totalMealsLogged}`} icon="🍽️" />
        <StatBox label="Custom foods" value={`${customFoodCount}`} icon="⭐" />
      </View>

      {/* Goals Summary */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Your goals</Text>
        <View style={{ backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
          {[
            { label: 'Daily calories', value: `${profile?.calorieGoal || 2000} cal`, color: '#2D2D2D' },
            { label: 'Protein goal', value: `${profile?.proteinGoal || 150}g`, color: '#7BA876' },
            { label: 'Carbs goal', value: `${profile?.carbsGoal || 250}g`, color: '#D4A45A' },
            { label: 'Fat goal', value: `${profile?.fatGoal || 65}g`, color: '#D4845A' },
          ].map((item, i) => (
            <View key={item.label} style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: 16, paddingHorizontal: 18,
              borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: '#F0F0EE',
            }}>
              <Text style={{ fontSize: 14, color: '#666' }}>{item.label}</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: item.color }}>{item.value}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 12, color: '#CCC', marginTop: 8, textAlign: 'center' }}>Edit goals from the Home tab or use the BMR calculator</Text>
      </View>

      {/* Partner Info */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Partner</Text>
        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
          {profile?.partnerId ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#8BA4D4', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>✓</Text>
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>Paired with a partner</Text>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>View details on the Partner tab</Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F5F3', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18 }}>👥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>No partner yet</Text>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  Your code: <Text style={{ fontWeight: '700', color: '#7BA876' }}>{profile?.partnerCode}</Text>
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Account */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Account</Text>
        <View style={{ backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
          <View style={{ padding: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F0F0EE' }}>
            <Text style={{ fontSize: 14, color: '#666' }}>Email</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 2 }}>{profile?.email}</Text>
          </View>
          <View style={{ padding: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F0F0EE' }}>
            <Text style={{ fontSize: 14, color: '#666' }}>Member since</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 2 }}>
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}
            </Text>
          </View>
          <View style={{ padding: 16, paddingHorizontal: 18 }}>
            <Text style={{ fontSize: 14, color: '#666' }}>Partner code</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#7BA876', marginTop: 2, letterSpacing: 2 }}>{profile?.partnerCode}</Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity onPress={handleSignOut} style={{
        marginHorizontal: 24, marginTop: 24, padding: 14, borderRadius: 12, alignItems: 'center',
        backgroundColor: 'white', borderWidth: 1.5, borderColor: '#F0DAD5',
      }}>
        <Text style={{ color: '#D45A5A', fontWeight: '600' }}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={{ textAlign: 'center', fontSize: 11, color: '#DDD', marginTop: 16 }}>NutriPair v1.0</Text>

      <EditNameModal visible={showEditName} currentName={profile?.name || ''} onClose={() => setShowEditName(false)} onSave={handleSaveName} />
      <BMRWizard visible={showBMR} onClose={() => setShowBMR(false)} onApply={handleApplyBMR} />
    </ScrollView>
  );
}