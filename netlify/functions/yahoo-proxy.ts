import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
    const { q, category } = event.queryStringParameters || {};

    if (!q) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing query parameter' }),
        };
    }

    try {
        const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0`;

        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance API error: ${response.status}`);
        }

        const data = await response.json();

        // Filter based on category
        let filteredQuotes = data.quotes;
        if (category === 'BIST') {
            filteredQuotes = data.quotes.filter(
                (quote: any) =>
                    quote.symbol.endsWith('.IS') &&
                    (quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF')
            );
        } else if (category === 'ABD') {
            filteredQuotes = data.quotes.filter(
                (quote: any) =>
                    (quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF') &&
                    !quote.symbol.includes('.')
            );
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ quotes: filteredQuotes }),
        };
    } catch (error: any) {
        console.error('Proxy error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
