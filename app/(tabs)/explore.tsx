import { useState, useContext, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { logOut, getUserProfile } from '../../services/auth';
import { updateUserName, updateGoals, getCustomFoods, getDailyLogHistory, calculateStreak } from '../../services/database';

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

function EditNameModal({ visible, currentName, onClose, onSave }: {
  visible: boolean; currentName: string; onClose: () => void; onSave: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(currentName); }, [currentName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim());
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{
            backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 24, paddingBottom: 40,
          }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8D6' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>Edit name</Text>
              <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: '#999' }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Your name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={{
                backgroundColor: 'white', padding: 14, borderRadius: 12,
                borderWidth: 1.5, borderColor: '#E0DED9', fontSize: 18,
                fontWeight: '600', color: '#2D2D2D', marginBottom: 24,
              }}
              autoFocus
            />
            <TouchableOpacity onPress={handleSave} disabled={!name.trim() || saving} style={{
              backgroundColor: name.trim() ? '#7BA876' : '#D8D8D6',
              padding: 14, borderRadius: 12, alignItems: 'center',
            }}>
              <Text style={{ color: name.trim() ? 'white' : '#999', fontWeight: '600', fontSize: 15 }}>
                {saving ? 'Saving...' : 'Update name'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const ctx = useContext(UserContext);
  const profile = ctx?.profile;
  const user = ctx?.user;
  const todayLog = ctx?.todayLog;

  const [showEditName, setShowEditName] = useState(false);
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
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You can sign back in anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logOut() },
      ]
    );
  };

  const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F3' }} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 56 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Profile</Text>
      </View>

      {/* Avatar + Name Card */}
      <View style={{
        marginHorizontal: 24, marginTop: 20, backgroundColor: 'white',
        borderRadius: 20, padding: 28, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
      }}>
        <View style={{
          width: 80, height: 80, borderRadius: 24,
          backgroundColor: '#7BA876', justifyContent: 'center', alignItems: 'center',
          shadowColor: '#7BA876', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
        }}>
          <Text style={{ fontSize: 36, fontWeight: '700', color: 'white' }}>{initial}</Text>
        </View>

        <Text style={{ fontSize: 24, fontWeight: '700', marginTop: 16 }}>{profile?.name}</Text>
        <Text style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{profile?.email}</Text>

        <TouchableOpacity onPress={() => setShowEditName(true)} style={{
          marginTop: 12, paddingHorizontal: 16, paddingVertical: 8,
          borderRadius: 10, backgroundColor: '#F5F5F3',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#7BA876' }}>Edit name ✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginTop: 16 }}>
        <StatBox label="Day streak" value={`${streak}`} icon="🔥" />
        <StatBox label="Meals logged" value={`${totalMealsLogged}`} icon="🍽️" />
        <StatBox label="Custom foods" value={`${customFoodCount}`} icon="⭐" />
      </View>

      {/* Goals Summary */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Your goals</Text>
        <View style={{
          backgroundColor: 'white', borderRadius: 16, overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        }}>
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
        <Text style={{ fontSize: 12, color: '#CCC', marginTop: 8, textAlign: 'center' }}>
          Edit goals from the Home tab
        </Text>
      </View>

      {/* Partner Info */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Partner</Text>
        <View style={{
          backgroundColor: 'white', borderRadius: 16, padding: 18,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        }}>
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

      {/* Account Section */}
      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Account</Text>
        <View style={{
          backgroundColor: 'white', borderRadius: 16, overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
        }}>
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#7BA876', marginTop: 2, letterSpacing: 2 }}>
              {profile?.partnerCode}
            </Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity onPress={handleSignOut} style={{
        marginHorizontal: 24, marginTop: 24, padding: 14,
        borderRadius: 12, alignItems: 'center',
        backgroundColor: 'white', borderWidth: 1.5, borderColor: '#F0DAD5',
      }}>
        <Text style={{ color: '#D45A5A', fontWeight: '600' }}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={{ textAlign: 'center', fontSize: 11, color: '#DDD', marginTop: 16 }}>
        NutriPair v1.0
      </Text>

      <EditNameModal
        visible={showEditName}
        currentName={profile?.name || ''}
        onClose={() => setShowEditName(false)}
        onSave={handleSaveName}
      />
    </ScrollView>
  );
}