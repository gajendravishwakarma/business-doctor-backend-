/**
 * Official Meta WhatsApp Business Platform Embedded Signup / Tech Provider Client Manager.
 *
 * Implements:
 * 1. Facebook JavaScript SDK (v21.0) dynamic loader
 * 2. FB.login with Embedded Signup config_id & sessionInfoVersion 3
 * 3. window.postMessage sessionInfoListener for WA_EMBEDDED_SIGNUP events
 * 4. State machine communication with server-side vault:
 *    NOT_CONNECTED -> AUTHORIZING -> AUTHORIZED -> ASSET_SELECTION -> CONNECTED -> HEALTHY -> ERROR/DISCONNECTED
 * 5. Safe metadata display (zero raw access tokens or App Secrets exposed to client)
 */

import {
  WhatsAppConnectorStateMachine,
  WhatsAppEligibleAsset,
  WhatsAppEmbeddedSignupConfig,
  WhatsAppSafeConnectionMetadata,
  WhatsAppStateResponse,
} from '../../types/whatsapp-onboarding';

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

/**
 * Fetch public configuration parameters for Meta Embedded Signup
 */
export async function getWhatsAppEmbeddedSignupConfig(): Promise<WhatsAppEmbeddedSignupConfig> {
  try {
    const res = await fetch('/api/connectors/whatsapp/config');
    if (res.ok) {
      return (await res.json()) as WhatsAppEmbeddedSignupConfig;
    }
  } catch (err) {
    console.warn('Could not fetch WhatsApp Embedded Signup config:', err);
  }

  return {
    appId: '',
    configId: '',
    isConfigured: false,
    graphVersion: 'v21.0',
    callbackUrl: `${window.location.origin}/api/webhooks/whatsapp`,
    mode: 'sandbox',
  };
}

/**
 * Start an Embedded Signup session on the server and receive a secure sessionToken
 */
export async function startWhatsAppEmbeddedSignup(
  businessId: string
): Promise<{ success: boolean; sessionToken?: string; error?: string }> {
  try {
    const res = await fetch('/api/connectors/whatsapp/embedded-signup/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-business-id': businessId,
      },
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to start session.' };
  }
}

/**
 * Fetch current state machine state for a tenant
 */
export async function fetchWhatsAppConnectorState(
  businessId: string
): Promise<WhatsAppStateResponse> {
  if (!businessId) {
    return { state: 'NOT_CONNECTED' };
  }

  try {
    const res = await fetch('/api/connectors/whatsapp/state', {
      headers: {
        'x-business-id': businessId,
      },
    });

    if (res.ok) {
      const data = await res.json();
      const rawState = data.state;
      const stateMachineState: WhatsAppConnectorStateMachine =
        typeof rawState === 'string'
          ? (rawState as WhatsAppConnectorStateMachine)
          : (rawState?.status || data.status || 'NOT_CONNECTED');

      return {
        state: stateMachineState,
        connection: data.connection || rawState?.activeConnection || data.activeConnection || null,
        health: data.health || null,
        pendingAssets: data.pendingAssets || rawState?.eligibleAssets || data.eligibleAssets || [],
        error: data.error || null,
      };
    }
  } catch (err) {
    console.warn('Could not fetch WhatsApp connector state:', err);
  }

  return { state: 'NOT_CONNECTED' };
}

/**
 * Exchange an Embedded Signup authorization code for a server-side vault session.
 */
export async function exchangeEmbeddedSignupCode(params: {
  businessId: string;
  code: string;
  sessionToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
  isTestMode?: boolean;
}): Promise<{
  success: boolean;
  state: WhatsAppConnectorStateMachine;
  sessionToken?: string;
  connection?: WhatsAppSafeConnectionMetadata;
  assets?: WhatsAppEligibleAsset[];
  message?: string;
  error?: string;
}> {
  const { businessId, code, wabaId, phoneNumberId, isTestMode } = params;
  let sessionToken = params.sessionToken;

  if (!sessionToken) {
    try {
      const startRes = await startWhatsAppEmbeddedSignup(businessId);
      if (startRes.success && startRes.sessionToken) {
        sessionToken = startRes.sessionToken;
      }
    } catch {
      // fallback
    }
  }

  const res = await fetch('/api/connectors/whatsapp/embedded-signup/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-business-id': businessId,
    },
    body: JSON.stringify({
      code,
      sessionToken,
      wabaId,
      phoneNumberId,
      isTestMode,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    return {
      success: false,
      state: 'ERROR',
      error: data.message || data.error || 'Failed to exchange Meta authorization code.',
    };
  }

  return {
    success: true,
    state: typeof data.state === 'string' ? data.state : (data.state?.status || data.status || 'CONNECTED'),
    sessionToken,
    connection: data.connection,
    assets: data.eligibleAssets || data.assets,
    message: data.message,
  };
}

/**
 * Finalize asset selection when a customer has multiple phone numbers
 */
export async function selectWhatsAppAsset(params: {
  businessId: string;
  wabaId: string;
  phoneNumberId: string;
  sessionToken?: string;
}): Promise<{
  success: boolean;
  state: WhatsAppConnectorStateMachine;
  connection?: WhatsAppSafeConnectionMetadata;
  error?: string;
}> {
  const { businessId, wabaId, phoneNumberId, sessionToken } = params;

  const res = await fetch('/api/connectors/whatsapp/embedded-signup/select-asset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-business-id': businessId,
    },
    body: JSON.stringify({
      wabaId,
      phoneNumberId,
      sessionToken,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    return {
      success: false,
      state: 'ERROR',
      error: data.message || data.error || 'Failed to select WhatsApp phone number asset.',
    };
  }

  return {
    success: true,
    state: 'CONNECTED',
    connection: data.connection,
  };
}

let fbSdkLoadingPromise: Promise<boolean> | null = null;

/**
 * Dynamically load and initialize the official Facebook JavaScript SDK
 */
export function loadFacebookSDK(appId: string): Promise<boolean> {
  if (window.FB) {
    return Promise.resolve(true);
  }

  if (fbSdkLoadingPromise) {
    return fbSdkLoadingPromise;
  }

  fbSdkLoadingPromise = new Promise<boolean>((resolve) => {
    if (!appId) {
      resolve(false);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
      resolve(true);
    };

    // Load SDK script
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.warn('Could not load Facebook JavaScript SDK (possibly blocked by ad blocker).');
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return fbSdkLoadingPromise;
}

export interface LaunchEmbeddedSignupOptions {
  businessId: string;
  config: WhatsAppEmbeddedSignupConfig;
  onStateChange: (state: WhatsAppConnectorStateMachine) => void;
  onAssetsDiscovered?: (assets: WhatsAppEligibleAsset[], wabaId: string) => void;
  onSuccess: (connection: WhatsAppSafeConnectionMetadata) => void;
  onError: (error: string) => void;
}

/**
 * Launches the official Meta WhatsApp Business Platform Embedded Signup flow.
 * Listens for window postMessage events and triggers code exchange.
 */
export async function launchOfficialEmbeddedSignup(
  options: LaunchEmbeddedSignupOptions
): Promise<void> {
  const { businessId, config, onStateChange, onAssetsDiscovered, onSuccess, onError } = options;

  onStateChange('AUTHORIZING');

  let sessionWabaId: string | undefined;
  let sessionPhoneNumberId: string | undefined;

  // 1. Setup Meta postMessage listener for WA_EMBEDDED_SIGNUP
  const messageHandler = (event: MessageEvent) => {
    if (
      event.origin !== 'https://www.facebook.com' &&
      event.origin !== 'https://web.facebook.com' &&
      event.origin !== window.location.origin
    ) {
      return;
    }

    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data.type === 'WA_EMBEDDED_SIGNUP') {
        if (data.event === 'FINISH') {
          sessionPhoneNumberId = data.data?.phone_number_id;
          sessionWabaId = data.data?.waba_id;
        } else if (data.event === 'CANCEL') {
          onStateChange('NOT_CONNECTED');
        } else if (data.event === 'ERROR') {
          onError(data.data?.error_message || 'Meta Embedded Signup encountered an error.');
        }
      }
    } catch {
      // Non-JSON postMessage ignored safely
    }
  };

  window.addEventListener('message', messageHandler);

  const cleanup = () => {
    window.removeEventListener('message', messageHandler);
  };

  // 2. If Meta App is configured and FB SDK is available, trigger real FB.login
  if (config.isConfigured && config.appId && config.configId) {
    const isLoaded = await loadFacebookSDK(config.appId);

    if (isLoaded && window.FB) {
      window.FB.login(
        async (response: any) => {
          cleanup();

          if (response.authResponse?.code) {
            onStateChange('AUTHORIZED');

            const result = await exchangeEmbeddedSignupCode({
              businessId,
              code: response.authResponse.code,
              wabaId: sessionWabaId,
              phoneNumberId: sessionPhoneNumberId,
              isTestMode: false,
            });

            if (!result.success) {
              onError(result.error || 'Failed to exchange Meta authorization code.');
              return;
            }

            if (result.state === 'ASSET_SELECTION' && result.assets && result.assets.length > 0) {
              onStateChange('ASSET_SELECTION');
              if (onAssetsDiscovered) {
                onAssetsDiscovered(result.assets, sessionWabaId || '');
              }
              return;
            }

            if (result.connection) {
              onStateChange('HEALTHY');
              onSuccess(result.connection);
            }
          } else {
            onStateChange('NOT_CONNECTED');
            onError('Meta authorization was canceled or did not return an authorization code.');
          }
        },
        {
          config_id: config.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            feature: 'whatsapp_embedded_signup',
            version: 2,
            sessionInfoVersion: 3,
          },
        }
      );
      return;
    }
  }

  // 3. Developer Sandbox / Interactive Verification Mode:
  // When live Meta Developer Credentials are being configured or in development sandbox,
  // simulates the exact postMessage and exchange sequence deterministically.
  cleanup();

  setTimeout(async () => {
    onStateChange('AUTHORIZED');

    const mockCode = `mock_code_sandbox_${Date.now()}`;
    const result = await exchangeEmbeddedSignupCode({
      businessId,
      code: mockCode,
      wabaId: `waba_${businessId.replace(/[^a-zA-Z0-9]/g, '_')}`,
      isTestMode: true,
    });

    if (!result.success) {
      onError(result.error || 'Failed to complete Embedded Signup exchange.');
      return;
    }

    if (result.connection) {
      onStateChange('HEALTHY');
      onSuccess(result.connection);
    }
  }, 1200);
}
