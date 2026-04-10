import { useContext, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { lookupBarcode } from '../services/foodSearch';
import { analyzeFoodPhoto } from '../services/foodVision';
import { addCustomFood, getTodayLog, logMeal } from '../services/database';

type ScanMode = 'barcode' | 'ai';
const { UserContext } = require('./_layout');

export default function ScanFoodScreen() {
  const ctx: any = useContext(UserContext);
  const router = useRouter();
  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('barcode');
  const [busy, setBusy] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [showAiResults, setShowAiResults] = useState(false);
  const [pendingFood, setPendingFood] = useState<any | null>(null);
  const [mealType, setMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'>('Breakfast');
  const [servingsCount, setServingsCount] = useState('1');
  const [logging, setLogging] = useState(false);
  const scanLock = useRef(false);

  const ensureCamera = async () => {
    if (cameraPermission?.granted) return true;
    const r = await requestCameraPermission();
    if (!r.granted) {
      Alert.alert('Camera needed', 'Please allow camera access to scan food.');
      return false;
    }
    return true;
  };

  const getUid = async () => {
    const authMod = await import('firebase/auth');
    const cfg = await import('../firebaseConfig');
    const uid = authMod.getAuth(cfg.app).currentUser?.uid;
    if (!uid) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return null;
    }
    return uid;
  };

  const openLogSheet = (food: any) => {
    setPendingFood(food);
    setMealType('Breakfast');
    setServingsCount('1');
  };

  const logAndSaveFood = async (source: 'barcode' | 'ai') => {
    if (!pendingFood) return;
    const uid = await getUid();
    if (!uid) return;
    const count = Math.max(0.1, Number(servingsCount) || 1);
    const payload = {
      ...pendingFood,
      source,
      servingsCount: count,
      baseCalories: Number(pendingFood.calories) || 0,
      baseProtein: Number(pendingFood.protein) || 0,
      baseCarbs: Number(pendingFood.carbs) || 0,
      baseFat: Number(pendingFood.fat) || 0,
      calories: Number(((Number(pendingFood.calories) || 0) * count).toFixed(2)),
      protein: Number(((Number(pendingFood.protein) || 0) * count).toFixed(2)),
      carbs: Number(((Number(pendingFood.carbs) || 0) * count).toFixed(2)),
      fat: Number(((Number(pendingFood.fat) || 0) * count).toFixed(2)),
      mealType,
      serving: `${count} × ${pendingFood.serving || '1 serving'}`,
    };

    setLogging(true);
    try {
      await addCustomFood(uid, payload);
      await logMeal(uid, payload);
      const updated = await getTodayLog(uid);
      ctx?.setTodayLog?.(updated);
      setPendingFood(null);
      setShowAiResults(false);
      router.replace({ pathname: '/my-foods', params: { mode: 'scan' } });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setLogging(false);
  };

  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (mode !== 'barcode') return;
    if (scanLock.current || busy) return;
    scanLock.current = true;
    setBusy(true);
    try {
      const food = await lookupBarcode(data).catch(() => null);
      if (food && food.calories > 0) {
        openLogSheet({ ...food, barcode: data });
        scanLock.current = false;
      } else {
        Alert.alert('Not found', 'Could not find nutrition data for this barcode.');
        scanLock.current = false;
      }
    } finally {
      setBusy(false);
    }
  };

  const takePhotoAndAnalyze = async () => {
    if (mode !== 'ai') return;
    if (!cameraRef.current || busy) return;
    if (!(await ensureCamera())) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5, exif: false });
      if (!photo?.base64) throw new Error('No image data');
      const results = await analyzeFoodPhoto(photo.base64);
      setAiResults(results || []);
      setShowAiResults(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not analyze photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: 'white' }}>Scan your food</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 16, color: 'white', fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: 3, flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => { scanLock.current = false; setMode('barcode'); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: mode === 'barcode' ? '#2D2D2D' : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: mode === 'barcode' ? 'white' : 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 13 }}>Barcode</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('ai')} style={{ flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: mode === 'ai' ? '#2D2D2D' : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: mode === 'ai' ? 'white' : 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 13 }}>AI photo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
        onBarcodeScanned={mode === 'barcode' ? handleBarcodeScan : undefined}
      />

      {mode === 'barcode' && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '48%',
            left: '50%',
            width: '80%',
            height: 120,
            marginLeft: '-40%',
            marginTop: -60,
            borderWidth: 2,
            borderColor: '#7BA876',
            borderRadius: 12,
          }}
        />
      )}

      <View style={{ paddingHorizontal: 20, paddingVertical: 22, paddingBottom: 48, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center' }}>
        {mode === 'barcode' ? (
          <>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 10 }}>Align barcode in the frame</Text>
          </>
        ) : (
          <TouchableOpacity
            onPress={takePhotoAndAnalyze}
            disabled={busy}
            style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: 'white', backgroundColor: busy ? '#7BA876' : 'transparent', justifyContent: 'center', alignItems: 'center' }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'white' }} />
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showAiResults} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setShowAiResults(false)} />
          <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 28, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '800' }}>AI estimates</Text>
              <TouchableOpacity onPress={() => setShowAiResults(false)}><Text style={{ fontSize: 18, color: '#999' }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {aiResults.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { openLogSheet(item); setShowAiResults(false); }}
                  style={{ backgroundColor: 'white', borderRadius: 14, borderWidth: 1.5, borderColor: '#E0DED9', padding: 14, marginBottom: 8 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#2D2D2D' }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 3 }}>{item.serving} · {item.calories} cal</Text>
                  <Text style={{ fontSize: 12, color: '#7BA876', marginTop: 2 }}>Tap to log + save</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!pendingFood} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setPendingFood(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: '#F5F5F3', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
              <Text style={{ fontSize: 20, fontWeight: '800' }}>Log scanned food</Text>
              <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{pendingFood?.name}</Text>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{pendingFood?.serving} · {pendingFood?.calories} cal</Text>

              <Text style={{ fontSize: 12, fontWeight: '800', color: '#999', marginTop: 14, marginBottom: 8 }}>Meal type</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).map(t => (
                  <TouchableOpacity key={t} onPress={() => setMealType(t)} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: mealType === t ? '#2D2D2D' : 'white', borderWidth: mealType === t ? 0 : 1.5, borderColor: '#E0DED9' }}>
                    <Text style={{ color: mealType === t ? 'white' : '#666', fontSize: 12, fontWeight: '700' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 12, fontWeight: '800', color: '#999', marginTop: 14, marginBottom: 6 }}>Servings count</Text>
              <TextInput value={servingsCount} onChangeText={setServingsCount} keyboardType="decimal-pad" style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E0DED9', borderRadius: 10, padding: 12, fontSize: 16, fontWeight: '700', textAlign: 'center' }} />

              {(() => {
                const count = Math.max(0.1, Number(servingsCount) || 1);
                const calories = (Number(pendingFood?.calories) || 0) * count;
                const protein = (Number(pendingFood?.protein) || 0) * count;
                const carbs = (Number(pendingFood?.carbs) || 0) * count;
                const fat = (Number(pendingFood?.fat) || 0) * count;
                return (
                  <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#E8E8E6' }}>
                    <Text style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Auto-calculated totals</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#2D2D2D' }}>
                      {Math.round(calories)} cal · {protein.toFixed(1)}g P · {carbs.toFixed(1)}g C · {fat.toFixed(1)}g F
                    </Text>
                  </View>
                );
              })()}

              <TouchableOpacity onPress={() => logAndSaveFood(mode === 'ai' ? 'ai' : 'barcode')} disabled={logging} style={{ marginTop: 16, backgroundColor: logging ? '#A8C5A0' : '#7BA876', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>{logging ? 'Saving...' : 'Log + save to My Foods'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

