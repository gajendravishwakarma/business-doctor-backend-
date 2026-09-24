import {
  ConnectorProviderId,
  AssistanceStep,
  TroubleshootingSymptom,
  AssistanceLanguage,
  AssistanceAccountStatus,
} from '../../types/connectors';

// -----------------------------------------------------------------------------
// SENSITIVE DATA DETECTION & REDACTION GUARDRAILS
// -----------------------------------------------------------------------------

export interface SanitizationResult {
  sanitized: string;
  hasSensitive: boolean;
  sensitiveTypes: string[];
}

const SENSITIVE_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  // OTP patterns (e.g., "otp is 123456", "code 492019", standalone 4-8 digits near keywords)
  {
    type: 'OTP / Verification Code',
    regex: /(?:otp|code|pin|verification)\s*(?:is|:|=|-)?\s*([0-9]{4,8})\b/gi,
  },
  // Razorpay or Stripe Secret Keys (e.g., rzp_live_secret_xyz, sk_live_xyz)
  {
    type: 'API Secret / Private Key',
    regex: /(?:rzp_(?:test|live)_[a-zA-Z0-9]{14,28}|sk_(?:test|live)_[a-zA-Z0-9]{20,40}|key_secret\s*[:=]\s*[a-zA-Z0-9_]{16,40})/gi,
  },
  // Passwords (e.g., password=XYZ, pwd: ABC, password is ABC)
  {
    type: 'Password / Passphrase',
    regex: /(?:password|passphrase|secret|passwd|pwd)\s*(?:is|:|=|-)?\s*([^\s,;]+)/gi,
  },
  // Access Tokens & Bearer Tokens
  {
    type: 'OAuth / Bearer Token',
    regex: /(?:bearer\s+[a-zA-Z0-9_\-\.]{25,}|EAAG[a-zA-Z0-9]{30,}|ya29\.[a-zA-Z0-9_\-]{30,})/gi,
  },
  // Payment card numbers (13-19 digits with spaces or dashes)
  {
    type: 'Credit / Debit Card Number',
    regex: /\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{15,16}\b/g,
  },
];

/**
 * Sanitizes user messages and inputs, redacting any sensitive data.
 * Zero passwords, OTPs, or API secrets will ever be logged or stored.
 */
export function sanitizeUserInput(input: string): SanitizationResult {
  if (!input) {
    return { sanitized: '', hasSensitive: false, sensitiveTypes: [] };
  }

  let sanitized = input;
  const detectedTypes = new Set<string>();

  for (const { type, regex } of SENSITIVE_PATTERNS) {
    if (regex.test(sanitized)) {
      detectedTypes.add(type);
      sanitized = sanitized.replace(regex, `[PROTECTED_${type.toUpperCase().replace(/[^A-Z]/g, '_')}]`);
    }
  }

  return {
    sanitized,
    hasSensitive: detectedTypes.size > 0,
    sensitiveTypes: Array.from(detectedTypes),
  };
}

// -----------------------------------------------------------------------------
// PROVIDER SPECIFIC ASSISTANCE GUIDES
// -----------------------------------------------------------------------------

export interface ProviderAssistanceGuide {
  providerId: ConnectorProviderId;
  providerName: string;
  accountCreation: {
    whyRequired: { en: string; hi: string; hinglish: string };
    officialUrl: string;
    prerequisites: string[];
    steps: Array<{ en: string; hi: string; hinglish: string }>;
  };
  existingAccount: {
    directUrl: string;
    whereToGo: { en: string; hi: string; hinglish: string };
  };
  steps: AssistanceStep[];
  symptoms: TroubleshootingSymptom[];
}

export const PROVIDER_ASSISTANCE_GUIDES: Record<ConnectorProviderId, ProviderAssistanceGuide> = {
  whatsapp_business: {
    providerId: 'whatsapp_business',
    providerName: 'WhatsApp Cloud API',
    accountCreation: {
      whyRequired: {
        en: 'Meta requires a registered WhatsApp Business Account (WABA) with a dedicated phone number to send official notifications and receive customer chats.',
        hi: 'Meta को आधिकारिक नोटिफिकेशन भेजने और ग्राहकों के मैसेज प्राप्त करने के लिए एक पंजीकृत WhatsApp Business Account (WABA) और फ़ोन नंबर की आवश्यकता होती है।',
        hinglish: 'Customer chats handle karne aur official automated messages bhejne ke liye Meta ka official WhatsApp Business Account (WABA) aur ek clean phone number hona zaroori hai.',
      },
      officialUrl: 'https://business.facebook.com',
      prerequisites: [
        'A phone number NOT currently registered on WhatsApp or WhatsApp Business mobile app',
        'A registered Facebook personal profile to manage the Meta Business Account',
        'Valid business name and official email address',
      ],
      steps: [
        {
          en: '1. Visit business.facebook.com and log in with your Facebook account.',
          hi: '1. business.facebook.com पर जाएं और अपने Facebook अकाउंट से लॉग इन करें।',
          hinglish: '1. business.facebook.com open karein aur apne Facebook account se login karein.',
        },
        {
          en: '2. Click "Create an Account", enter your business name, your name, and official email.',
          hi: '2. "Create an Account" पर क्लिक करें, अपने व्यवसाय का नाम और ईमेल दर्ज करें।',
          hinglish: '2. "Create an Account" par click karke apna Business Name aur official email enter karein.',
        },
        {
          en: '3. Navigate to WhatsApp Accounts > Add WhatsApp Account and follow the phone verification prompt.',
          hi: '3. WhatsApp Accounts > Add WhatsApp Account पर जाएं और फ़ोन सत्यापन पूरा करें।',
          hinglish: '3. WhatsApp Accounts section mein jayein aur apna phone number OTP se verify karein.',
        },
      ],
    },
    existingAccount: {
      directUrl: 'https://business.facebook.com/wa/manage/home/',
      whereToGo: {
        en: 'Go to Meta Business Suite → WhatsApp Manager → Account Tools → Phone Numbers to find your Phone Number ID and WABA ID.',
        hi: 'Meta Business Suite → WhatsApp Manager → Account Tools → Phone Numbers पर जाएं।',
        hinglish: 'Meta Business Suite open karke WhatsApp Manager → Phone Numbers mein jayein, wahan Phone Number ID aur WABA ID milegi.',
      },
    },
    steps: [
      {
        id: 'account_check',
        index: 1,
        title: 'Check WhatsApp & Meta Account',
        titleHinglish: 'WhatsApp & Meta Account Check',
        titleHindi: 'WhatsApp और Meta खाता जांच',
        description: 'Verify if you have a Meta Business Suite account and a dedicated business phone number.',
        descriptionHinglish: 'Check karein ki aapke paas Meta Business Account aur ek dedicated phone number ready hai ya nahi.',
        descriptionHindi: 'जांचें कि क्या आपके पास Meta Business खाता और एक अलग फ़ोन नंबर तैयार है।',
        actionRequired: 'Select whether you already have an account or need to create a new one.',
        actionRequiredHinglish: '"I already have an account" ya "I don\'t have an account" choose karein.',
        officialUrl: 'https://business.facebook.com',
        prerequisites: ['Facebook profile', 'Phone number'],
        estimatedMinutes: 2,
      },
      {
        id: 'console_navigation',
        index: 2,
        title: 'Open WhatsApp Manager Console',
        titleHinglish: 'WhatsApp Manager Console Kholein',
        titleHindi: 'WhatsApp Manager कंसोल खोलें',
        description: 'Navigate to Meta Developer Portal or Meta Business Manager to locate your WhatsApp Cloud API app.',
        descriptionHinglish: 'Meta Business Manager mein WhatsApp section khol kar Phone Number ID dekhein.',
        descriptionHindi: 'Meta Developer Portal या Business Manager में जाकर अपना WhatsApp ऐप देखें।',
        actionRequired: 'Click the official Meta link to access your WhatsApp Manager dashboard.',
        actionRequiredHinglish: 'Neeche diye gaye link par click karke Meta WhatsApp dashboard kholein.',
        officialUrl: 'https://developers.facebook.com/apps',
        estimatedMinutes: 3,
      },
      {
        id: 'authorization',
        index: 3,
        title: 'Authorize Channel & Scopes',
        titleHinglish: 'Permissions & Scopes Authorize Karein',
        titleHindi: 'अनुमतियां और स्कोप अधिकृत करें',
        description: 'Grant required permissions: whatsapp_business_messaging and whatsapp_business_management.',
        descriptionHinglish: 'Business Doctor AI ko messages receive aur reply karne ki zaroori permissions grant karein.',
        descriptionHindi: 'Business Doctor AI को संदेश प्राप्त करने और भेजने की अनुमतियां प्रदान करें।',
        actionRequired: 'Authorize via Meta Embedded Signup or enter your assigned Phone Number ID.',
        actionRequiredHinglish: 'Phone Number ID aur WABA ID enter karein ya Embedded Signup complete karein.',
        estimatedMinutes: 2,
      },
      {
        id: 'verification',
        index: 4,
        title: 'Verify & Test Connection',
        titleHinglish: 'Connection Verify & Test Karein',
        titleHindi: 'कनेक्शन सत्यापित और परीक्षण करें',
        description: 'Send an automated handshake test to ensure WhatsApp messages are received and processed.',
        descriptionHinglish: 'Ek automated test ping send karke confirm karein ki messages safely deliver ho rahe hain.',
        descriptionHindi: 'स्वचालित परीक्षण संदेश भेजकर पुष्टि करें कि कनेक्शन ठीक से काम कर रहा है।',
        actionRequired: 'Click "Verify Connection" to perform an end-to-end health probe.',
        actionRequiredHinglish: '"Verify Connection" button dabayein live health check ke liye.',
        estimatedMinutes: 1,
      },
    ],
    symptoms: [
      {
        id: 'phone_already_registered',
        title: 'Phone Number Already in Use on Regular WhatsApp',
        titleHinglish: 'Phone number pehle se personal WhatsApp par active hai',
        description: 'Meta rejects numbers that are currently bound to a personal WhatsApp mobile app.',
        descriptionHinglish: 'Agar yeh number abhi personal ya business mobile app par active hai, toh Meta Cloud API use nahi karne dega.',
        possibleCauses: [
          'The number is currently logged into the WhatsApp mobile app',
          'Account deletion from mobile app is pending',
        ],
        resolutionSteps: [
          'Open WhatsApp on your mobile phone → Settings → Account → Delete My Account.',
          'Wait 5 minutes for Meta servers to register the deletion.',
          'Re-attempt connecting the number in Meta WhatsApp Manager.',
        ],
        resolutionStepsHinglish: [
          'Phone mein WhatsApp app khol kar: Settings > Account > Delete Account karein.',
          '5 minute ruk kar dobara Business Doctor AI mein connection retry karein.',
        ],
      },
      {
        id: 'waba_not_verified',
        title: 'Meta Business Verification Pending or Restricted',
        titleHinglish: 'Meta Business Verification pending hai',
        description: 'Meta limits messaging volume or restricts unverified business managers.',
        descriptionHinglish: 'Meta Business Suite mein company ki verification pending hone par messages limit ho sakte hain.',
        possibleCauses: ['Business documents not submitted in Meta Security Center'],
        resolutionSteps: [
          'Go to Meta Business Settings > Security Center.',
          'Click Start Verification and upload business registration documents (GST / Incorporation).',
        ],
        resolutionStepsHinglish: [
          'Meta Business Settings > Security Center mein jayein aur verification complete karein.',
        ],
      },
    ],
  },

  facebook: {
    providerId: 'facebook',
    providerName: 'Facebook Pages',
    accountCreation: {
      whyRequired: {
        en: 'A Facebook Page is required for your brand to publish updates, receive customer inquiries, and run ad campaigns.',
        hi: 'आपके ब्रांड के लिए अपडेट पोस्ट करने, ग्राहकों के सवाल प्राप्त करने और विज्ञापन चलाने के लिए एक Facebook Page की आवश्यकता होती है।',
        hinglish: 'Aapke business ke liye updates post karne aur Facebook Messenger se leads capture karne ke liye Facebook Page hona zaroori hai.',
      },
      officialUrl: 'https://www.facebook.com/pages/create',
      prerequisites: ['A personal Facebook account'],
      steps: [
        {
          en: '1. Visit facebook.com/pages/create.',
          hi: '1. facebook.com/pages/create पर जाएं।',
          hinglish: '1. facebook.com/pages/create link open karein.',
        },
        {
          en: '2. Enter your business name, select your category, and write a short bio.',
          hi: '2. अपने व्यवसाय का नाम दर्ज करें और श्रेणी चुनें।',
          hinglish: '2. Apna Page Name, Category aur Bio fill karein.',
        },
        {
          en: '3. Click Create Page and add profile & cover photos.',
          hi: '3. Create Page पर क्लिक करें।',
          hinglish: '3. Create Page dabayein aur apna logo upload karein.',
        },
      ],
    },
    existingAccount: {
      directUrl: 'https://www.facebook.com/pages/?category=your_pages',
      whereToGo: {
        en: 'Go to Facebook → Pages to see your managed business pages.',
        hi: 'Facebook → Pages पर जाकर अपने प्रबंधित पेज देखें।',
        hinglish: 'Facebook par Pages section mein jakar check karein aapka Page Admin access ready hai.',
      },
    },
    steps: [
      {
        id: 'account_check',
        index: 1,
        title: 'Check Facebook Page Access',
        titleHinglish: 'Facebook Page Access Check Karein',
        titleHindi: 'Facebook पेज एक्सेस जांचें',
        description: 'Ensure you have Admin or Full Control access to your company Facebook Page.',
        descriptionHinglish: 'Confirm karein ki aapke paas Facebook Page ka Admin ya Full Control access hai.',
        descriptionHindi: 'सुनिश्चित करें कि आपके पास कंपनी के Facebook पेज का एडमिन एक्सेस है।',
        actionRequired: 'Verify page ownership before continuing.',
        actionRequiredHinglish: 'Page ownership verify karein.',
        officialUrl: 'https://www.facebook.com/pages',
        estimatedMinutes: 1,
      },
      {
        id: 'console_navigation',
        index: 2,
        title: 'Select Pages to Connect',
        titleHinglish: 'Connect Karne Wala Page Chunein',
        titleHindi: 'कनेक्ट करने के लिए पेज चुनें',
        description: 'Choose which Facebook business page should sync with Business Doctor AI.',
        descriptionHinglish: 'Apna primary business page choose karein jiske messages aur posts sync hone hain.',
        descriptionHindi: 'चुनें कि कौन सा पेज सिंक होना चाहिए।',
        actionRequired: 'Select your business page from the list.',
        actionRequiredHinglish: 'List se apna Facebook page select karein.',
        estimatedMinutes: 1,
      },
      {
        id: 'authorization',
        index: 3,
        title: 'Grant Permissions',
        titleHinglish: 'Permissions Grant Karein',
        titleHindi: 'अनुमतियां प्रदान करें',
        description: 'Authorize pages_show_list, pages_read_engagement, and pages_manage_posts.',
        descriptionHinglish: 'Posts publish karne aur customer messages padhne ki permissions allow karein.',
        descriptionHindi: 'पेज प्रबंधन और मैसेजिंग अनुमतियां दें।',
        actionRequired: 'Click Continue in Meta dialog.',
        actionRequiredHinglish: 'Meta popup mein "Continue" aur "Allow" click karein.',
        estimatedMinutes: 2,
      },
      {
        id: 'verification',
        index: 4,
        title: 'Verify Sync',
        titleHinglish: 'Page Sync Verify Karein',
        titleHindi: 'पेज सिंक सत्यापित करें',
        description: 'Verify page token validity and webhook event subscription.',
        descriptionHinglish: 'Verify karein ki page connection active aur live hai.',
        descriptionHindi: 'सत्यापित करें कि पेज सफलतापूर्वक जुड़ा हुआ है।',
        actionRequired: 'Click Verify Connection.',
        actionRequiredHinglish: 'Verify button dabayein.',
        estimatedMinutes: 1,
      },
    ],
    symptoms: [
      {
        id: 'page_permission_denied',
        title: 'Missing Page Admin Permission',
        titleHinglish: 'Facebook Page ka Admin access nahi mila',
        description: 'Only users with Admin or Full Task Control can connect pages to third-party apps.',
        descriptionHinglish: 'Keval Page Admin hi app connect kar sakte hain.',
        possibleCauses: ['Logged into personal account with only Editor or Viewer access'],
        resolutionSteps: [
          'Ask the primary Page Owner to grant you Admin or Full Control access in Page Settings > Page Access.',
          'Retry connecting in Business Doctor AI.',
        ],
        resolutionStepsHinglish: [
          'Page Settings > Page Access mein jakar apne account ko Admin access dilwayein.',
        ],
      },
      {
        id: 'two_factor_auth_required',
        title: 'Two-Factor Authentication Required by Meta',
        titleHinglish: 'Meta Business Manager mein 2FA compulsory hai',
        description: 'Meta requires two-factor authentication on personal Facebook accounts managing business assets.',
        descriptionHinglish: 'Security policy ke tahat Meta admin accounts ke liye 2-step verification mangta hai.',
        possibleCauses: ['2FA not enabled on personal Facebook account'],
        resolutionSteps: [
          'Open Facebook → Settings & Privacy → Password and Security → Two-Factor Authentication.',
          'Enable authentication via SMS or Authenticator App and retry.',
        ],
        resolutionStepsHinglish: [
          'Facebook Settings > Password and Security mein jakar 2-Factor Authentication on karein.',
        ],
      },
    ],
  },

  instagram: {
    providerId: 'instagram',
    providerName: 'Instagram for Business',
    accountCreation: {
      whyRequired: {
        en: 'A Professional (Business or Creator) Instagram account linked to a Facebook Page is required by Meta Graph API.',
        hi: 'Meta Graph API के लिए Facebook पेज से जुड़े प्रोफेशनल (Business/Creator) Instagram खाते की आवश्यकता होती है।',
        hinglish: 'Instagram DMs aur posts manage karne ke liye aapka account Professional (Business ya Creator) hona zaroori hai aur Facebook Page se link hona chahiye.',
      },
      officialUrl: 'https://help.instagram.com/502981923235522',
      prerequisites: [
        'An Instagram account',
        'Switch to Professional Account (Free in Instagram mobile app)',
        'Link to your Facebook Page',
      ],
      steps: [
        {
          en: '1. In Instagram mobile app: Go to Profile → Menu (☰) → Settings → Account type and tools.',
          hi: '1. Instagram ऐप में: Profile → Menu → Settings → Account type पर जाएं।',
          hinglish: '1. Instagram app kholein: Profile > Settings > Account Type par jayein.',
        },
        {
          en: '2. Tap "Switch to Professional Account" and choose "Business".',
          hi: '2. "Switch to Professional Account" पर टैप करें और Business चुनें।',
          hinglish: '2. "Switch to Professional Account" chunein aur Business category select karein.',
        },
        {
          en: '3. Under Profile Settings → Public Business Information → Page: Connect your Facebook Page.',
          hi: '3. अपने Facebook पेज से कनेक्ट करें।',
          hinglish: '3. Apne Instagram account ko apne Facebook Page se link karein.',
        },
      ],
    },
    existingAccount: {
      directUrl: 'https://www.instagram.com/accounts/edit/',
      whereToGo: {
        en: 'Verify your account is set to Business in Instagram Profile Settings.',
        hi: 'Instagram प्रोफाइल सेटिंग्स में जांचें कि आपका खाता Business है।',
        hinglish: 'Instagram profile settings mein check karein ki account type Business/Creator hai.',
      },
    },
    steps: [
      {
        id: 'account_check',
        index: 1,
        title: 'Check Professional Account & FB Link',
        titleHinglish: 'Professional Account & FB Link Check Karein',
        titleHindi: 'प्रोफेशनल खाता और फेसबुक लिंक जांचें',
        description: 'Verify your Instagram is a Professional account and connected to your Facebook Page.',
        descriptionHinglish: 'Confirm karein ki aapka account Professional hai aur Facebook Page se connected hai.',
        descriptionHindi: 'जांचें कि खाता प्रोफेशनल है और फेसबुक पेज से जुड़ा हुआ है।',
        actionRequired: 'Confirm professional account status.',
        actionRequiredHinglish: 'Account status confirm karein.',
        officialUrl: 'https://www.instagram.com',
        estimatedMinutes: 2,
      },
      {
        id: 'console_navigation',
        index: 2,
        title: 'Authorize Meta Permissions',
        titleHinglish: 'Meta Permissions Authorize Karein',
        titleHindi: 'मेटा अनुमतियां अधिकृत करें',
        description: 'Allow instagram_basic and instagram_manage_messages permissions.',
        descriptionHinglish: 'Instagram DMs aur insights access karne ki permission grant karein.',
        descriptionHindi: 'मैसेजिंग और एनालिटिक्स अनुमतियां प्रदान करें।',
        actionRequired: 'Click Authorize in Meta dialog.',
        actionRequiredHinglish: 'Authorize button dabayein.',
        estimatedMinutes: 2,
      },
      {
        id: 'verification',
        index: 3,
        title: 'Verify Connection',
        titleHinglish: 'Connection Verify Karein',
        titleHindi: 'कनेक्शन सत्यापित करें',
        description: 'Check webhook subscriptions and message capabilities.',
        descriptionHinglish: 'Test karein ki DMs safely sync ho rahe hain.',
        descriptionHindi: 'जांचें कि मैसेजिंग सिंक काम कर रहा है।',
        actionRequired: 'Click Verify Connection.',
        actionRequiredHinglish: 'Verify button click karein.',
        estimatedMinutes: 1,
      },
    ],
    symptoms: [
      {
        id: 'personal_account_error',
        title: 'Account is Personal (Not Professional)',
        titleHinglish: 'Instagram account abhi personal hai, business nahi',
        description: 'Personal Instagram accounts cannot connect to Meta Graph API.',
        descriptionHinglish: 'Personal accounts par Meta API support nahi karta.',
        possibleCauses: ['Account has not been switched to Professional/Business'],
        resolutionSteps: [
          'Open Instagram on your phone → Settings → Account Type → Switch to Professional Account.',
          'Connect your Facebook Page.',
          'Retry connecting in Business Doctor AI.',
        ],
        resolutionStepsHinglish: [
          'Instagram mobile app khol kar: Settings > Switch to Professional Account karein.',
        ],
      },
      {
        id: 'fb_page_not_linked',
        title: 'Instagram Account Not Linked to Facebook Page',
        titleHinglish: 'Instagram account Facebook Page se juda hua nahi hai',
        description: 'Meta Graph API requires your Professional Instagram account to be attached to a published Facebook Page.',
        descriptionHinglish: 'Instagram messages read karne ke liye aapka account Facebook Page se connected hona zaroori hai.',
        possibleCauses: ['Instagram and Facebook accounts were disconnected or created separately'],
        resolutionSteps: [
          'Open Facebook Page Settings → Linked Accounts → Instagram.',
          'Click Connect Account and authorize login.',
          'Return to Business Doctor AI and click Retry.',
        ],
        resolutionStepsHinglish: [
          'Facebook Page Settings > Linked Accounts > Instagram par jakar "Connect" karein.',
        ],
      },
    ],
  },

  youtube: {
    providerId: 'youtube',
    providerName: 'YouTube Studio',
    accountCreation: {
      whyRequired: {
        en: 'A YouTube channel is required to track video performance, view analytics, and publish customer updates.',
        hi: 'वीडियो प्रदर्शन ट्रैक करने और एनालिटिक्स देखने के लिए YouTube चैनल की आवश्यकता होती है।',
        hinglish: 'Video analytics dekhne aur marketing content publish karne ke liye YouTube Channel hona zaroori hai.',
      },
      officialUrl: 'https://studio.youtube.com',
      prerequisites: ['A Google / Gmail account'],
      steps: [
        {
          en: '1. Visit studio.youtube.com and sign in with your Google account.',
          hi: '1. studio.youtube.com पर जाएं और Google खाते से साइन इन करें।',
          hinglish: '1. studio.youtube.com open karke apne Google account se sign in karein.',
        },
        {
          en: '2. Follow the prompt to create a channel for your business name.',
          hi: '2. अपने व्यवसाय के नाम से चैनल बनाएं।',
          hinglish: '2. Apne business name ke sath channel create karein.',
        },
      ],
    },
    existingAccount: {
      directUrl: 'https://studio.youtube.com',
      whereToGo: {
        en: 'Check your YouTube Studio dashboard for channel status and upload rights.',
        hi: 'चैनल स्थिति के लिए YouTube Studio डैशबोर्ड देखें।',
        hinglish: 'YouTube Studio dashboard par jakar channel check karein.',
      },
    },
    steps: [
      {
        id: 'account_check',
        index: 1,
        title: 'Check Google / YouTube Account',
        titleHinglish: 'Google / YouTube Account Check Karein',
        titleHindi: 'Google / YouTube खाता जांचें',
        description: 'Ensure you are signed into the Google Account that owns your company YouTube channel.',
        descriptionHinglish: 'Confirm karein ki aap us Google account se signed in hain jisme YouTube channel hai.',
        descriptionHindi: 'सुनिश्चित करें कि आप सही Google खाते में लॉग इन हैं।',
        actionRequired: 'Confirm Google account login.',
        actionRequiredHinglish: 'Google login confirm karein.',
        officialUrl: 'https://studio.youtube.com',
        estimatedMinutes: 1,
      },
      {
        id: 'authorization',
        index: 2,
        title: 'Authorize Google OAuth',
        titleHinglish: 'Google OAuth Authorize Karein',
        titleHindi: 'Google OAuth अधिकृत करें',
        description: 'Grant read-only or management scopes for YouTube Data API v3 and YouTube Analytics.',
        descriptionHinglish: 'YouTube Analytics aur channel insights dekhne ki permission approve karein.',
        descriptionHindi: 'चैनल एनालिटिक्स देखने की अनुमति दें।',
        actionRequired: 'Consent to requested YouTube scopes.',
        actionRequiredHinglish: 'Google consent screen par Allow click karein.',
        estimatedMinutes: 2,
      },
      {
        id: 'verification',
        index: 3,
        title: 'Verify Channel Sync',
        titleHinglish: 'Channel Sync Verify Karein',
        titleHindi: 'चैनल सिंक सत्यापित करें',
        description: 'Verify subscriber count, channel name, and video sync status.',
        descriptionHinglish: 'Confirm karein ki channel details safely sync ho gayi hain.',
        descriptionHindi: 'चैनल विवरण सिंक सत्यापित करें।',
        actionRequired: 'Click Verify Connection.',
        actionRequiredHinglish: 'Verify button dabayein.',
        estimatedMinutes: 1,
      },
    ],
    symptoms: [
      {
        id: 'wrong_google_account',
        title: 'Selected Wrong Google Account or Brand Account',
        titleHinglish: 'Galat Google account ya Brand account select ho gaya',
        description: 'If you have multiple channels or brand accounts, ensure you pick the correct one in Google OAuth.',
        descriptionHinglish: 'Google prompt mein sahi Brand Account select karein.',
        possibleCauses: ['Multiple Google logins in the same browser'],
        resolutionSteps: [
          'Log out or open an incognito window, sign into the channel owner Google account.',
          'Retry connecting in Business Doctor AI.',
        ],
        resolutionStepsHinglish: [
          'Incognito window mein sahi Google account se login karke retry karein.',
        ],
      },
      {
        id: 'channel_not_found',
        title: 'No Active YouTube Channel Under Google Account',
        titleHinglish: 'Is Google account ke andar koi YouTube channel nahi bana hai',
        description: 'The selected Google account has an email login but no public or brand YouTube channel.',
        descriptionHinglish: 'Aapne jo email select kiya hai uspar abhi koi YouTube channel exist nahi karta.',
        possibleCauses: ['Selected personal Google account rather than business brand YouTube account'],
        resolutionSteps: [
          'Visit studio.youtube.com and create a channel for your business.',
          'Or switch to the Google account that manages your existing YouTube channel.',
        ],
        resolutionStepsHinglish: [
          'studio.youtube.com par jakar channel banayein ya sahi Google account select karein.',
        ],
      },
    ],
  },

  razorpay: {
    providerId: 'razorpay',
    providerName: 'Razorpay Payments',
    accountCreation: {
      whyRequired: {
        en: 'A Razorpay Merchant Account is required to accept UPI, Cards, NetBanking, and auto-track payments and refunds in INR.',
        hi: 'UPI, कार्ड, नेटबैंकिंग स्वीकार करने और भुगतानों को ट्रैक करने के लिए एक Razorpay मर्चेंट खाते की आवश्यकता होती है।',
        hinglish: 'Customers se UPI, Cards, aur NetBanking payments receive karne ke liye aur unhe auto-track karne ke liye Razorpay Merchant account zaroori hai.',
      },
      officialUrl: 'https://dashboard.razorpay.com/signup',
      prerequisites: [
        'Business PAN or Individual PAN',
        'Bank Account details (Account number & IFSC) for daily settlements',
        'GSTIN (optional for unregistered business, required if GST registered)',
      ],
      steps: [
        {
          en: '1. Visit dashboard.razorpay.com/signup and enter your mobile and business email.',
          hi: '1. dashboard.razorpay.com/signup पर जाएं और मोबाइल और ईमेल दर्ज करें।',
          hinglish: '1. dashboard.razorpay.com/signup par jakar mobile number aur business email enter karein.',
        },
        {
          en: '2. Fill your business details, PAN, and bank account for automated payouts.',
          hi: '2. अपने व्यवसाय का विवरण, पैन और बैंक खाता दर्ज करें।',
          hinglish: '2. Business details, PAN aur Bank account details enter karein.',
        },
        {
          en: '3. Complete KYC submission for live payments. You can start testing immediately in Test Mode.',
          hi: '3. टेस्ट मोड तुरंत शुरू करें और लाइव पेमेंट्स के लिए केवाईसी जमा करें।',
          hinglish: '3. Test Mode turant chalu ho jata hai, live payments ke liye KYC submit karein.',
        },
      ],
    },
    existingAccount: {
      directUrl: 'https://dashboard.razorpay.com/app/keys',
      whereToGo: {
        en: 'Go to Razorpay Dashboard → Settings (gear icon) → API Keys to view or generate your Key ID and Key Secret.',
        hi: 'Razorpay Dashboard → Settings → API Keys पर जाकर अपनी Key ID और Secret देखें।',
        hinglish: 'Razorpay Dashboard khol kar: Settings (gear icon) > API Keys mein jayein, wahan "Generate Key" dabayein.',
      },
    },
    steps: [
      {
        id: 'account_check',
        index: 1,
        title: 'Check Razorpay Account & Mode',
        titleHinglish: 'Razorpay Account & Mode Check Karein',
        titleHindi: 'Razorpay खाता और मोड जांचें',
        description: 'Decide whether you want to connect in Test Mode (Sandbox) or Live Mode.',
        descriptionHinglish: 'Tay karein ki aap Test Mode (Testing ke liye) ya Live Mode (Asli payments ke liye) connect karna chahte hain.',
        descriptionHindi: 'तय करें कि क्या आप टेस्ट मोड या लाइव मोड कनेक्ट करना चाहते हैं।',
        actionRequired: 'Select mode and confirm account readiness.',
        actionRequiredHinglish: 'Test Mode ya Live Mode chunein.',
        officialUrl: 'https://dashboard.razorpay.com',
        estimatedMinutes: 1,
      },
      {
        id: 'console_navigation',
        index: 2,
        title: 'Locate API Keys in Dashboard',
        titleHinglish: 'Razorpay Dashboard mein API Keys Dhundein',
        titleHindi: 'डैशबोर्ड में एपीआई कुंजियाँ खोजें',
        description: 'Navigate to Settings → API Keys. Click "Generate Test Key" (or Live Key).',
        descriptionHinglish: 'Razorpay Dashboard mein Settings > API Keys section kholein aur Key generate karein.',
        descriptionHindi: 'सेटिंग्स > एपीआई कुंजियों में जाकर अपनी कुंजी उत्पन्न करें।',
        actionRequired: 'Copy your Key ID and Key Secret safely.',
        actionRequiredHinglish: 'Apna Key ID copy karein.',
        officialUrl: 'https://dashboard.razorpay.com/app/keys',
        estimatedMinutes: 2,
      },
      {
        id: 'authorization',
        index: 3,
        title: 'Enter Key ID & Secret',
        titleHinglish: 'Key ID & Secret Securely Enter Karein',
        titleHindi: 'Key ID और Secret सुरक्षित रूप से दर्ज करें',
        description: 'Input your Key ID and Secret. Credentials are saved encrypted on the server, never stored in plain browser storage.',
        descriptionHinglish: 'Apna Key ID aur Secret enter karein. Yeh encrypted server par save hota hai, browser mein plain-text kabhi nahi rehta.',
        descriptionHindi: 'अपनी कुंजी दर्ज करें। यह सुरक्षित रूप से एन्क्रिप्ट की जाती है।',
        actionRequired: 'Submit your credentials in the secure connection modal.',
        actionRequiredHinglish: 'Connect modal mein Key ID enter karein.',
        estimatedMinutes: 2,
      },
      {
        id: 'verification',
        index: 4,
        title: 'Test Balance & Order Ping',
        titleHinglish: 'Balance & Payment Ping Test Karein',
        titleHindi: 'भुगतान पिंग का परीक्षण करें',
        description: 'Perform a test ping to verify that credentials are valid and account is active.',
        descriptionHinglish: 'Ek automated ping karke check karein ki Razorpay connection successfully active ho gaya hai.',
        descriptionHindi: 'सत्यापित करें कि खाता सक्रिय है।',
        actionRequired: 'Click Verify Connection.',
        actionRequiredHinglish: 'Verify button dabayein.',
        estimatedMinutes: 1,
      },
    ],
    symptoms: [
      {
        id: 'invalid_key_error',
        title: 'Invalid Key ID or Key Secret Error',
        titleHinglish: 'Key ID ya Key Secret invalid / galat bata raha hai',
        description: 'Key ID and Secret must match the environment (Test vs Live).',
        descriptionHinglish: 'Agar aapne Test mode choose kiya hai toh Key ID "rzp_test_" se start honi chahiye. Live ke liye "rzp_live_".',
        possibleCauses: [
          'Using a Live key with Test Mode toggle enabled, or vice versa',
          'Key was rolled or regenerated in Razorpay dashboard',
          'Typo during copy-paste (leading or trailing spaces)',
        ],
        resolutionSteps: [
          'Ensure Test Key (starts with rzp_test_) is used for Sandbox, and Live Key (starts with rzp_live_) for Live.',
          'Re-copy both Key ID and Secret from dashboard.razorpay.com/app/keys without extra spaces.',
        ],
        resolutionStepsHinglish: [
          'Check karein: Test mode ke liye Key ID "rzp_test_" se shuru honi chahiye. Space bina copy karein.',
        ],
      },
      {
        id: 'kyc_pending',
        title: 'Razorpay Live Payments Suspended / KYC Incomplete',
        titleHinglish: 'Razorpay Live Payments KYC pending hone ke karan band hain',
        description: 'Razorpay requires business document verification before settling live money.',
        descriptionHinglish: 'Razorpay par KYC complete kiye bina live money transfer nahi hota.',
        possibleCauses: ['KYC documents pending or under review'],
        resolutionSteps: [
          'Log in to Razorpay Dashboard and look for the yellow KYC banner on top.',
          'Submit business bank statement or registration proof.',
        ],
        resolutionStepsHinglish: [
          'Razorpay dashboard khol kar yellow KYC banner par click karke documents submit karein.',
        ],
      },
    ],
  },
};

/**
 * Returns contextual advice for "What do I do now?" based on current step and account status
 */
export function getWhatDoINowAdvice(
  provider: ConnectorProviderId,
  stepId: string,
  accountStatus: AssistanceAccountStatus,
  language: AssistanceLanguage = 'hinglish'
): string {
  const guide = PROVIDER_ASSISTANCE_GUIDES[provider];
  if (!guide) {
    return language === 'hi'
      ? 'कृपया स्क्रीन पर दिए गए निर्देशों का पालन करें।'
      : language === 'hinglish'
      ? 'Screen par diye gaye instructions ko follow karein aur details fill karein.'
      : 'Please follow the on-screen instructions to proceed.';
  }

  if (accountStatus === 'needs_account') {
    if (language === 'hi') {
      return `आपको सबसे पहले ${guide.providerName} पर खाता बनाना होगा। आधिकारिक लिंक: ${guide.accountCreation.officialUrl} पर जाएं और खाता बनाएं। बनने के बाद यहां वापस आएं।`;
    }
    if (language === 'hinglish') {
      return `Aapko pehle ${guide.providerName} par account banana hoga. Official link: ${guide.accountCreation.officialUrl} par click karein aur account create karein. Phir yahan aakar step continue karein.`;
    }
    return `First, create an account on ${guide.providerName} at ${guide.accountCreation.officialUrl}. Return here once your account is ready.`;
  }

  const currentStep = guide.steps.find((s) => s.id === stepId) || guide.steps[0];

  if (language === 'hi') {
    return `अभी आपको: "${currentStep.titleHindi}" करना है। ${currentStep.descriptionHindi} - ${currentStep.actionRequired}`;
  }
  if (language === 'hinglish') {
    return `Abhi aapko: "${currentStep.titleHinglish}" karna hai. ${currentStep.descriptionHinglish} - ${currentStep.actionRequiredHinglish}`;
  }
  return `Right now, your task is: "${currentStep.title}". ${currentStep.description} - ${currentStep.actionRequired}`;
}

/**
 * Explains common technical error codes in simple everyday language
 */
export function explainErrorInLanguage(
  errorCode: string,
  rawMessage: string,
  language: AssistanceLanguage = 'hinglish'
): { explanation: string; action: string } {
  const normalized = (errorCode || '').toLowerCase();

  if (normalized.includes('token_expired') || normalized.includes('expired')) {
    if (language === 'hi') {
      return {
        explanation: 'आपके खाते का सुरक्षा टोकन समाप्त हो गया है। ऐसा सुरक्षा कारणों से समय-समय पर होता है।',
        action: '"Reconnect" या "Retry" बटन दबाकर दोबारा लॉगिन करें।',
      };
    }
    if (language === 'hinglish') {
      return {
        explanation: 'Aapke provider account ka login token expire ho gaya hai. Security ke liye yeh normal hai.',
        action: '"Reconnect" ya "Retry" button dabayein aur login refresh karein.',
      };
    }
    return {
      explanation: 'Your authorization token has expired for security reasons.',
      action: 'Click "Reconnect" or "Retry" to grant fresh access.',
    };
  }

  if (normalized.includes('permission') || normalized.includes('denied') || normalized.includes('scope')) {
    if (language === 'hi') {
      return {
        explanation: 'सभी आवश्यक अनुमतियां नहीं दी गई थीं। ऐप केवल चुनी हुई अनुमतियों के साथ काम करता है।',
        action: 'दोबारा कनेक्ट करें और अनुमति स्क्रीन पर सभी बॉक्स चेक करें।',
      };
    }
    if (language === 'hinglish') {
      return {
        explanation: 'Saari zaroori permissions allow nahi ki gayi thi. System ko message aur analytics access chahiye hota hai.',
        action: 'Dobara connect karein aur permission dialog mein "Allow all" ya sabhi options select karein.',
      };
    }
    return {
      explanation: 'Required permissions were not granted during authorization.',
      action: 'Click Connect again and make sure to accept all requested permissions.',
    };
  }

  if (normalized.includes('rate_limit')) {
    if (language === 'hi') {
      return {
        explanation: 'प्रदाता कंपनी की तरफ से बहुत सारे अनुरोध एक साथ भेजे जाने के कारण अस्थायी रोक लगी है।',
        action: '2-3 मिनट प्रतीक्षा करें और फिर पुनः प्रयास करें।',
      };
    }
    if (language === 'hinglish') {
      return {
        explanation: 'Provider ki taraf se request limit touch ho gayi hai. Yeh temporary hota hai.',
        action: '2-3 minute ruk kar dubara try karein.',
      };
    }
    return {
      explanation: 'The provider temporarily limited requests due to high activity.',
      action: 'Wait 2-3 minutes before retrying.',
    };
  }

  // Generic fallback
  if (language === 'hi') {
    return {
      explanation: `कनेक्शन के दौरान एक समस्या आई: ${rawMessage || 'अज्ञात त्रुटि'}`,
      action: 'कृपया क्रेडेंशियल जांचें या लाइव असिस्टेंट से मदद लें।',
    };
  }
  if (language === 'hinglish') {
    return {
      explanation: `Connection mein problem aayi: ${rawMessage || 'Technical error'}`,
      action: 'Ek baar details check karein ya "Troubleshooting" option dekhein.',
    };
  }
  return {
    explanation: `An issue occurred: ${rawMessage || 'Unknown error'}`,
    action: 'Please review your credentials or use the troubleshooting wizard.',
  };
}
