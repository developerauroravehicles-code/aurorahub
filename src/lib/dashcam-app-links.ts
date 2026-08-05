export const CUSTOMER_PORTAL_QR_PATH = '/branding/customer-handoff-qr.png'
export const IOS_APP_BADGE_PATH = '/branding/ios-app-badge.png'
export const ANDROID_APP_BADGE_PATH = '/branding/android-app-badge.png'

const HIKDASHCAM_ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.hikvision.dashcam.foreign&pcampaignid=web_share'
const HIKDASHCAM_IOS_URL = 'https://apps.apple.com/ca/app/hikdashcam/id1131456475'
const VIIDURE_ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.vidure.app&pcampaignid=web_share'
const VIIDURE_IOS_URL = 'https://apps.apple.com/ca/app/viidure/id1489090807'

export type DashcamAppName = 'HikDashcam' | 'Viidure'

export type DashcamAppLinks = {
  appName: DashcamAppName
  androidUrl: string
  iosUrl: string
}

export function isNovaCamera(model: string | null | undefined): boolean {
  return /nova/i.test(model ?? '')
}

export function resolveDashcamAppLinks(model: string | null | undefined): DashcamAppLinks {
  if (isNovaCamera(model)) {
    return {
      appName: 'HikDashcam',
      androidUrl: HIKDASHCAM_ANDROID_URL,
      iosUrl: HIKDASHCAM_IOS_URL,
    }
  }

  return {
    appName: 'Viidure',
    androidUrl: VIIDURE_ANDROID_URL,
    iosUrl: VIIDURE_IOS_URL,
  }
}
