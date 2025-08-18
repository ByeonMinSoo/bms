import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI } from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { message, sessionId } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: '메시지가 필요합니다.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // 키가 없는 경우에도 프론트가 동작하도록 기본 응답 제공
      return res.status(200).json({
        success: true,
        response: `임시 응답: "${message}"에 대한 처리를 위해 OpenAI API 키가 필요합니다. 관리자에게 문의해주세요.`,
        sessionId: sessionId || null
      });
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '너는 HR 도메인 어시스턴트다. 간결하고 정확히 한국어로 답해라.' },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const content = completion.choices?.[0]?.message?.content || '응답을 생성할 수 없습니다.';

    return res.status(200).json({ success: true, response: content, sessionId: sessionId || null });
  } catch (error) {
    console.error('chat/message error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}


