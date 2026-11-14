import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export const authRouter = Router();

function normalizeAuthEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
}

function isPlausibleAuthEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getPublicAuthClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

authRouter.post('/signup', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, message: 'Valid email aur 8–128 character password zaroori hai.' });
  }
  const supabase = getPublicAuthClient();
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase Auth server par configure nahi hai.' });
  try {
    const redirectTo = process.env.AUTH_EMAIL_REDIRECT_URL || 'https://gajendravishwakarma.github.io/business-doctor-Ai/';
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name }, emailRedirectTo: redirectTo },
    });
    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.status(201).json({
      success: true,
      needsEmailVerification: !data.session,
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      session: data.session ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at } : null,
      message: data.session ? 'Account ban gaya. Ab business details bharein.' : 'Account request ho gayi. Email verify karke login karein.',
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Signup abhi complete nahi ho saka.' });
  }
});


authRouter.post('/verify', async (req: Request, res: Response) => {
  const tokenHash = typeof req.body?.token_hash === 'string' ? req.body.token_hash : '';
  const type = typeof req.body?.type === 'string' ? req.body.type : '';
  if (!tokenHash || !['signup', 'email', 'email_change', 'recovery'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Confirmation link invalid ya expire ho gaya hai.' });
  }
  const supabase = getPublicAuthClient();
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase Auth server par configure nahi hai.' });
  try {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'signup' | 'email' | 'email_change' | 'recovery' });
    if (error || !data.session) return res.status(400).json({ success: false, message: error?.message || 'Email verification complete nahi hui.' });
    return res.json({ success: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at } });
  } catch {
    return res.status(500).json({ success: false, message: 'Email verification abhi complete nahi ho saki.' });
  }
});


authRouter.post('/resend-verification', async (req: Request, res: Response) => {
  const email = normalizeAuthEmail(req.body?.email);
  if (!isPlausibleAuthEmail(email)) {
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL', message: 'Enter the registered email in name@example.com format.' });
  }
  const supabase = getPublicAuthClient();
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase Auth server par configure nahi hai.' });
  try {
    const redirectTo = process.env.AUTH_EMAIL_REDIRECT_URL || 'https://gajendravishwakarma.github.io/business-doctor-Ai/';
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } });
    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.json({ success: true, message: 'Agar is email par verification pending hai, to naya confirmation email bhej diya gaya hai. Inbox aur Spam check karein.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Verification email abhi resend nahi ho saka.' });
  }
});


authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const email = normalizeAuthEmail(req.body?.email);
  if (!isPlausibleAuthEmail(email)) {
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL', message: 'Enter the registered email in name@example.com format.' });
  }
  const supabase = getPublicAuthClient();
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase Auth server par configure nahi hai.' });
  try {
    const redirectTo = process.env.AUTH_EMAIL_REDIRECT_URL || 'https://gajendravishwakarma.github.io/business-doctor-Ai/';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.json({ success: true, message: 'Agar is email par account hai, password reset link bhej diya gaya hai. Inbox aur Spam check karein.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Password reset request abhi complete nahi ho saki.' });
  }
});

authRouter.post('/update-password', async (req: Request, res: Response) => {
  const accessToken = typeof req.body?.access_token === 'string' ? req.body.access_token : '';
  const refreshToken = typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!accessToken || !refreshToken || password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, message: 'Valid recovery session aur 8–128 character naya password zaroori hai.' });
  }
  const supabase = getPublicAuthClient();
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase Auth server par configure nahi hai.' });
  try {
    const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError) return res.status(401).json({ success: false, message: 'Password reset session invalid ya expire ho gaya hai. Naya reset link mangayein.' });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.json({ success: true, message: 'Password successfully update ho gaya. Ab naye password se Login karein.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Password update abhi complete nahi ho saka.' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email aur password bharein.' });
  const supabase = getPublicAuthClient();
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase Auth server par configure nahi hai.' });
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      const code = error?.code === 'email_not_confirmed' ? 'email_not_confirmed' : 'invalid_credentials';
      const message = code === 'email_not_confirmed' ? 'Email not confirmed' : 'Invalid login credentials';
      return res.status(401).json({ success: false, code, message });
    }
    return res.json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Login abhi complete nahi ho saka.' });
  }
});
