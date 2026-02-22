/**
 * Admin Settings API types: profile, notification preferences, send push.
 */

export interface AdminProfile {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

export interface AdminSettingsProfileResponse {
  success: boolean;
  message: string;
  data?: AdminProfile;
  error?: string;
}

export interface AdminUpdateProfileRequest {
  fullName?: string;
  email?: string;
}

export interface AdminUpdateProfilePhotoRequest {
  avatarUrl: string;
}

export interface AdminNotificationSettings {
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

export interface AdminNotificationSettingsResponse {
  success: boolean;
  message: string;
  data?: AdminNotificationSettings;
  error?: string;
}

export interface AdminUpdateNotificationSettingsRequest {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface AdminSendPushRequest {
  title: string;
  message: string;
  sendTo: 'all';
}

export interface AdminSendPushResponse {
  success: boolean;
  message: string;
  data?: { sentCount: number; failureCount: number };
  error?: string;
}
