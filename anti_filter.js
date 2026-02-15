// =============================================================
// Anti-Recommend Search (ARS) — Filtering & Scoring Engine
// =============================================================

const ARS = (() => {
  // ── ブラックリストドメイン ──
  const BLACKLIST_DOMAINS = [
    'amazon.co.jp', 'amazon.com',
    'rakuten.co.jp', 'rakuten.com',
    'wikipedia.org',
    'note.com',
    'qiita.com',
    'zenn.dev',
    'yahoo.co.jp', 'yahoo.com',
    'kakaku.com',
    'tabelog.com',
    'hotpepper.jp',
    'gnavi.co.jp',
    'retty.me',
    'mynavi.jp',
    'rikunabi.com',
    'doda.jp',
    'nikkei.com',
    'asahi.com',
    'mainichi.jp',
    'yomiuri.co.jp',
    'sankei.com',
    'nhk.or.jp',
    'livedoor.com',
    'fc2.com',
    'hatena.ne.jp',
    'twitter.com', 'x.com',
    'facebook.com',
    'instagram.com',
    'youtube.com',
    'tiktok.com',
    'linkedin.com',
    'pinterest.com',
    'cookpad.com',
    'mercari.com',
    'zozo.jp',
    '価格.com',
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

    if (html) {
      // プライバシーポリシーリンクの存在
      if (/プライバシーポリシー|privacy.?policy/i.test(html)) {
        score += 0.5;
      }
      // 会社概要の存在
      if (/会社概要|企業情報|corporate/i.test(html)) {
        score += 1;
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
    return Math.max(0, 20 - rank);
  }

  // ────────────────────────────────
  // 最終アンチスコア算出
  // ────────────────────────────────
  function calcAntiScore({ personalScore, seoScore, adScore, brandScore, rank }) {
    const rankPenalty = calcRankPenalty(rank);
    return (
      (personalScore * 3) -
      (seoScore * 2) -
      (adScore * 2) -
      (brandScore * 3) -
      rankPenalty
    );
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

  // Public API
  return {
    isBlacklisted,
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
