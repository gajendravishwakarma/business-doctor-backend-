import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth, getServerSupabaseClient } from '../auth';

export const businessOnboardingRouter = Router();

const allowedTypes = new Set(['retail', 'service', 'restaurant', 'salon', 'hybrid', 'other']);
const allowedMaturity = new Set(['existing_complete', 'existing_partial', 'new_business', 'existing_no_history']);
const allowedStages = new Set(['new', 'early', 'growing', 'established']);

businessOnboardingRouter.post('/onboard', requireAuth({ requireBusiness: false }), async (req: Request, res: Response) => {
  const user = req.auth;
  if (!user?.id) {
    return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Please sign in again.' });
  }

  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 120) {
    return res.status(400).json({ success: false, code: 'INVALID_BUSINESS_NAME', message: 'Business name must be 2–120 characters.' });
  }

  const businessType = typeof body.businessType === 'string' && allowedTypes.has(body.businessType) ? body.businessType : 'other';
  const maturity = typeof body.dataMaturity === 'string' && allowedMaturity.has(body.dataMaturity) ? body.dataMaturity : 'new_business';
  const stage = typeof body.businessStage === 'string' && allowedStages.has(body.businessStage) ? body.businessStage : 'new';
  const website = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim().slice(0, 500) : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : null;
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : user.email;
  const industry = typeof body.industry === 'string' ? body.industry.trim().slice(0, 120) : '';
  const location = typeof body.location === 'string' ? body.location.trim().slice(0, 180) : '';
  const country = typeof body.country === 'string' ? body.country.trim().slice(0, 80) : 'India';
  const currency = typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) ? body.currency : 'INR';
  const currencySymbol = typeof body.currencySymbol === 'string' ? body.currencySymbol.trim().slice(0, 8) : '₹';
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim().slice(0, 80) : 'Asia/Kolkata';
  const description = typeof body.targetCustomers === 'string' ? body.targetCustomers.trim().slice(0, 500) : '';

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return res.status(503).json({ success: false, code: 'DATABASE_NOT_CONFIGURED', message: 'Business database is not configured on the server.' });
  }

  try {
    const { data, error } = await supabase.rpc('create_business_with_owner', {
      p_business_id: randomUUID(),
      p_user_id: user.id,
      p_name: name,
      p_business_type: businessType,
      p_website: website || '',
      p_phone: phone || '',
      p_email: email || '',
      p_user_name: typeof body.ownerName === 'string' ? body.ownerName.trim().slice(0, 120) : '',
      p_business_age_stage: stage,
      p_data_maturity_mode: maturity,
      p_industry: industry,
      p_location: location,
      p_country: country,
      p_currency: currency,
      p_currency_symbol: currencySymbol,
      p_timezone: timezone,
      p_description: description,
    });

    if (error) {
      console.error('Business onboarding RPC failed:', { code: error.code, message: error.message });
      return res.status(400).json({ success: false, code: 'BUSINESS_CREATE_FAILED', message: 'Business create nahi ho paya. Database setup verify karke dobara try karein.' });
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;
    return res.status(201).json({
      success: true,
      business: {
        id: result?.business_id,
        name: result?.name || name,
        role: result?.role || 'owner',
        status: result?.status || 'created',
      },
    });
  } catch (error) {
    console.error('Business onboarding failed:', error);
    return res.status(500).json({ success: false, code: 'BUSINESS_CREATE_ERROR', message: 'Unexpected server error while creating business.' });
  }
});
