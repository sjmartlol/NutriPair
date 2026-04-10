import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { getStaySignedInPreference, onAuthChange, getUserProfile, setStaySignedInPreference, signIn, signUp, logOut } from '../services/auth';
import { getTodayLog, getPresets, getDailyLogHistory, calculateStreak, getPartnerData, completeOnboarding, updateGoals } from '../services/database';
import { registerForPushNotifications } from '../services/notifications';
import OnboardingScreen from './onboarding';
import { calculateBMR, ACTIVITY_LABELS, GOAL_LABELS, type Gender, type Goal, type ActivityLevel, type BMRResult } from '../services/bmrCalculator';
import { useRouter } from 'expo-router';
export const UserContext = require('react').createContext(null);

export default function RootLayout() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [todayLog, setTodayLog] = useState<any>(null); 
  const [loading, setLoading] = useState(true);
  const [showBMRAfterOnboarding, setShowBMRAfterOnboarding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser: any) => {
      if (firebaseUser) {
        const staySignedIn = await getStaySignedInPreference();
        if (!staySignedIn) {
          await logOut();
          setLoading(false);
          return;
        }
        const p = await getUserProfile(firebaseUser.uid);
        const log = await getTodayLog(firebaseUser.uid);
        setUser(firebaseUser);
        setProfile(p);
        setTodayLog(log);
	// Register for push notifications
	registerForPushNotifications(firebaseUser.uid).catch(console.error);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F3' }}>
        <ActivityIndicator size="large" color="#7BA876" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (profile && profile.onboardingComplete === false) {
    return (
      <OnboardingScreen onComplete={async () => {
        await completeOnboarding(user.uid);
        const updated = await getUserProfile(user.uid);
        setProfile(updated);
        setShowBMRAfterOnboarding(true);
      }} />
    );
  }

  return (
    <UserContext.Provider value={{ user, profile, todayLog, setTodayLog, setProfile }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      {showBMRAfterOnboarding && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F5F5F3', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🧮</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Set up your goals</Text>
          <Text style={{ fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 32 }}>Head to your Profile tab and tap "Calculate your ideal goals" to get personalized calorie and macro targets.</Text>
          <TouchableOpacity onPress={() => { setShowBMRAfterOnboarding(false); router.push('/explore'); }} style={{
            backgroundColor: '#7BA876', padding: 16, borderRadius: 14, alignItems: 'center', width: '100%',
            shadowColor: '#7BA876', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
          }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Got it, let's go!</Text>
          </TouchableOpacity>
        </View>
      )}
    </UserContext.Provider>
  );
 }

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBMRAfterOnboarding, setShowBMRAfterOnboarding] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [prefLoading, setPrefLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const pref = await getStaySignedInPreference();
      setStaySignedIn(pref);
      setPrefLoading(false);
    })();
  }, []);
  
  const handleSubmit = async () => {
    try {
      setError('');
      setLoading(true);
      await setStaySignedInPreference(staySignedIn);
      if (isSignup) {
        await signUp(email, password, name, 2000);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const input = {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#E0DED9',
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F5F5F3' }}>
      <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 4 }}>🥗</Text>
      <Text style={{ fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
        NutriPair
      </Text>
      <Text style={{ fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 32 }}>
        Better nutrition, together.
      </Text>

      {isSignup && (
        <TextInput placeholder="Your name" value={name} onChangeText={setName} style={input} />
      )}
      <TextInput
        placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" style={input}
      />
      <TextInput
        placeholder="Password (min 6 characters)" value={password}
        onChangeText={setPassword} secureTextEntry style={input}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, marginBottom: 10 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#2D2D2D' }}>Stay signed in</Text>
          <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
            {staySignedIn ? 'Keep you logged in after restarting the app' : 'You’ll be signed out when you restart the app'}
          </Text>
        </View>
        <Switch
          value={staySignedIn}
          disabled={prefLoading || loading}
          onValueChange={setStaySignedIn}
          trackColor={{ false: '#E0DED9', true: '#A8C5A0' }}
          thumbColor={staySignedIn ? '#7BA876' : '#f4f3f4'}
        />
      </View>

      {error ? (
        <Text style={{ color: '#D45A5A', marginBottom: 12, fontSize: 13 }}>{error}</Text>
      ) : null}

      <TouchableOpacity onPress={handleSubmit} disabled={loading}
        style={{
          backgroundColor: loading ? '#A8C5A0' : '#7BA876',
          padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8,
        }}>
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
          {loading ? 'Please wait...' : isSignup ? 'Sign Up' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { setIsSignup(!isSignup); setError(''); }}
        style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ color: '#7BA876', fontWeight: '600' }}>
          {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}