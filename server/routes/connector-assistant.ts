import { Request, Response, Router } from 'express';
import { requireAuth } from '../auth';
import { ConnectorProviderId, AssistanceLanguage, AssistanceAccountStatus } from '../../src/types/connectors';
import {
  sanitizeUserInput,
  getWhatDoINowAdvice,
  explainErrorInLanguage,
  PROVIDER_ASSISTANCE_GUIDES,
} from '../../src/lib/connectors/assistance-guide';
import {
  analyzeConnectorScreen,
  SCREEN_DISCLAIMER,
} from '../../src/lib/connectors/screen-assistant';

export const connectorAssistantRouter = Router();

/**
 * POST /api/connectors/assist/chat
 * Conversational assistance for connector setup.
 * Enforces tenant authentication and strips sensitive data.
 */
connectorAssistantRouter.post(
  '/chat',
  requireAuth({ allowedRoles: ['owner', 'manager', 'admin', 'staff'] }),
  async (req: Request, res: Response) => {
    try {
      const {
        provider,
        message,
        stepId = 'account_check',
        language = 'hinglish',
        accountStatus = 'unknown',
      } = req.body;

      if (!provider) {
        return res.status(400).json({ error: 'Missing required field: provider' });
      }

      const validProviders: ConnectorProviderId[] = [
        'whatsapp_business',
        'facebook',
        'instagram',
        'youtube',
        'razorpay',
      ];
      if (!validProviders.includes(provider)) {
        return res.status(400).json({ error: `Invalid provider: ${provider}` });
      }

      // 1. Sanitize user input - redacting any sensitive data (OTPs, passwords, API keys)
      const userText = String(message || '').trim();
      const sanitization = sanitizeUserInput(userText);

      // If user submitted sensitive data, issue immediate guidance warning
      if (sanitization.hasSensitive) {
        const warning =
          language === 'hi'
            ? 'सुरक्षा चेतावनी: हमने आपकी सुरक्षा के लिए पासवर्ड या ओटीपी जैसी संवेदनशील जानकारी को हटा दिया है। कभी भी पासवर्ड या ओटीपी चैट में न लिखें।'
            : language === 'hinglish'
            ? 'Security Alert: Aapka password ya OTP detect karke safe rakhne ke liye mask kar diya gaya hai. Kripya sensitive passwords ya OTP yahan type na karein.'
            : 'Security Notice: Sensitive information (such as password or OTP) was detected and automatically redacted for your safety. Never share secrets in chat.';

        return res.json({
          success: true,
          reply: warning,
          replyHinglish:
            'Aapka password ya OTP detect karke safe rakhne ke liye mask kar diya gaya hai. Kripya sensitive passwords ya OTP yahan type na karein.',
          replyHindi:
            'हमने आपकी सुरक्षा के लिए पासवर्ड या ओटीपी को हटा दिया है। कभी भी पासवर्ड या ओटीपी चैट में न लिखें।',
          sensitiveDetected: true,
          actionType: 'sensitive_warning',
          stepId,
          suggestedActions: ['Continue setup without sharing passwords', 'Need help with login?'],
        });
      }

      // 2. Understand user intent
      const lower = userText.toLowerCase();
      const guide = PROVIDER_ASSISTANCE_GUIDES[provider as ConnectorProviderId];

      let reply = '';
      let replyHinglish = '';
      let replyHindi = '';
      let actionType: string = 'next_step';

      if (
        lower.includes('what do i do') ||
        lower.includes('kya karu') ||
        lower.includes('next step') ||
        lower.includes('help') ||
        userText === ''
      ) {
        actionType = 'what_to_do';
        reply = getWhatDoINowAdvice(provider, stepId, accountStatus, 'en');
        replyHinglish = getWhatDoINowAdvice(provider, stepId, accountStatus, 'hinglish');
        replyHindi = getWhatDoINowAdvice(provider, stepId, accountStatus, 'hi');
      } else if (lower.includes('no account') || lower.includes('account nahi hai') || lower.includes('create account') || lower.includes('signup')) {
        actionType = 'account_create';
        reply = `To create an account, visit ${guide.accountCreation.officialUrl}. ${guide.accountCreation.whyRequired.en}`;
        replyHinglish = `${guide.providerName} par naya account banane ke liye: ${guide.accountCreation.officialUrl} kholein. ${guide.accountCreation.whyRequired.hinglish}`;
        replyHindi = `${guide.providerName} पर नया खाता बनाने के लिए: ${guide.accountCreation.officialUrl} पर जाएं।`;
      } else if (lower.includes('already have') || lower.includes('pehle se account hai') || lower.includes('existing')) {
        actionType = 'account_existing';
        reply = `Great! Navigate directly to: ${guide.existingAccount.directUrl}. ${guide.existingAccount.whereToGo.en}`;
        replyHinglish = `Badhiya! Aap directly console open karein: ${guide.existingAccount.directUrl}. ${guide.existingAccount.whereToGo.hinglish}`;
        replyHindi = `बहुत अच्छा! सीधे कंसोल खोलें: ${guide.existingAccount.directUrl}`;
      } else if (lower.includes('error') || lower.includes('failed') || lower.includes('galat') || lower.includes('problem')) {
        actionType = 'troubleshoot';
        const errorInfo = explainErrorInLanguage('GENERIC_ERROR', userText, language as AssistanceLanguage);
        reply = `${errorInfo.explanation} Action: ${errorInfo.action}`;
        replyHinglish = errorInfo.explanation;
        replyHindi = errorInfo.explanation;
      } else {
        // Contextual guidance
        reply = `I am here to guide you with ${guide.providerName}. You are on step "${stepId}". Let me know if you need to create an account, locate your dashboard, or solve an error.`;
        replyHinglish = `Main aapko ${guide.providerName} connect karne mein help kar raha hoon. Aap "${stepId}" step par hain. Bataiye kya help chahiye: account banana hai ya koi error aa raha hai?`;
        replyHindi = `मैं ${guide.providerName} सेटअप में आपकी मदद कर रहा हूँ।`;
      }

      return res.json({
        success: true,
        reply: language === 'hi' ? replyHindi : language === 'hinglish' ? replyHinglish : reply,
        replyHinglish,
        replyHindi,
        actionType,
        stepId,
        provider,
        disclaimer: SCREEN_DISCLAIMER,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Connector Assistant Chat Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to process assistant chat' });
    }
  }
);

/**
 * POST /api/connectors/assist/screen
 * Analyzes uploaded screenshots for connector setup guidance.
 */
connectorAssistantRouter.post(
  '/screen',
  requireAuth({ allowedRoles: ['owner', 'manager', 'admin', 'staff'] }),
  async (req: Request, res: Response) => {
    try {
      const {
        provider,
        base64Image,
        imageDimensions,
        language = 'hinglish',
        ocrExtractedText = '',
      } = req.body;

      if (!provider) {
        return res.status(400).json({ error: 'Missing required field: provider' });
      }

      // Run screen analysis foundation with sensitive redaction
      const analysis = analyzeConnectorScreen({
        provider: provider as ConnectorProviderId,
        base64Image,
        imageDimensions,
        language: language as AssistanceLanguage,
        ocrExtractedText,
      });

      return res.json({
        success: true,
        analysis,
        disclaimer: SCREEN_DISCLAIMER,
        businessId: req.auth!.businessId,
      });
    } catch (err: any) {
      console.error('Connector Assistant Screen Analysis Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to analyze screen' });
    }
  }
);
