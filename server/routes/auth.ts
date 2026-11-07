import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export const authRouter = Router();

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
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name } },
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

authRouter.post('/login', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email aur password bharein.' });
  const supabase = getPublicAuthClient();
  if (!supabase) return res.status(503).json({ success: false, message: 'Supabase Auth server par configure nahi hai.' });
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) return res.status(401).json({ success: false, message: 'Email/password check karein ya pehle email verify karein.' });
    return res.json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Login abhi complete nahi ho saka.' });
  }
});
