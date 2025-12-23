import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { message, portfolioContext } = JSON.parse(event.body || '{}');
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }),
        };
    }

    try {
        const systemPrompt = `Sen "Portföy Cepte" uygulamasının uzman yapay zeka finansal danışmanısın. 
Kullanıcının portföy verileri aşağıdadır. Bu verilere dayanarak kullanıcıya Türkçe, samimi, profesyonel ve güven verici yanıtlar ver. 
Asla kesin yatırım tavsiyesi verme (Yatırım Tavsiyesi Değildir - YTD hatırlatması yapabilirsin). 

KULLANICI PORTFÖYÜ:
${JSON.stringify(portfolioContext, null, 2)}

Yanıtlarında markdown formatını (kalın yazılar, listeler, emojiler) etkili kullan.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `${systemPrompt}\n\nKullanıcı Sorusu: ${message}` }]
                }]
            })
        });

        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Üzgünüm, şu an yanıt veremiyorum.';

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ text: aiResponse }),
        };
    } catch (error: any) {
        console.error('Gemini API Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'AI servisi ile iletişim kurulurken bir hata oluştu.' }),
        };
    }
};
