import crypto from 'node:crypto';
import { WhatsAppOutboundJob, OutboundMessageStatus } from '../../src/types/whatsapp-onboarding';
import { getWhatsAppCredentials } from '../vault/whatsapp-vault';
import { sendMetaWhatsAppMessage, MetaApiError } from './meta-whatsapp-client';
import { recordWhatsAppAudit } from './whatsapp-audit-service';
import { validateBusinessId } from './whatsapp-validator';

// In-memory store of outbound message jobs
export const inMemoryOutboundJobs = new Map<string, WhatsAppOutboundJob>();

export interface ProposeMessageParams {
  business_id: string;
  recipient_phone: string;
  message_text: string;
  template_name?: string;
  action_id?: string;
  requires_human_approval?: boolean;
}

export interface ApproveMessageParams {
  job_id: string;
  business_id: string;
  approved_by: string;
}

/**
 * Checks whether an error is transient (safe to retry with exponential backoff)
 * or permanent (invalid recipient, revoked token, policy violation - never retry).
 */
export function classifyWhatsAppError(err: any): { isTransient: boolean; reason: string } {
  if (err instanceof MetaApiError) {
    const subcode = err.errorSubcode;
    const code = err.code;

    // Transient Meta error codes/subcodes (rate limits, temporary capacity issues)
    if (
      code === 4 ||
      code === 17 ||
      code === 32 ||
      code === 613 ||
      subcode === 130429 ||
      subcode === 131056 ||
      subcode === 131048
    ) {
      return { isTransient: true, reason: `Meta rate limit / temporary throttle (code ${code}, subcode ${subcode}): ${err.message}` };
    }

    // Permanent errors (invalid token, recipient not on whatsapp, policy violation, missing template)
    if (
      code === 190 || // Invalid access token
      code === 100 || // Invalid parameter
      subcode === 131026 || // Message undeliverable / recipient not on WhatsApp
      subcode === 132000 || // Template does not exist
      subcode === 132001 // Template not approved
    ) {
      return { isTransient: false, reason: `Permanent Meta error (code ${code}, subcode ${subcode}): ${err.message}` };
    }

    return { isTransient: false, reason: `Meta API error: ${err.message}` };
  }

  const message = err?.message || String(err);
  if (
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('timeout')
  ) {
    return { isTransient: true, reason: `Network transport failure: ${message}` };
  }

  return { isTransient: false, reason: message };
}

/**
 * 1. Propose an outbound WhatsApp message.
 * Strict Safety: Enters 'proposed' state. Never sent automatically.
 */
export function proposeOutboundMessage(params: ProposeMessageParams): WhatsAppOutboundJob {
  const bizVal = validateBusinessId(params.business_id);
  if (!bizVal.valid) {
    throw new Error(bizVal.error);
  }

  if (!params.recipient_phone || !params.recipient_phone.trim()) {
    throw new Error('recipient_phone is required.');
  }

  if (!params.message_text && !params.template_name) {
    throw new Error('message_text or template_name is required.');
  }

  const now = new Date().toISOString();
  const jobId = `job_wa_${crypto.randomUUID()}`;

  const job: WhatsAppOutboundJob = {
    id: jobId,
    business_id: params.business_id,
    action_id: params.action_id,
    recipient_phone: params.recipient_phone.trim(),
    message_text: params.message_text,
    template_name: params.template_name,
    status: 'proposed',
    requires_human_approval: params.requires_human_approval ?? true,
    is_human_approved: false,
    attempt_count: 0,
    max_retries: 3,
    created_at: now,
    updated_at: now,
  };

  inMemoryOutboundJobs.set(jobId, job);

  // Record audit log
  recordWhatsAppAudit({
    business_id: params.business_id,
    action: 'message_proposed',
    details: `Outbound WhatsApp message proposed for ${job.recipient_phone}. Awaiting human authorization.`,
    entity_type: 'whatsapp_message',
    metadata: {
      jobId,
      recipient: job.recipient_phone,
      actionId: job.action_id,
      requiresApproval: job.requires_human_approval,
    },
  });

  return job;
}

/**
 * 2. Approve an outbound WhatsApp message.
 * State transition: proposed -> approved
 */
export function approveOutboundMessage(params: ApproveMessageParams): WhatsAppOutboundJob {
  const job = inMemoryOutboundJobs.get(params.job_id);
  if (!job || job.business_id !== params.business_id) {
    throw new Error(`Outbound job "${params.job_id}" not found for this business.`);
  }

  if (job.status !== 'proposed') {
    throw new Error(`Cannot approve job in "${job.status}" status. Job must be "proposed".`);
  }

  const now = new Date().toISOString();
  job.status = 'approved';
  job.is_human_approved = true;
  job.approved_by = params.approved_by;
  job.approved_at = now;
  job.updated_at = now;

  recordWhatsAppAudit({
    business_id: params.business_id,
    action: 'message_approved',
    details: `Outbound WhatsApp message authorized by ${params.approved_by} for ${job.recipient_phone}.`,
    entity_type: 'whatsapp_message',
    metadata: {
      jobId: job.id,
      approvedBy: params.approved_by,
      recipient: job.recipient_phone,
    },
  });

  return job;
}

/**
 * 3. Safely execute an approved outbound message.
 * State transition: approved -> executing -> sent (or failed / permanently_failed)
 * Rejects any unapproved consequential messages (blocks approval bypass).
 */
export async function executeOutboundJob(
  jobId: string,
  businessId: string
): Promise<{ success: boolean; job: WhatsAppOutboundJob; error?: string }> {
  const job = inMemoryOutboundJobs.get(jobId);
  if (!job || job.business_id !== businessId) {
    throw new Error(`Job "${jobId}" not found for business "${businessId}".`);
  }

  // Approval Bypass Prevention
  if (job.requires_human_approval && (!job.is_human_approved || job.status === 'proposed')) {
    recordWhatsAppAudit({
      business_id: businessId,
      action: 'message_failed',
      details: `Execution rejected: Message requires explicit human approval before dispatch.`,
      entity_type: 'whatsapp_message',
      metadata: { jobId, status: job.status, violation: 'APPROVAL_BYPASS_ATTEMPT' },
    });
    return {
      success: false,
      job,
      error: 'Security Policy Violation: Message requires explicit human approval before dispatch.',
    };
  }

  if (job.status === 'sent') {
    return { success: true, job };
  }

  if (job.status === 'permanently_failed') {
    return {
      success: false,
      job,
      error: `Job permanently failed: ${job.last_error}. Retries are disabled.`,
    };
  }

  job.status = 'executing';
  job.attempt_count += 1;
  const now = new Date().toISOString();
  job.last_attempt_at = now;
  job.updated_at = now;

  // Retrieve credentials from vault
  const creds = getWhatsAppCredentials(businessId);
  if (!creds || !creds.accessToken || !creds.phoneNumberId) {
    job.status = 'permanently_failed';
    job.last_error = 'WhatsApp credentials not found or not connected in vault.';
    job.is_transient_error = false;
    job.updated_at = new Date().toISOString();

    recordWhatsAppAudit({
      business_id: businessId,
      action: 'message_failed',
      details: `Permanent failure: WhatsApp credentials missing in vault.`,
      entity_type: 'whatsapp_message',
      metadata: { jobId, error: job.last_error },
    });

    return { success: false, job, error: job.last_error };
  }

  // Handle Sandbox Mode
  if (creds.isTestMode) {
    const wamid = `wamid.SANDBOX_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    job.status = 'sent';
    job.external_message_id = wamid;
    job.updated_at = new Date().toISOString();

    recordWhatsAppAudit({
      business_id: businessId,
      action: 'message_sent',
      details: `Sandbox WhatsApp message dispatched to ${job.recipient_phone}. Message ID: ${wamid}`,
      entity_type: 'whatsapp_message',
      metadata: { jobId, wamid, isSandbox: true, recipient: job.recipient_phone },
    });

    return { success: true, job };
  }

  // Live Meta Cloud API Dispatch
  try {
    const metaResponse = await sendMetaWhatsAppMessage({
      phoneNumberId: creds.phoneNumberId,
      accessToken: creds.accessToken,
      to: job.recipient_phone,
      message: job.message_text,
      type: job.template_name ? 'template' : 'text',
      template: job.template_name
        ? {
            name: job.template_name,
            language: { code: 'en_US' },
          }
        : undefined,
    });

    const wamid = metaResponse.messages?.[0]?.id || `wamid.${Date.now()}`;
    job.status = 'sent';
    job.external_message_id = wamid;
    job.updated_at = new Date().toISOString();

    recordWhatsAppAudit({
      business_id: businessId,
      action: 'message_sent',
      details: `Live WhatsApp message dispatched to ${job.recipient_phone}. WAMID: ${wamid}`,
      entity_type: 'whatsapp_message',
      metadata: { jobId, wamid, recipient: job.recipient_phone },
    });

    return { success: true, job };
  } catch (dispatchErr: any) {
    const { isTransient, reason } = classifyWhatsAppError(dispatchErr);
    job.last_error = reason;
    job.is_transient_error = isTransient;
    job.updated_at = new Date().toISOString();

    if (isTransient && job.attempt_count < job.max_retries) {
      job.status = 'failed';
      // Exponential backoff: 2^attempt * 1000ms
      const backoffMs = Math.min(1000 * Math.pow(2, job.attempt_count), 30000);
      job.next_retry_at = new Date(Date.now() + backoffMs).toISOString();

      recordWhatsAppAudit({
        business_id: businessId,
        action: 'message_failed',
        details: `Transient dispatch failure (attempt ${job.attempt_count}/${job.max_retries}): ${reason}. Scheduled retry in ${backoffMs}ms.`,
        entity_type: 'whatsapp_message',
        metadata: { jobId, attempt: job.attempt_count, nextRetryAt: job.next_retry_at, isTransient: true },
      });

      return { success: false, job, error: reason };
    }

    // Permanent failure OR max retries exceeded
    job.status = 'permanently_failed';
    job.next_retry_at = undefined;

    recordWhatsAppAudit({
      business_id: businessId,
      action: 'message_failed',
      details: `Permanent dispatch failure: ${reason}. Job closed without further retries.`,
      entity_type: 'whatsapp_message',
      metadata: { jobId, attempt: job.attempt_count, isTransient: false, permanent: true },
    });

    return { success: false, job, error: reason };
  }
}

/**
 * Returns outbound jobs filtered by businessId
 */
export function getOutboundJobs(businessId: string): WhatsAppOutboundJob[] {
  if (!businessId) return [];
  const results: WhatsAppOutboundJob[] = [];
  for (const job of inMemoryOutboundJobs.values()) {
    if (job.business_id === businessId) {
      results.push(job);
    }
  }
  return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Reset test helper
 */
export function resetOutboundJobsTestState(): void {
  inMemoryOutboundJobs.clear();
}
