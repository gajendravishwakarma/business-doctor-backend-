import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  UploadCloud,
  HelpCircle,
  RefreshCw,
  Play,
  Pause,
  ShieldCheck,
  MessageSquare,
  Eye,
  Lock,
  Layers,
  Check,
  Send,
  Info,
} from 'lucide-react';
import {
  ConnectorProviderId,
  AssistanceLanguage,
  AssistanceAccountStatus,
  AssistanceStep,
  ScreenAnalysisResult,
  AssistanceMessage,
  TroubleshootingSymptom,
} from '../../types/connectors';
import {
  PROVIDER_ASSISTANCE_GUIDES,
  getWhatDoINowAdvice,
  explainErrorInLanguage,
  sanitizeUserInput,
} from '../../lib/connectors/assistance-guide';
import {
  analyzeConnectorScreen,
  SCREEN_DISCLAIMER,
} from '../../lib/connectors/screen-assistant';
import { useBusinessStore } from '../../lib/store';

interface LiveConnectionAssistantProps {
  provider: ConnectorProviderId;
  isOpen: boolean;
  onClose: () => void;
  onOpenConnectModal?: () => void;
}

export const LiveConnectionAssistant: React.FC<LiveConnectionAssistantProps> = ({
  provider,
  isOpen,
  onClose,
  onOpenConnectModal,
}) => {
  const guide = PROVIDER_ASSISTANCE_GUIDES[provider];
  const { business, integrations, addAuditLog, checkIntegrationHealth } = useBusinessStore();
  const currentIntegration = integrations.find((i) => i.provider === provider);

  // Assistant State
  const [activeTab, setActiveTab] = useState<'guided' | 'screen' | 'chat' | 'troubleshoot'>('guided');
  const [language, setLanguage] = useState<AssistanceLanguage>('hinglish');
  const [accountStatus, setAccountStatus] = useState<AssistanceAccountStatus>('unknown');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Talking / Voice Assistant State
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Screen Assistance State
  const [screenImage, setScreenImage] = useState<string | null>(null);
  const [screenAnalysis, setScreenAnalysis] = useState<ScreenAnalysisResult | null>(null);
  const [isAnalyzingScreen, setIsAnalyzingScreen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [chatInput, setChatInput] = useState<string>('');
  const [messages, setMessages] = useState<AssistanceMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am your Live Connection Assistant for ${guide?.providerName || provider}. I will guide you step by step to connect without any technical complexity.`,
      textHinglish: `Namaste! Main aapka Live Connection Assistant hoon ${guide?.providerName || provider} ke liye. Bina kisi technical jhanjhat ke step-by-step connect karne mein main aapki madad karunga.`,
      textHindi: `नमस्ते! मैं ${guide?.providerName || provider} के लिए आपका लाइव कनेक्शन सहायक हूँ।`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Troubleshooting State
  const [selectedSymptom, setSelectedSymptom] = useState<TroubleshootingSymptom | null>(null);

  // Initialize Speech Support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSpeechSynth = 'speechSynthesis' in window;
      const hasSpeechRec = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
      setSpeechSupported(hasSpeechSynth);
      if (!hasSpeechRec) {
        setVoiceNotice('Browser microphone recognition is optional. Voice readout is available.');
      }
    }
  }, []);

  // Audit Log: Assistance Started
  useEffect(() => {
    if (isOpen && business?.id) {
      addAuditLog(
        'ASSISTANCE_STARTED',
        `Live connection assistant started for ${provider} in ${language} mode.`
      );
    }
  }, [isOpen, provider]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  if (!isOpen || !guide) return null;

  const steps = guide.steps;
  const currentStep = steps[currentStepIndex] || steps[0];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isConnected = currentIntegration?.status === 'CONNECTED';

  // Read aloud helper using Web Speech API
  const speakText = (text: string) => {
    if (!speechSupported || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Stop any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleVoice = () => {
    if (isVoiceActive) {
      setIsVoiceActive(false);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } else {
      setIsVoiceActive(true);
      const textToRead =
        language === 'hi'
          ? currentStep.descriptionHindi
          : language === 'hinglish'
          ? currentStep.descriptionHinglish
          : currentStep.description;
      speakText(textToRead);
    }
  };

  // Mic Toggle for voice input
  const handleToggleMic = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech-to-text is not supported by your browser. Please type in the chat.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSendMessage(transcript);
        }
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Step Completion
  const handleCompleteStep = () => {
    const stepId = currentStep.id;
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps((prev) => [...prev, stepId]);
      if (business?.id) {
        addAuditLog(
          'SETUP_STEP_COMPLETED',
          `Assistance step '${currentStep.title}' completed for ${provider}.`
        );
      }
    }
    if (!isLastStep) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  // Send message in Assistant Chat
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    // Check for sensitive info (passwords, OTPs, secret keys)
    const sanitization = sanitizeUserInput(text);

    const userMsg: AssistanceMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: sanitization.sanitized,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sensitiveDetected: sanitization.hasSensitive,
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    // If sensitive data was entered, warn immediately
    if (sanitization.hasSensitive) {
      const warningMsg: AssistanceMessage = {
        id: `assistant-warn-${Date.now()}`,
        sender: 'assistant',
        text: 'Security Alert: We masked sensitive data (such as a password or OTP). Never enter confidential passwords or OTPs in the assistant.',
        textHinglish:
          'Security Alert: Aapka password ya OTP safe rakhne ke liye mask kar diya gaya hai. Kripya passwords ya OTP kabhi share na karein.',
        textHindi: 'सुरक्षा सूचना: हमने आपकी सुरक्षा के लिए पासवर्ड या ओटीपी को हटा दिया है।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionType: 'sensitive_warning',
      };
      setMessages((prev) => [...prev, warningMsg]);
      if (isVoiceActive) speakText('Sensitive credentials masked for your protection.');
      return;
    }

    // Call backend assistant endpoint
    try {
      const response = await fetch('/api/connectors/assist/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-business-id': business?.id || 'biz_01_health_bengaluru',
        },
        body: JSON.stringify({
          provider,
          message: sanitization.sanitized,
          stepId: currentStep.id,
          language,
          accountStatus,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: AssistanceMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          textHinglish: data.replyHinglish,
          textHindi: data.replyHindi,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionType: data.actionType,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (isVoiceActive) {
          speakText(data.reply);
        }
      } else {
        // Fallback to local advice engine
        const localAdvice = getWhatDoINowAdvice(provider, currentStep.id, accountStatus, language);
        const fallbackMsg: AssistanceMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: localAdvice,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        if (isVoiceActive) speakText(localAdvice);
      }
    } catch {
      const localAdvice = getWhatDoINowAdvice(provider, currentStep.id, accountStatus, language);
      const fallbackMsg: AssistanceMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: localAdvice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      if (isVoiceActive) speakText(localAdvice);
    }
  };

  // "What do I do now?" primary action
  const handleWhatDoINow = () => {
    const advice = getWhatDoINowAdvice(provider, currentStep.id, accountStatus, language);
    const msg: AssistanceMessage = {
      id: `what-now-${Date.now()}`,
      sender: 'assistant',
      text: advice,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionType: 'what_to_do',
    };
    setMessages((prev) => [...prev, msg]);
    if (isVoiceActive) speakText(advice);
    setActiveTab('guided');
  };

  // Screen Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setScreenImage(result);
      runScreenAnalysis(result);
    };
    reader.readAsDataURL(file);
  };

  // Run screen analysis
  const runScreenAnalysis = async (base64Img: string) => {
    setIsAnalyzingScreen(true);
    setScreenAnalysis(null);

    try {
      const res = await fetch('/api/connectors/assist/screen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-business-id': business?.id || 'biz_01_health_bengaluru',
        },
        body: JSON.stringify({
          provider,
          base64Image: base64Img,
          language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setScreenAnalysis(data.analysis);
        if (isVoiceActive && data.analysis?.nextStepGuidance) {
          speakText(
            language === 'hinglish'
              ? data.analysis.nextStepGuidanceHinglish
              : data.analysis.nextStepGuidance
          );
        }
      } else {
        // Client-side fallback
        const fallback = analyzeConnectorScreen({
          provider,
          base64Image: base64Img,
          language,
        });
        setScreenAnalysis(fallback);
      }
    } catch {
      const fallback = analyzeConnectorScreen({
        provider,
        base64Image: base64Img,
        language,
      });
      setScreenAnalysis(fallback);
    } finally {
      setIsAnalyzingScreen(false);
    }
  };

  // Screen Sharing Capture (Optional browser standard)
  const handleCaptureScreen = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      alert('Screen capture is not supported in this browser. Please upload a screenshot file.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
      });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      track.stop();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(bitmap, 0, 0);
      const base64 = canvas.toDataURL('image/png');

      setScreenImage(base64);
      runScreenAnalysis(base64);
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        alert('Could not capture screen. Please use the file upload option.');
      }
    }
  };

  // Live Connection Verification Probe
  const handleVerifyConnection = async () => {
    setIsVerifying(true);
    setVerificationFeedback(null);
    try {
      const result = await checkIntegrationHealth(provider);
      if (result.status === 'healthy') {
        setVerificationFeedback('Connection verified successfully! Your channel is active and receiving events.');
      } else {
        setVerificationFeedback(
          result.message || 'Connection health check failed. Review your credentials or permissions.'
        );
      }
    } catch (err: any) {
      setVerificationFeedback(err.message || 'Verification failed. Please retry.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* TOP BAR */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Live Connection Assistant
                </h2>
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {guide.providerName}
                </span>
                {isConnected && (
                  <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Guiding non-technical business owners step by step with zero confusion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-white p-1 text-xs">
              <button
                type="button"
                onClick={() => setLanguage('hinglish')}
                className={`rounded px-2.5 py-1 font-medium transition-all ${
                  language === 'hinglish' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hinglish
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`rounded px-2.5 py-1 font-medium transition-all ${
                  language === 'en' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`rounded px-2.5 py-1 font-medium transition-all ${
                  language === 'hi' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिंदी
              </button>
            </div>

            {/* Voice Assistant Toggle */}
            <button
              type="button"
              onClick={handleToggleVoice}
              title={isVoiceActive ? 'Mute Voice Assistant' : 'Enable Voice Assistant'}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isVoiceActive
                  ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300 animate-pulse'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isVoiceActive ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span>{isVoiceActive ? 'Speaking' : 'Voice Off'}</span>
            </button>

            {/* Pause / Resume */}
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? 'Resume Assistant' : 'Pause Assistant'}
              className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100"
            >
              {isPaused ? <Play className="h-4 w-4 text-emerald-600" /> : <Pause className="h-4 w-4 text-slate-600" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* STEP PROGRESS TRACKER */}
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Setup Progress
              </span>
              <span className="text-xs text-slate-500">
                (Step {currentStepIndex + 1} of {steps.length})
              </span>
            </div>
            <div className="text-xs font-medium text-slate-500">
              Est. time remaining: ~{(steps.length - currentStepIndex) * 2} mins
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            {steps.map((step, idx) => {
              const isDone = completedSteps.includes(step.id);
              const isCurr = idx === currentStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`flex flex-1 items-center gap-2 rounded-lg border p-2 text-left transition-all ${
                    isCurr
                      ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                      : isDone
                      ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isCurr
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1 truncate">
                    <p
                      className={`truncate text-xs font-semibold ${
                        isCurr ? 'text-blue-900' : isDone ? 'text-emerald-900' : 'text-slate-700'
                      }`}
                    >
                      {language === 'hi'
                        ? step.titleHindi
                        : language === 'hinglish'
                        ? step.titleHinglish
                        : step.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('guided')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 transition-colors ${
              activeTab === 'guided'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Guided Instructions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('screen')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 transition-colors ${
              activeTab === 'screen'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Eye className="h-4 w-4" />
            <span>Screen Assistance</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 transition-colors ${
              activeTab === 'chat'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Assistant Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('troubleshoot')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 transition-colors ${
              activeTab === 'troubleshoot'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Troubleshooting & Fixes</span>
          </button>
        </div>

        {/* BODY CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: GUIDED STEPS */}
          {activeTab === 'guided' && (
            <div className="space-y-6">
              {/* Account Check Branching: "I already have an account" vs "I don't have an account" */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <p className="text-xs font-semibold text-blue-900">
                  {language === 'hi'
                    ? 'क्या आपके पास पहले से खाता है?'
                    : language === 'hinglish'
                    ? 'Kya aapke paas pehle se account bana hua hai?'
                    : 'Do you already have an account on this platform?'}
                </p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAccountStatus('has_account')}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                      accountStatus === 'has_account'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50'
                    }`}
                  >
                    {language === 'hi'
                      ? 'हाँ, मेरे पास खाता है'
                      : language === 'hinglish'
                      ? 'Haan, mere paas account hai'
                      : 'Yes, I have an account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountStatus('needs_account')}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                      accountStatus === 'needs_account'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'border border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                    }`}
                  >
                    {language === 'hi'
                      ? 'नहीं, नया खाता बनाना है'
                      : language === 'hinglish'
                      ? 'Nahi, naya account banana hai'
                      : "No, I don't have an account"}
                  </button>
                </div>
              </div>

              {/* FLOW A: "I DON'T HAVE AN ACCOUNT" */}
              {accountStatus === 'needs_account' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">
                        {language === 'hi'
                          ? `${guide.providerName} पर खाता क्यों आवश्यक है?`
                          : language === 'hinglish'
                          ? `${guide.providerName} par account kyun zaroori hai?`
                          : `Why is an account required on ${guide.providerName}?`}
                      </h4>
                      <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                        {language === 'hi'
                          ? guide.accountCreation.whyRequired.hi
                          : language === 'hinglish'
                          ? guide.accountCreation.whyRequired.hinglish
                          : guide.accountCreation.whyRequired.en}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-4 border border-amber-100">
                    <p className="text-xs font-bold text-slate-800">
                      {language === 'hi' ? 'आवश्यक आवश्यकताएं (Prerequisites):' : 'Requirements before signing up:'}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {guide.accountCreation.prerequisites.map((req, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-800">
                      {language === 'hi' ? 'चरण-दर-चरण गाइड:' : 'Step-by-step account creation:'}
                    </p>
                    {guide.accountCreation.steps.map((s, idx) => (
                      <div key={idx} className="rounded-lg bg-white p-3 border border-amber-100 text-xs text-slate-700">
                        {language === 'hi' ? s.hi : language === 'hinglish' ? s.hinglish : s.en}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <a
                      href={guide.accountCreation.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs"
                    >
                      <span>
                        {language === 'hi'
                          ? `${guide.providerName} पर आधिकारिक पंजीकरण खोलें`
                          : `Open Official ${guide.providerName} Sign-Up`}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setAccountStatus('has_account')}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      {language === 'hi'
                        ? 'खाता बन गया? यहां क्लिक करें'
                        : language === 'hinglish'
                        ? 'Account ban gaya? Yahan click karein'
                        : 'Done creating account? Click here'}
                    </button>
                  </div>
                </div>
              ) : (
                /* FLOW B: NORMAL / EXISTING ACCOUNT STEP FLOW */
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                          Step {currentStepIndex + 1}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">
                          {language === 'hi'
                            ? currentStep.titleHindi
                            : language === 'hinglish'
                            ? currentStep.titleHinglish
                            : currentStep.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                        {language === 'hi'
                          ? currentStep.descriptionHindi
                          : language === 'hinglish'
                          ? currentStep.descriptionHinglish
                          : currentStep.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleWhatDoINow}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all shrink-0"
                    >
                      <HelpCircle className="h-4 w-4" />
                      <span>{language === 'hi' ? 'अब मैं क्या करूँ?' : 'What do I do now?'}</span>
                    </button>
                  </div>

                  {/* ACTION REQUIRED BOX */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      {language === 'hi' ? 'कार्रवाई आवश्यक:' : 'Action Required:'}
                    </p>
                    <p className="mt-1 text-xs text-blue-800 leading-relaxed font-medium">
                      {language === 'hi'
                        ? currentStep.actionRequired
                        : language === 'hinglish'
                        ? currentStep.actionRequiredHinglish
                        : currentStep.actionRequired}
                    </p>
                  </div>

                  {/* DIRECT OFFICIAL CONSOLE LINK */}
                  {currentStep.officialUrl && (
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <ExternalLink className="h-4 w-4 text-slate-500" />
                        <span>Official Portal:</span>
                        <code className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-800">
                          {currentStep.officialUrl}
                        </code>
                      </div>
                      <a
                        href={currentStep.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 border border-slate-300 hover:bg-slate-50 shadow-2xs"
                      >
                        <span>Open Console</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {/* CONNECT ACTION BUTTON */}
                  {onOpenConnectModal && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={onOpenConnectModal}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-sm transition-all"
                      >
                        <Lock className="h-4 w-4" />
                        <span>Open Secure {guide.providerName} Connect Dialog</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCREEN ASSISTANCE (FOUNDATION) */}
          {activeTab === 'screen' && (
            <div className="space-y-6">
              {/* Disclaimer Banner */}
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">Visual Screen Guide</h4>
                  <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                    {SCREEN_DISCLAIMER}
                  </p>
                  <p className="mt-1 text-xs text-amber-700 font-medium">
                    Protected credentials (passwords, OTPs, secret keys) are masked automatically and never stored.
                  </p>
                </div>
              </div>

              {/* Upload or Capture Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all"
                >
                  <UploadCloud className="h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-xs font-bold text-slate-700">
                    Upload Screenshot of Setup Screen
                  </p>
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div
                  onClick={handleCaptureScreen}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all"
                >
                  <Eye className="h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-xs font-bold text-slate-700">
                    Capture Active Window / Tab
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Direct browser snapshot (one-time visual inspection)
                  </p>
                </div>
              </div>

              {/* Screen Analysis Result */}
              {isAnalyzingScreen && (
                <div className="flex items-center justify-center p-8 text-xs text-slate-500">
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                  Analyzing screen elements safely...
                </div>
              )}

              {screenAnalysis && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Identified Screen
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {screenAnalysis.identifiedScreen}
                      </h4>
                    </div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                        screenAnalysis.confidence === 'high'
                          ? 'bg-emerald-100 text-emerald-800'
                          : screenAnalysis.confidence === 'medium'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Confidence: {screenAnalysis.confidence}
                    </span>
                  </div>

                  {/* Next Step Guidance */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4">
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Next Step to Perform:
                    </p>
                    <p className="mt-1 text-xs text-blue-900 leading-relaxed font-medium">
                      {language === 'hi'
                        ? screenAnalysis.nextStepGuidance
                        : language === 'hinglish'
                        ? screenAnalysis.nextStepGuidanceHinglish
                        : screenAnalysis.nextStepGuidance}
                    </p>
                  </div>

                  {/* Visible Buttons & Options */}
                  {screenAnalysis.visibleButtons.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600">Visible Controls Detected:</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {screenAnalysis.visibleButtons.map((btn, i) => (
                          <span
                            key={i}
                            className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200"
                          >
                            {btn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detected Errors */}
                  {screenAnalysis.detectedErrors.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-bold text-red-900">Errors Detected on Screen:</p>
                      <ul className="mt-1 list-disc list-inside text-xs text-red-800 space-y-0.5">
                        {screenAnalysis.detectedErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Unclear warning */}
                  {screenAnalysis.needsNewScreenshot && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      {screenAnalysis.clarificationMessage ||
                        'The screen was unclear. Please upload another clear screenshot.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ASSISTANT CHAT */}
          {activeTab === 'chat' && (
            <div className="flex h-[420px] flex-col rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                            : msg.actionType === 'sensitive_warning'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 rounded-bl-xs'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-2xs'
                        }`}
                      >
                        <p>
                          {language === 'hi' && msg.textHindi
                            ? msg.textHindi
                            : language === 'hinglish' && msg.textHinglish
                            ? msg.textHinglish
                            : msg.text}
                        </p>
                      </div>
                      <span className="mt-1 text-[10px] text-slate-400 px-1">{msg.timestamp}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Prompts */}
              <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-200 bg-white px-4 py-2 text-xs">
                <button
                  type="button"
                  onClick={handleWhatDoINow}
                  className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100 font-medium"
                >
                  What do I do now?
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("I don't have an account")}
                  className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 font-medium"
                >
                  I don't have an account
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Where do I find my API key?')}
                  className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 font-medium"
                >
                  Where is my API key?
                </button>
              </div>

              {/* Chat Input Bar */}
              <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  title="Voice Input (Speech to text)"
                  className={`rounded-lg p-2 transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    language === 'hi'
                      ? 'मदद के लिए यहां पूछें (पासवर्ड या ओटीपी न लिखें)...'
                      : language === 'hinglish'
                      ? 'Bataiye kya problem aa rahi hai (No passwords or OTPs)...'
                      : 'Ask anything about this connector setup (Never enter passwords)...'
                  }
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: TROUBLESHOOTING & FIXES */}
          {activeTab === 'troubleshoot' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {language === 'hi' ? 'सामान्य समस्याएं और समाधान' : 'Common Issues & Instant Fixes'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an error to see plain-English resolution instructions
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {guide.symptoms.map((sym) => {
                  const isSelected = selectedSymptom?.id === sym.id;
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => setSelectedSymptom(sym)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <h5 className="text-xs font-bold text-slate-900">
                          {language === 'hinglish' ? sym.titleHinglish : sym.title}
                        </h5>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {language === 'hinglish' ? sym.descriptionHinglish : sym.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedSymptom && (
                <div className="rounded-xl border border-amber-200 bg-white p-5 space-y-4 shadow-xs">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                      Resolution Guide
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {selectedSymptom.title}
                    </h4>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700">Resolution Steps:</p>
                    <ol className="mt-2 list-decimal list-inside space-y-1.5 text-xs text-slate-700">
                      {(language === 'hinglish'
                        ? selectedSymptom.resolutionStepsHinglish
                        : selectedSymptom.resolutionSteps
                      ).map((stepText, idx) => (
                        <li key={idx} className="leading-relaxed font-medium">
                          {stepText}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER CONTROLS */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleVerifyConnection}
              disabled={isVerifying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Verifying...' : 'Verify Connection'}</span>
            </button>

            {verificationFeedback && (
              <span className="text-xs font-semibold text-slate-700">
                {verificationFeedback}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteStep}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs"
            >
              <span>{isLastStep ? 'Finish Setup' : 'Mark Done & Next'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
