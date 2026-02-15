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
    // 公式・オフィシャル系（重ペナルティ）
    { word: '公式サイト', weight: 5 }, { word: '公式ページ', weight: 5 },
    { word: '公式ショップ', weight: 5 }, { word: '公式ストア', weight: 5 },
    { word: '公式', weight: 3 }, { word: 'オフィシャル', weight: 4 },
    { word: 'official', weight: 4 }, { word: '公式通販', weight: 5 },
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
    'mercari.com', 'zozo.jp', 'shopping.yahoo.co.jp', 'qoo10.jp',
    'wikipedia.org', 'wikiwand.com', 'weblio.jp', 'kotobank.jp',
    'note.com', 'qiita.com', 'zenn.dev', 'teratail.com',
    'yahoo.co.jp', 'yahoo.com', 'msn.com',
    'kakaku.com', 'cosme.net', 'mybest.com', 'the360.life', 'rentry.jp',
    'tabelog.com', 'hotpepper.jp', 'gnavi.co.jp', 'retty.me',
    'hitosara.com', 'ubereats.com', 'demae-can.com',
    'jalan.net', 'booking.com', 'trivago.jp', 'ikyu.com',
    'expedia.co.jp', 'agoda.com', 'hotels.com', 'airbnb.jp',
    'jtb.co.jp', 'his-j.com', 'rurubu.travel',
    'suumo.jp', 'homes.co.jp', 'athome.co.jp', 'chintai.net',
    'mynavi.jp', 'rikunabi.com', 'doda.jp', 'en-japan.com',
    'type.jp', 'indeed.com', 'wantedly.com',
    'nikkei.com', 'asahi.com', 'mainichi.jp', 'yomiuri.co.jp',
    'sankei.com', 'nhk.or.jp', 'itmedia.co.jp', 'gizmodo.jp',
    'gigazine.net', 'j-cast.com', 'oricon.co.jp', 'prtimes.jp',
    'president.jp', 'diamond.jp', 'toyokeizai.net',
    'livedoor.com', 'naver.jp', 'matomame.jp',
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
    'youtube.com', 'tiktok.com', 'linkedin.com', 'pinterest.com',
    'ameblo.jp', 'fc2.com', 'hatena.ne.jp', 'hatenablog.com',
    'hatenablog.jp', 'seesaa.net', 'exblog.jp',
    'cookpad.com', 'delishkitchen.tv', 'kurashiru.com',
    'hotpepper-beauty.com', 'dmm.com', 'nifty.com',
    'biglobe.ne.jp', 'goo.ne.jp', 'excite.co.jp',
];

const COMMERCIAL_PATH_PATTERNS = [
    /\/(?:shop|store|product|item|buy|cart|checkout|order)/i,
    /\/(?:booking|reserve|reservation|plan|yoyaku)/i,
    /\/(?:price|pricing|campaign|sale|coupon|discount)/i,
    /\/(?:lp|landing|promo|offer|deal)/i,
    /\/(?:compare|hikaku|ranking|osusume)/i,
];

const COMMERCIAL_DOMAIN_KEYWORDS = [
    'shop', 'store', 'mall', 'buy', 'market',
    'hotel', 'travel', 'tour', 'booking', 'reserve',
    'navi', 'guide', 'hikaku', 'compare', 'search',
    'job', 'career', 'recruit', 'agent',
    'news', 'media', 'press', 'times',
    'clinic', 'salon', 'beauty', 'estate', 'fudosan',
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
    if (/\.co\.jp$|\.or\.jp$|\.ne\.jp$|\.go\.jp$|\.ac\.jp$/.test(domain)) brandScore += 1;

    // ドメイン名に商業キーワード
    for (const kw of COMMERCIAL_DOMAIN_KEYWORDS) {
        if (domain.includes(kw)) { brandScore += 2; break; }
    }

    // URLパスに商業パターン
    for (const pattern of COMMERCIAL_PATH_PATTERNS) {
        if (pattern.test(result.url)) { brandScore += 2; break; }
    }

    if (/プライバシーポリシー|privacy.?policy/i.test(html)) brandScore += 0.5;
    if (/会社概要|企業情報|corporate/i.test(html)) brandScore += 1;
    if (/特定商取引法|特商法|運営会社/i.test(html)) brandScore += 2;
    if (/広告掲載|スポンサー|提供元|PR記事|タイアップ/i.test(html)) brandScore += 2;

    // Rank Penalty
    const rankPenalty = Math.max(0, 10 - result.rank);

    // AntiScore (0-100, 50が中立)
    const rawScore = 50 + (personalScore * 3) - (seoScore * 2) - (adScore * 2) - (brandScore * 3) - rankPenalty;
    const antiScore = Math.max(0, Math.min(100, rawScore));

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
    const settings = await chrome.storage.sync.get(['filterStrength', 'customBlacklist']);
    const strength = settings.filterStrength || 'medium';
    const customBL = settings.customBlacklist || [];

    // ブラックリスト結合
    const effectiveBlacklist = [...BLACKLIST_DOMAINS, ...customBL];

    function isEffectiveBlacklisted(url) {
        const domain = extractDomain(url);
        return effectiveBlacklist.some(bl => domain === bl || domain.endsWith('.' + bl));
    }

    // ブラックリスト除外
    const filtered = results.filter(r => !isEffectiveBlacklisted(r.url));

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
