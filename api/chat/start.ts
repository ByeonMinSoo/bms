import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return res.status(200).json({ success: true, sessionId, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('chat/start error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}


