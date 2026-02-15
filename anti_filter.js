// =============================================================
// Anti-Recommend Search (ARS) — Filtering & Scoring Engine
// =============================================================

const ARS = (() => {
    // ── ブラックリストドメイン ──
    const BLACKLIST_DOMAINS = [
        // EC・ショッピング
        'amazon.co.jp', 'amazon.com', 'rakuten.co.jp', 'rakuten.com',
        'mercari.com', 'zozo.jp', 'shopping.yahoo.co.jp', 'paypaymall.yahoo.co.jp',
        'store.line.me', 'qoo10.jp', 'au-commerce.jp',
        // 百科事典・Wiki
        'wikipedia.org', 'wikiwand.com', 'weblio.jp', 'kotobank.jp',
        // テック・開発者向け大手（Qiita/ZennはSEO強めなので維持、Noteは個人も多いが商業も多い…一旦解除してスコアで判断）
        'qiita.com', 'zenn.dev', 'teratail.com',
        // ポータル・検索
        'yahoo.co.jp', 'yahoo.com', 'msn.com', 'bing.com',
        // 価格比較・口コミ
        'kakaku.com', 'cosme.net', 'mybest.com', 'the360.life',
        'rentry.jp', 'roomclip.jp',
        // グルメ・飲食
        'tabelog.com', 'hotpepper.jp', 'gnavi.co.jp', 'retty.me',
        'hitosara.com', 'yelp.co.jp', 'ubereats.com', 'demae-can.com',
        // 旅行・宿泊
        'jalan.net', 'booking.com', 'trivago.jp', 'ikyu.com',
        'travel.rakuten.co.jp', 'expedia.co.jp', 'agoda.com',
        'hotels.com', 'airbnb.jp', 'jtb.co.jp', 'his-j.com',
        'rurubu.travel', 'yahoo-travel.jp',
        // 不動産・住宅
        'suumo.jp', 'homes.co.jp', 'athome.co.jp', 'chintai.net',
        // 求人・転職
        'mynavi.jp', 'rikunabi.com', 'doda.jp', 'en-japan.com',
        'type.jp', 'indeed.com', 'wantedly.com', 'green-japan.com',
        // ニュース・メディア
        'nikkei.com', 'asahi.com', 'mainichi.jp', 'yomiuri.co.jp',
        'sankei.com', 'nhk.or.jp', 'itmedia.co.jp', 'gizmodo.jp',
        'gigazine.net', 'huffingtonpost.jp', 'buzzfeed.com',
        'withnews.jp', 'j-cast.com', 'oricon.co.jp', 'natalie.mu',
        'prtimes.jp', 'president.jp', 'diamond.jp', 'toyokeizai.net',
        // まとめ系
        'livedoor.com', 'naver.jp', 'matomame.jp',
        // SNS
        'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
        'youtube.com', 'tiktok.com', 'linkedin.com', 'pinterest.com',
        'threads.net', 'reddit.com',
        // ブログプラットフォーム（大手だが個人ブログの宝庫なので除外しない）
        // 'ameblo.jp', 'fc2.com', 'hatena.ne.jp', 'hatenablog.com',
        // 'hatenablog.jp', 'seesaa.net', 'blog.jp', 'livedoor.blog',
        // 'exblog.jp', 'note.com',
        // レシピ・生活
        'cookpad.com', 'delishkitchen.tv', 'kurashiru.com',
        // 健康・美容
        'cosme.net', 'hotpepper-beauty.com', 'beauty.yahoo.co.jp',
        // その他大手
        'dmm.com', 'nifty.com', 'biglobe.ne.jp', 'so-net.ne.jp',
        'ocn.ne.jp', 'goo.ne.jp', 'excite.co.jp',
    ];

    // ── SEOワード（重み付き）──
    const SEO_WORDS = [
        { word: 'おすすめ', weight: 2 },
        { word: 'ランキング', weight: 2 },
        { word: '比較', weight: 1.5 },
        { word: '最新', weight: 1 },
        { word: '徹底', weight: 1.5 },
        { word: 'まとめ', weight: 2 },
        { word: '厳選', weight: 1.5 },
        { word: '人気', weight: 1 },
        { word: '口コミ', weight: 1.5 },
        { word: 'レビュー', weight: 1 },
        { word: '評判', weight: 1 },
        { word: '必見', weight: 1.5 },
        { word: '完全ガイド', weight: 2 },
        { word: '保存版', weight: 1.5 },
        { word: '決定版', weight: 2 },
        { word: '〇選', weight: 2 },
        { word: '選', weight: 0.5 },
        // 公式・オフィシャル系（重ペナルティ）
        { word: '公式サイト', weight: 5 },
        { word: '公式ページ', weight: 5 },
        { word: '公式ショップ', weight: 5 },
        { word: '公式ストア', weight: 5 },
        { word: '公式ブログ', weight: 3 },
        { word: '公式', weight: 3 },
        { word: 'オフィシャル', weight: 4 },
        { word: 'official', weight: 4 },
        { word: '公式通販', weight: 5 },
    ];

    // ── 一人称ワード（個人性判定）──
    const PERSONAL_WORDS = [
        { word: '私', weight: 1 },
        { word: '僕', weight: 1.5 },
        { word: '俺', weight: 1.5 },
        { word: '自分', weight: 0.8 },
        { word: '体験', weight: 2 },
        { word: '経験', weight: 1.5 },
        { word: '感想', weight: 2 },
        { word: '使ってみた', weight: 3 },
        { word: '行ってきた', weight: 3 },
        { word: '食べてきた', weight: 3 },
        { word: '買ってみた', weight: 3 },
        { word: '試してみた', weight: 3 },
        { word: '日記', weight: 2 },
        { word: 'ブログ', weight: 1 },
    ];

    // ── アフィリエイトパターン ──
    const AFFILIATE_PATTERNS = [
        /[?&]ref=/i,
        /[?&]affiliate=/i,
        /[?&]tag=/i,
        /amazon\.co\.jp.*[?&]tag=/i,
        /rakuten\.co\.jp.*[?&]affiliate/i,
        /a8\.net/i,
        /valuecommerce/i,
        /accesstrade/i,
        /moshimo\.com/i,
        /felmat/i,
        /rentracks/i,
    ];

    // ── 大手ドメインパターン ──
    const BRAND_PATTERNS = [
        /\.co\.jp$/,
        /\.or\.jp$/,
        /\.ne\.jp$/,
        /\.go\.jp$/,
        /\.ac\.jp$/,
    ];

    // ── 商業URLパスパターン（予約・購入・商品ページ等）──
    const COMMERCIAL_PATH_PATTERNS = [
        /\/(?:shop|store|product|item|buy|cart|checkout|order)/i,
        /\/(?:booking|reserve|reservation|plan|yoyaku)/i,
        /\/(?:price|pricing|campaign|sale|coupon|discount)/i,
        /\/(?:lp|landing|promo|offer|deal)/i,
        /\/(?:compare|hikaku|ranking|osusume)/i,
        /\/(?:ad|sponsor|pr)\//i,
    ];

    // ── ドメイン名に含まれる商業キーワード ──
    const COMMERCIAL_DOMAIN_KEYWORDS = [
        'mall', 'market', 'auction', // shop, storeは個人商店にも使われるので削除
        'search', 'price', 'compare', 'hikaku', 'navi',
        'news', 'press', // mediaは個人でも使う
        'recruit', 'career', 'job', 'agent',
        'corp', 'inc', 'official', // 企業・公式
    ];

    // ── レトロ・個人サイトパターン（加点要素） ──
    const INDIE_URL_PATTERNS = [
        /~[a-zA-Z0-9]+/,   // チルダ（ユーザーディレクトリ）
        /\.html?$/,        // 静的HTML
        /cgi-bin/,         // CGI
        /diary/, /profile/, /link/, // 個人サイトによくあるパス
    ];

    // ────────────────────────────────
    // ドメイン抽出
    // ────────────────────────────────
    function extractDomain(url) {
        try {
            const u = new URL(url);
            return u.hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    }

    // ────────────────────────────────
    // (A) ブラックリスト判定
    // ────────────────────────────────
    function isBlacklisted(url) {
        const domain = extractDomain(url);
        return BLACKLIST_DOMAINS.some(bl =>
            domain === bl || domain.endsWith('.' + bl)
        );
    }

    // ────────────────────────────────
    // (B) SEOワードスコア
    // ────────────────────────────────
    function calcSeoScore(text) {
        if (!text) return 0;
        let score = 0;
        for (const { word, weight } of SEO_WORDS) {
            const regex = new RegExp(word, 'gi');
            const matches = text.match(regex);
            if (matches) {
                score += matches.length * weight;
            }
        }
        return score;
    }

    // ────────────────────────────────
    // (C) 広告スコア
    // ────────────────────────────────
    function calcAdScore(html) {
        if (!html) return 0;
        let affiliateCount = 0;
        for (const pattern of AFFILIATE_PATTERNS) {
            const matches = html.match(new RegExp(pattern.source, 'gi'));
            if (matches) {
                affiliateCount += matches.length;
            }
        }
        return affiliateCount * 2;
    }

    // ────────────────────────────────
    // (D) ブランドスコア（大手ドメイン推定）
    // ────────────────────────────────
    function calcBrandScore(url, html) {
        const domain = extractDomain(url);
        let score = 0;

        // ブラックリストに近いドメイン
        if (BLACKLIST_DOMAINS.some(bl => domain.includes(bl.split('.')[0]))) {
            score += 3;
        }

        // 大手ドメインパターン
        for (const pattern of BRAND_PATTERNS) {
            if (pattern.test(domain)) {
                score += 1;
                break;
            }
        }

        // ドメイン名に商業キーワードが含まれる
        for (const kw of COMMERCIAL_DOMAIN_KEYWORDS) {
            if (domain.includes(kw)) {
                score += 2;
                break;
            }
        }

        // サブドメインが多い（大規模サイトの傾向）
        const subdomainCount = domain.split('.').length;
        if (subdomainCount >= 4) score += 1;

        // URLパスに商業パターン
        for (const pattern of COMMERCIAL_PATH_PATTERNS) {
            if (pattern.test(url)) {
                score += 2;
                break;
            }
        }

        // レトロ・個人サイトボーナス（ブランドスコアからは減算＝個人の可能性アップ）
        for (const pattern of INDIE_URL_PATTERNS) {
            if (pattern.test(url)) {
                score -= 2; // 個人度アップ
            }
        }

        if (html) {
            // プライバシーポリシーリンクの存在
            if (/プライバシーポリシー|privacy.?policy/i.test(html)) {
                score += 0.5;
            }
            // 会社概要の存在
            if (/会社概要|企業情報|corporate/i.test(html)) {
                score += 1;
            }
            // 利用規約・特商法表記（商業サイトの強い指標）
            if (/特定商取引法|特商法|運営会社/i.test(html)) {
                score += 2;
            }
            // 広告・スポンサー表記
            if (/広告掲載|スポンサー|提供元|PR記事|タイアップ/i.test(html)) {
                score += 2;
            }
        }

        return score;
    }

    // ────────────────────────────────
    // 個人性スコア
    // ────────────────────────────────
    function calcPersonalScore(text) {
        if (!text) return 0;
        let score = 0;
        for (const { word, weight } of PERSONAL_WORDS) {
            const regex = new RegExp(word, 'gi');
            const matches = text.match(regex);
            if (matches) {
                score += matches.length * weight;
            }
        }
        // キャップ: 最大20
        return Math.min(score, 20);
    }

    // ────────────────────────────────
    // Rank Penalty
    // ────────────────────────────────
    function calcRankPenalty(rank) {
        return Math.max(0, 10 - rank);
    }

    // ────────────────────────────────
    // 最終アンチスコア算出
    // ────────────────────────────────
    function calcAntiScore({ personalScore, seoScore, adScore, brandScore, rank }) {
        const rankPenalty = calcRankPenalty(rank);
        const raw = 50 +
            (personalScore * 3) -
            (seoScore * 2) -
            (adScore * 2) -
            (brandScore * 3) -
            rankPenalty;
        return Math.max(0, Math.min(100, raw));
    }

    // ────────────────────────────────
    // ページ解析（テキスト抽出用）
    // ────────────────────────────────
    function extractTextFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // script, style, nav, footer, header を除去
        doc.querySelectorAll('script, style, nav, footer, header, aside').forEach(el => el.remove());
        return doc.body ? doc.body.innerText || doc.body.textContent || '' : '';
    }

    // ────────────────────────────────
    // 結果全体を解析
    // ────────────────────────────────
    function analyzeResult(result, html) {
        const text = result.snippet + ' ' + result.title + ' ' + extractTextFromHtml(html || '');
        const personalScore = calcPersonalScore(text);
        const seoScore = calcSeoScore(text);
        const adScore = calcAdScore(html || '');
        const brandScore = calcBrandScore(result.url, html || '');
        const antiScore = calcAntiScore({
            personalScore, seoScore, adScore, brandScore, rank: result.rank
        });

        // 判定理由の生成
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
        };
    }

    // ────────────────────────────────
    // Dynamic Blacklist Addition
    // ────────────────────────────────
    function addBlacklist(domains) {
        if (Array.isArray(domains)) {
            domains.forEach(d => {
                if (d && !BLACKLIST_DOMAINS.includes(d)) {
                    BLACKLIST_DOMAINS.push(d);
                }
            });
        }
    }

    // Public API
    return {
        isBlacklisted,
        addBlacklist,
        calcSeoScore,
        calcAdScore,
        calcBrandScore,
        calcPersonalScore,
        calcRankPenalty,
        calcAntiScore,
        analyzeResult,
        extractTextFromHtml,
        extractDomain,
        BLACKLIST_DOMAINS,
    };
})();

// Export for use in other scripts (content script context)
if (typeof window !== 'undefined') {
    window.ARS = ARS;
}
