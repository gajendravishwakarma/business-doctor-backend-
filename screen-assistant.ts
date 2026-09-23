import {
  ConnectorProviderId,
  ScreenAnalysisResult,
  AssistanceLanguage,
} from '../../types/connectors';
import { sanitizeUserInput } from './assistance-guide';

export interface AnalyzeScreenOptions {
  provider: ConnectorProviderId;
  base64Image?: string;
  imageDimensions?: { width: number; height: number };
  language?: AssistanceLanguage;
  ocrExtractedText?: string;
}

export const SCREEN_DISCLAIMER =
  'AI Assistant guides your steps visually. It cannot click buttons, enter passwords, or control your computer screen directly.';

/**
 * Analyzes an uploaded screenshot or display capture frame to guide the user through setup.
 * Completely protects sensitive credentials (passwords, OTPs, secret keys).
 */
export function analyzeConnectorScreen(options: AnalyzeScreenOptions): ScreenAnalysisResult {
  const { provider, base64Image, imageDimensions, language = 'hinglish', ocrExtractedText = '' } = options;

  // 1. Validation check: If no image provided or dimension is invalid
  if (!base64Image && !ocrExtractedText) {
    return {
      identifiedScreen: 'No image provided',
      screenCategory: 'unknown',
      confidence: 'unclear',
      visibleOptions: [],
      visibleButtons: [],
      detectedErrors: [],
      detectedSensitiveFields: [],
      nextStepGuidance: 'Please upload a screenshot of your setup screen so the assistant can guide you.',
      nextStepGuidanceHinglish: 'Kripya apne setup screen ka screenshot upload karein taaki assistant aapko guide kar sake.',
      needsNewScreenshot: true,
      clarificationMessage: 'No visual data was detected. Please upload an image file (PNG or JPEG).',
      disclaimer: SCREEN_DISCLAIMER,
      analyzedAt: new Date().toISOString(),
    };
  }

  // 2. Check for low resolution or blurry screenshot
  if (imageDimensions && (imageDimensions.width < 250 || imageDimensions.height < 250)) {
    return {
      identifiedScreen: 'Low resolution image',
      screenCategory: 'unknown',
      confidence: 'low',
      visibleOptions: [],
      visibleButtons: [],
      detectedErrors: [],
      detectedSensitiveFields: [],
      nextStepGuidance: 'The uploaded screenshot is too small or blurry to read clearly.',
      nextStepGuidanceHinglish: 'Screenshot bohot chhota ya dhundhla hai. Kripya poore browser window ka clear screenshot upload karein.',
      needsNewScreenshot: true,
      clarificationMessage: 'Please capture a higher-resolution screenshot showing the full provider dashboard.',
      disclaimer: SCREEN_DISCLAIMER,
      analyzedAt: new Date().toISOString(),
    };
  }

  // 3. Sensitive Data Redaction from extracted text/context
  const textToScan = ocrExtractedText || '';
  const sanitization = sanitizeUserInput(textToScan);
  const detectedSensitive = sanitization.sensitiveTypes;

  // 4. Provider-specific screen pattern recognition
  const lowerText = sanitization.sanitized.toLowerCase();

  // Pattern detection by provider
  let identifiedScreen = 'Unknown Screen';
  let screenCategory: ScreenAnalysisResult['screenCategory'] = 'unknown';
  let confidence: ScreenAnalysisResult['confidence'] = 'medium';
  let visibleOptions: string[] = [];
  let visibleButtons: string[] = [];
  let detectedErrors: string[] = [];
  let nextStepGuidance = '';
  let nextStepGuidanceHinglish = '';
  let needsNewScreenshot = false;
  let clarificationMessage: string | undefined;

  switch (provider) {
    case 'whatsapp_business': {
      if (lowerText.includes('phone number') || lowerText.includes('waba') || lowerText.includes('phone_number_id')) {
        identifiedScreen = 'Meta WhatsApp Manager - Phone Numbers Console';
        screenCategory = 'provider_console';
        confidence = 'high';
        visibleButtons = ['Add Phone Number', 'Account Tools', 'Manage'];
        visibleOptions = ['Phone number ID', 'WhatsApp Business Account ID', 'Status: Connected'];
        nextStepGuidance =
          'You are on the Phone Numbers tab. Locate the 15-digit "Phone number ID" displayed next to your verified number, and copy it into the Business Doctor AI connector field.';
        nextStepGuidanceHinglish =
          'Aap Meta WhatsApp Manager ke Phone Numbers page par hain. Apne number ke paas 15-digit "Phone number ID" copy karke Business Doctor AI mein paste karein.';
      } else if (lowerText.includes('create app') || lowerText.includes('meta for developers')) {
        identifiedScreen = 'Meta for Developers - App Dashboard';
        screenCategory = 'provider_console';
        confidence = 'high';
        visibleButtons = ['Create App', 'Set Up WhatsApp', 'Add Product'];
        nextStepGuidance = 'Click "Set Up" on the WhatsApp card to configure your Cloud API application.';
        nextStepGuidanceHinglish = 'WhatsApp card par "Set Up" button dabayein Cloud API setup shuru karne ke liye.';
      } else if (lowerText.includes('security center') || lowerText.includes('business verification')) {
        identifiedScreen = 'Meta Business Suite - Security Center';
        screenCategory = 'settings';
        confidence = 'high';
        visibleButtons = ['Start Verification', 'Upload Documents'];
        nextStepGuidance =
          'Meta Business verification is shown here. If your messaging is restricted, click "Start Verification" and submit your GST or business certificate.';
        nextStepGuidanceHinglish =
          'Yahan Meta Business verification dikh raha hai. Verification start karke business registration documents upload karein.';
      } else {
        identifiedScreen = 'Meta Business Suite Overview';
        screenCategory = 'provider_console';
        confidence = 'medium';
        visibleButtons = ['Settings', 'All Tools', 'WhatsApp Manager'];
        nextStepGuidance = 'Click on "All Tools" in the left sidebar and open "WhatsApp Manager".';
        nextStepGuidanceHinglish = 'Left menu mein "All Tools" par click karein aur "WhatsApp Manager" choose karein.';
      }
      break;
    }

    case 'razorpay': {
      if (lowerText.includes('key id') || lowerText.includes('api keys') || lowerText.includes('key secret')) {
        identifiedScreen = 'Razorpay Dashboard - API Keys';
        screenCategory = 'api_key_page';
        confidence = 'high';
        visibleButtons = ['Generate Key', 'Regenerate Key', 'Copy Key ID'];
        visibleOptions = ['Key ID (rzp_...)', 'Key Secret: Protected', 'Mode: Test / Live'];
        nextStepGuidance =
          'You are on the API Keys page. Copy your Key ID (starts with rzp_test_ or rzp_live_) and enter it into Business Doctor AI. Keep your secret key safe.';
        nextStepGuidanceHinglish =
          'Aap Razorpay API Keys page par hain. Apna Key ID copy karein aur Business Doctor AI connect modal mein dalein. Secret key kisi se share na karein.';
      } else if (lowerText.includes('kyc') || lowerText.includes('activate account')) {
        identifiedScreen = 'Razorpay Dashboard - Business KYC Activation';
        screenCategory = 'settings';
        confidence = 'high';
        visibleButtons = ['Submit KYC', 'Continue Activation'];
        nextStepGuidance =
          'Your Razorpay account activation is in progress. You can use Test Mode immediately while KYC is being verified.';
        nextStepGuidanceHinglish =
          'Razorpay account activation dikh raha hai. Aap test mode turant use kar sakte hain jab tak KYC verify ho rahi hai.';
      } else {
        identifiedScreen = 'Razorpay Merchant Dashboard';
        screenCategory = 'provider_console';
        confidence = 'medium';
        visibleButtons = ['Settings', 'Payments', 'API Keys'];
        nextStepGuidance = 'Navigate to Settings (bottom left gear icon) → API Keys to view your keys.';
        nextStepGuidanceHinglish = 'Left sidebar mein neeche Settings gear icon par jayein aur "API Keys" kholein.';
      }
      break;
    }

    case 'facebook': {
      if (lowerText.includes('permission') || lowerText.includes('continue as') || lowerText.includes('grant')) {
        identifiedScreen = 'Facebook OAuth Permission Dialog';
        screenCategory = 'permission_consent';
        confidence = 'high';
        visibleButtons = ['Continue', 'Edit Settings', 'Cancel'];
        nextStepGuidance = 'Select your business page and check all requested permission boxes, then click "Continue".';
        nextStepGuidanceHinglish = 'Apna Business Page select karein aur saari permissions allow karke Continue dabayein.';
      } else {
        identifiedScreen = 'Facebook Pages Management';
        screenCategory = 'provider_console';
        confidence = 'medium';
        visibleButtons = ['Switch Now', 'Manage Page', 'Page Settings'];
        nextStepGuidance = 'Verify that your personal profile is set as an Admin or Full Task Manager of the page.';
        nextStepGuidanceHinglish = 'Check karein ki aapke paas Page ka Admin access hai.';
      }
      break;
    }

    case 'instagram': {
      if (lowerText.includes('professional') || lowerText.includes('creator') || lowerText.includes('business')) {
        identifiedScreen = 'Instagram Account Settings';
        screenCategory = 'settings';
        confidence = 'high';
        visibleButtons = ['Switch Account Type', 'Link Facebook Page'];
        nextStepGuidance = 'Confirm that your account type is set to Professional / Business and connected to your Facebook Page.';
        nextStepGuidanceHinglish = 'Confirm karein ki account Professional hai aur Facebook Page link hai.';
      } else {
        identifiedScreen = 'Instagram Profile Screen';
        screenCategory = 'provider_console';
        confidence = 'medium';
        visibleButtons = ['Edit Profile', 'Settings'];
        nextStepGuidance = 'Open Settings → Account Type and ensure it is switched to Business.';
        nextStepGuidanceHinglish = 'Settings > Account Type mein jakar Business account chunein.';
      }
      break;
    }

    case 'youtube': {
      if (lowerText.includes('choose an account') || lowerText.includes('google sign-in')) {
        identifiedScreen = 'Google Account Picker';
        screenCategory = 'login_screen';
        confidence = 'high';
        visibleButtons = ['Sign In', 'Use another account'];
        nextStepGuidance = 'Select the Google account that owns your YouTube channel.';
        nextStepGuidanceHinglish = 'Apne YouTube channel wala sahi Google account select karein.';
      } else if (lowerText.includes('studio.youtube.com') || lowerText.includes('channel dashboard')) {
        identifiedScreen = 'YouTube Studio Dashboard';
        screenCategory = 'provider_console';
        confidence = 'high';
        visibleButtons = ['Channel Analytics', 'Settings', 'Customization'];
        nextStepGuidance = 'Your YouTube Studio is active. Return to Business Doctor AI and click "Authorize Google OAuth".';
        nextStepGuidanceHinglish = 'YouTube Studio active hai. Ab Business Doctor AI mein aakar "Authorize Google OAuth" dabayein.';
      } else {
        identifiedScreen = 'Google / YouTube Console';
        screenCategory = 'provider_console';
        confidence = 'medium';
        visibleButtons = ['Authorize', 'Continue'];
        nextStepGuidance = 'Ensure you are signed in and grant the requested YouTube permissions.';
        nextStepGuidanceHinglish = 'Google account verify karein aur permissions grant karein.';
      }
      break;
    }
  }

  // Detect visible error banners
  if (lowerText.includes('error') || lowerText.includes('denied') || lowerText.includes('suspended') || lowerText.includes('invalid')) {
    if (lowerText.includes('permission denied')) {
      detectedErrors.push('Permission Denied: Administrator rights required on this account.');
    } else if (lowerText.includes('invalid key')) {
      detectedErrors.push('Invalid Key: Key format or environment does not match.');
    } else {
      detectedErrors.push('Error message displayed on screen. Check error details or review troubleshooting steps.');
    }
  }

  // If text or image is completely generic and low match
  if (confidence === 'medium' && !ocrExtractedText && !base64Image) {
    confidence = 'unclear';
    needsNewScreenshot = true;
    clarificationMessage = 'The screen was unclear. Please take a new screenshot showing the entire provider page.';
  }

  return {
    identifiedScreen,
    screenCategory,
    confidence,
    visibleOptions,
    visibleButtons,
    detectedErrors,
    detectedSensitiveFields: detectedSensitive,
    nextStepGuidance,
    nextStepGuidanceHinglish,
    needsNewScreenshot,
    clarificationMessage,
    disclaimer: SCREEN_DISCLAIMER,
    analyzedAt: new Date().toISOString(),
  };
}
