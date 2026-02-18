/**
 * FCM (Firebase Cloud Messaging) service for push notifications.
 * Requires firebase-admin and credentials (GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messaging: any = null;
let initialized = false;

function getMessaging(): typeof messaging {
  if (initialized) return messaging;
  initialized = true;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
        : undefined;
      if (credential) {
        admin.initializeApp({ credential });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
      } else {
        console.warn('FCM: No Firebase credentials (FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS). Push notifications disabled.');
        messaging = null;
        return null;
      }
    }
    messaging = admin.messaging();
    return messaging;
  } catch (e) {
    console.warn('FCM: Failed to initialize:', e);
    messaging = null;
    return null;
  }
}

export interface SendFcmOptions {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send FCM notification to one or more device tokens.
 * No-op if FCM is not configured or tokens array is empty.
 */
export async function sendFcmToTokens(
  tokens: string[],
  options: SendFcmOptions
): Promise<{ success: number; failure: number }> {
  const m = getMessaging();
  if (!m || !tokens.length) return { success: 0, failure: tokens.length ? tokens.length : 0 };

  const { title, body, data = {} } = options;
  const dataStr: Record<string, string> = { ...data };
  if (title) dataStr.title = title;
  if (body) dataStr.body = body;

  let success = 0;
  let failure = 0;
  for (const token of tokens) {
    try {
      await m.send({
        token,
        notification: { title, body },
        data: dataStr,
        android: { priority: 'high' as const },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      success++;
    } catch (err) {
      console.warn('FCM send failed for token:', token.slice(0, 20) + '...', err);
      failure++;
    }
  }
  return { success, failure };
}
