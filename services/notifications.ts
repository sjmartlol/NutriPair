import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Register for push notifications and save token to Firestore
export async function registerForPushNotifications(uid: string) {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Ask for permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId 
    ?? Constants.easConfig?.projectId;
  
  const token = (await Notifications.getExpoPushTokenAsync({
    projectId,
  })).data;

  // Save token to user's Firestore profile
  await updateDoc(doc(db, 'users', uid), { pushToken: token });

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token;
}

// Get partner's push token from Firestore
export async function getPartnerPushToken(partnerId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', partnerId));
  if (snap.exists()) {
    return snap.data().pushToken || null;
  }
  return null;
}

export async function sendCalorieBankInvite(
  partnerPushToken: string,
  senderName: string,
  targetDay: string
) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: partnerPushToken,
        title: `${senderName} invited you to Calorie Bank`,
        body: `Accept and bank calories together toward ${targetDay}.`,
        sound: 'default',
        data: { type: 'calorie_bank_invite', sender: senderName },
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending challenge invite:', error);
  }
}

export async function sendChallengeInvite(
  partnerPushToken: string,
  senderName: string,
  cheatDay: string
) {
  return sendCalorieBankInvite(partnerPushToken, senderName, cheatDay);
}

// Send a nudge notification via Expo's push service
export async function sendNudgeNotification(
  partnerPushToken: string,
  senderName: string,
  message: string
) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: partnerPushToken,
        title: `${senderName} sent you a nudge! 👋`,
        body: message,
        sound: 'default',
        data: { type: 'nudge', sender: senderName },
      }),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending nudge:', error);
    throw error;
  }
}