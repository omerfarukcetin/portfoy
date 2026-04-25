import axios from 'axios';

export interface NewsItem {
    title: string;
    link: string;
    pubDate: string;
    source: string;
    timeAgo?: string;
}

const GOOGLE_NEWS_RSS_BASE = 'https://news.google.com/rss/search';

export const NewsService = {
    async fetchNews(keywords: string[]): Promise<NewsItem[]> {
        try {
            // Construct query: "Borsa İstanbul OR Altın OR THYAO OR ..."
            // Limit keywords to avoid too long URL
            const query = keywords.slice(0, 10).join(' OR ');
            const encodedQuery = encodeURIComponent(query);

            const url = `${GOOGLE_NEWS_RSS_BASE}?q=${encodedQuery}&hl=tr&gl=TR&ceid=TR:tr`;

            console.log('Fetching news from:', url);

            const response = await axios.get(url);
            const xml = response.data;

            return this.parseRSS(xml);
        } catch (error) {
            console.error('Error fetching news:', error);
            // Return empty array instead of throwing, so UI doesn't break
            return [];
        }
    },

    parseRSS(xml: string): NewsItem[] {
        const items: NewsItem[] = [];

        // Simple regex-based XML parsing to avoid adding heavy dependencies
        // Matches content between <item> tags
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const itemContent = match[1];

            const titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
            const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
            const dateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
            const sourceMatch = itemContent.match(/<source.*?>([\s\S]*?)<\/source>/);

            if (titleMatch && linkMatch) {
                // Clean up title
                let title = titleMatch[1].replace('<![CDATA[', '').replace(']]>', '').trim();
                const source = sourceMatch ? sourceMatch[1].trim() : '';

                // Remove source suffix if present
                if (source && title.endsWith(source)) {
                    title = title.substring(0, title.lastIndexOf('-')).trim();
                }

                // Deduplication Check
                // Check if a very similar title already exists
                const isDuplicate = items.some(existing => {
                    // Exact match
                    if (existing.title === title) return true;

                    // Partial match (first 20 chars) - simplistic but effective for "breaking news" repetition
                    if (existing.title.substring(0, 20) === title.substring(0, 20)) return true;

                    return false;
                });

                if (!isDuplicate) {
                    items.push({
                        title: title,
                        link: linkMatch[1],
                        pubDate: dateMatch ? dateMatch[1] : '',
                        source: source,
                        timeAgo: dateMatch ? this.calculateTimeAgo(dateMatch[1]) : ''
                    });
                }
            }

            // Limit to 20 candidates initially, we will slice later or return filtered list
            if (items.length >= 20) break;
        }

        return items;
    },

    processNews(items: NewsItem[]): NewsItem[] {
        // Additional processing if needed
        return items;
    },

    calculateTimeAgo(dateString: string): string {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

            if (diffHours < 1) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                return `${diffMinutes}dk önce`;
            } else if (diffHours < 24) {
                return `${diffHours}s önce`;
            } else {
                const diffDays = Math.floor(diffHours / 24);
                return `${diffDays}g önce`;
            }
        } catch (e) {
            return '';
        }
    }
};
