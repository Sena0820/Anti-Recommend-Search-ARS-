// =============================================================
// Anti-Recommend Search (ARS) — Background Service Worker
// Google検索結果のページHTML取得・解析を担当
// =============================================================

// ── ページHTML取得 ──
async function fetchPageHtml(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ARS/1.0)',
            }
        });
        clearTimeout(timeoutId);

        if (!response.ok) return '';
        const text = await response.text();
        // 取得サイズ制限 (100KB)
        return text.substring(0, 100000);
    } catch {
        return '';
    }
}

// ── 並列ページ取得 ──
async function fetchPagesParallel(urls, concurrency = 5) {
    const results = {};
    const queue = [...urls];

    async function worker() {
        while (queue.length > 0) {
            const url = queue.shift();
            results[url] = await fetchPageHtml(url);
        }
    }

    const workers = Array.from(
        { length: Math.min(concurrency, urls.length) },
        () => worker()
    );
    await Promise.all(workers);
    return results;
}

// ── 定数 ──
const SEO_WORDS = [
    { word: 'おすすめ', weight: 2 }, { word: 'ランキング', weight: 2 },
    { word: '比較', weight: 1.5 }, { word: '最新', weight: 1 },
    { word: '徹底', weight: 1.5 }, { word: 'まとめ', weight: 2 },
    { word: '厳選', weight: 1.5 }, { word: '人気', weight: 1 },
    { word: '口コミ', weight: 1.5 }, { word: 'レビュー', weight: 1 },
    { word: '評判', weight: 1 }, { word: '必見', weight: 1.5 },
    { word: '完全ガイド', weight: 2 }, { word: '保存版', weight: 1.5 },
    { word: '決定版', weight: 2 }, { word: '選', weight: 0.5 },
];

const PERSONAL_WORDS = [
    { word: '私', weight: 1 }, { word: '僕', weight: 1.5 },
    { word: '俺', weight: 1.5 }, { word: '自分', weight: 0.8 },
    { word: '体験', weight: 2 }, { word: '経験', weight: 1.5 },
    { word: '感想', weight: 2 }, { word: '使ってみた', weight: 3 },
    { word: '行ってきた', weight: 3 }, { word: '食べてきた', weight: 3 },
    { word: '買ってみた', weight: 3 }, { word: '試してみた', weight: 3 },
    { word: '日記', weight: 2 }, { word: 'ブログ', weight: 1 },
];

const AFFILIATE_PATTERNS = [
    /[?&]ref=/i, /[?&]affiliate=/i, /[?&]tag=/i,
    /amazon\.co\.jp.*[?&]tag=/i, /rakuten\.co\.jp.*[?&]affiliate/i,
    /a8\.net/i, /valuecommerce/i, /accesstrade/i,
    /moshimo\.com/i, /felmat/i, /rentracks/i,
];

const BLACKLIST_DOMAINS = [
    'amazon.co.jp', 'amazon.com', 'rakuten.co.jp', 'rakuten.com',
    'wikipedia.org', 'note.com', 'qiita.com', 'zenn.dev',
    'yahoo.co.jp', 'yahoo.com', 'kakaku.com', 'tabelog.com',
    'hotpepper.jp', 'gnavi.co.jp', 'retty.me', 'mynavi.jp',
    'rikunabi.com', 'doda.jp', 'nikkei.com', 'asahi.com',
    'mainichi.jp', 'yomiuri.co.jp', 'sankei.com', 'nhk.or.jp',
    'livedoor.com', 'fc2.com', 'hatena.ne.jp',
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
    'youtube.com', 'tiktok.com', 'linkedin.com', 'pinterest.com',
    'cookpad.com', 'mercari.com', 'zozo.jp',
];

function extractDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
}

function isBlacklisted(url) {
    const domain = extractDomain(url);
    return BLACKLIST_DOMAINS.some(bl => domain === bl || domain.endsWith('.' + bl));
}

// ── 解析ロジック ──
function analyzeResultInBackground(result, html, strength) {
    const text = (result.snippet || '') + ' ' + (result.title || '');
    const strengthMultiplier = strength === 'strong' ? 1.5 : strength === 'weak' ? 0.5 : 1;

    // 個人性スコア
    let personalScore = 0;
    for (const { word, weight } of PERSONAL_WORDS) {
        const matches = text.match(new RegExp(word, 'gi'));
        if (matches) personalScore += matches.length * weight;
    }
    personalScore = Math.min(personalScore, 20);

    // SEOスコア
    let seoScore = 0;
    for (const { word, weight } of SEO_WORDS) {
        const matches = text.match(new RegExp(word, 'gi'));
        if (matches) seoScore += matches.length * weight * strengthMultiplier;
    }

    // 広告スコア
    let adScore = 0;
    for (const pattern of AFFILIATE_PATTERNS) {
        const matches = html.match(new RegExp(pattern.source, 'gi'));
        if (matches) adScore += matches.length * 2;
    }

    // ブランドスコア
    let brandScore = 0;
    const domain = extractDomain(result.url);
    if (/\.co\.jp$|\.or\.jp$|\.ne\.jp$|\.go\.jp$/.test(domain)) brandScore += 1;
    if (/プライバシーポリシー|privacy.?policy/i.test(html)) brandScore += 0.5;
    if (/会社概要|企業情報|corporate/i.test(html)) brandScore += 1;

    // Rank Penalty
    const rankPenalty = Math.max(0, 20 - result.rank);

    // AntiScore
    const antiScore = (personalScore * 3) - (seoScore * 2) - (adScore * 2) - (brandScore * 3) - rankPenalty;

    // 判定理由
    const reasons = [];
    if (personalScore > 3) reasons.push(`一人称表現 多め (${personalScore.toFixed(1)})`);
    if (seoScore < 2) reasons.push('SEOワード含有率 低');
    else if (seoScore > 5) reasons.push(`SEOワード多数 (${seoScore.toFixed(1)})`);
    if (adScore === 0) reasons.push('アフィリエイトリンク 0件');
    else reasons.push(`アフィリエイトリンク ${Math.round(adScore / 2)}件`);
    if (brandScore < 2) reasons.push('独自ドメイン');
    else reasons.push('大手ドメインの可能性');
    reasons.push(`検索順位 ${result.rank}位`);

    return {
        ...result,
        personalScore,
        seoScore,
        adScore,
        brandScore,
        antiScore,
        reasons,
        personalIndex: Math.min(100, Math.round(personalScore * 5)),
        commercialIndex: Math.min(100, Math.round((seoScore + adScore + brandScore) * 3)),
    };
}

// ── メッセージハンドラ ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ARS_ANALYZE') {
        handleAnalyze(message.data).then(sendResponse);
        return true; // 非同期レスポンス
    }
});

// ── メイン解析処理 ──
async function handleAnalyze(data) {
    const { results } = data;

    // 設定を取得
    const settings = await chrome.storage.sync.get(['filterStrength']);
    const strength = settings.filterStrength || 'medium';

    // ブラックリスト除外
    const filtered = results.filter(r => !isBlacklisted(r.url));

    // 並列でページ取得（上位20件、パフォーマンスのため）
    const urlsToFetch = filtered.slice(0, 20).map(r => r.url);
    const htmlMap = await fetchPagesParallel(urlsToFetch);

    // スコア算出
    const scored = filtered.map(r => {
        const html = htmlMap[r.url] || '';
        return analyzeResultInBackground(r, html, strength);
    });

    // スコア順にソート（高い方が良い）
    scored.sort((a, b) => b.antiScore - a.antiScore);

    return scored.slice(0, 20);
}
