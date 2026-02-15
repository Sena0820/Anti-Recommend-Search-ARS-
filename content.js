// =============================================================
// Anti-Recommend Search (ARS) — Content Script
// Google検索結果ページにサイドパネルを注入
// =============================================================

(function () {
    'use strict';

    console.log('[ARS] Content script loaded');

    // 二重注入防止
    if (document.getElementById('ars-panel')) {
        console.log('[ARS] Panel already exists, skipping');
        return;
    }

    // ── Google検索結果からデータ抽出 ──
    function extractGoogleResults() {
        const results = [];
        const seen = new Set();
        let rank = 0;

        // 複数のセレクタパターンで検索結果を取得
        const selectors = [
            '#rso > div > div > div > a[href]',       // 新しいGoogle構造
            '#rso > div > div > a[href]',              // 別パターン
            '#search .g > div > div > div > a[href]',  // 従来パターン
            '#rso .g a[data-ved]',                     // data-ved属性付き
            'div[data-hveid] a[href][data-ved]',       // hveid付き
        ];

        // まず h3 を持つリンクを探す（最も確実）
        const h3Links = document.querySelectorAll('#rso h3');
        console.log(`[ARS] Found ${h3Links.length} h3 elements in #rso`);

        h3Links.forEach((h3) => {
            // h3の親からリンクを探す
            let linkEl = h3.closest('a[href]');
            if (!linkEl) {
                // h3の親要素を遡ってaタグを探す
                let parent = h3.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    linkEl = parent.querySelector('a[href]');
                    if (linkEl && linkEl.href && !linkEl.href.includes('google.com')) break;
                    linkEl = null;
                    parent = parent.parentElement;
                }
            }
            if (!linkEl) return;

            const url = linkEl.href;
            if (!url || url.includes('google.com') || url.includes('google.co.jp/search') || url.startsWith('/') || url.startsWith('javascript:')) return;
            if (seen.has(url)) return;
            seen.add(url);

            // スニペットを探す
            let snippetText = '';
            // h3の親コンテナからスニペットを探す
            let container = h3.closest('[data-hveid]') || h3.closest('.g') || h3.parentElement?.parentElement?.parentElement;
            if (container) {
                // いくつかのセレクタでスニペットを探す
                const snippetEl = container.querySelector('[data-sncf]')
                    || container.querySelector('.VwiC3b')
                    || container.querySelector('[style*="-webkit-line-clamp"]')
                    || container.querySelector('span > em')?.closest('span')?.parentElement;
                if (snippetEl) {
                    snippetText = snippetEl.textContent || '';
                }
            }

            rank++;
            results.push({
                title: h3.textContent || '',
                url: url,
                snippet: snippetText,
                rank: rank,
            });
        });

        // フォールバック: h3が見つからない場合
        if (results.length === 0) {
            console.log('[ARS] h3 method found 0 results, trying fallback selectors');
            document.querySelectorAll('#rso a[href][data-ved] h3, #search a[href] h3').forEach((h3) => {
                const linkEl = h3.closest('a[href]');
                if (!linkEl) return;
                const url = linkEl.href;
                if (!url || url.includes('google.') || seen.has(url)) return;
                seen.add(url);
                rank++;
                results.push({
                    title: h3.textContent || '',
                    url: url,
                    snippet: '',
                    rank: rank,
                });
            });
        }

        console.log(`[ARS] Extracted ${results.length} results`);
        return results;
    }

    // ── 検索キーワード取得 ──
    function getSearchQuery() {
        const input = document.querySelector('textarea[name="q"]')
            || document.querySelector('input[name="q"]');
        const query = input ? input.value : '';
        console.log(`[ARS] Search query: "${query}"`);
        return query;
    }

    // ── スコアに応じた色 ──
    function getScoreColor(score) {
        if (score >= 20) return '#10b981';
        if (score >= 0) return '#f59e0b';
        return '#ef4444';
    }

    // ── スコアバッジ ──
    function getScoreLabel(score) {
        if (score >= 30) return '⭐ 超個人的';
        if (score >= 15) return '✨ 個人的';
        if (score >= 0) return '🔍 中立';
        return '🏢 商業寄り';
    }

    // ── ゲージ ──
    function createGauge(label, value, maxVal, color) {
        const pct = Math.min(100, Math.max(0, (value / maxVal) * 100));
        return `
      <div class="ars-gauge">
        <span class="ars-gauge-label">${label}</span>
        <div class="ars-gauge-bar">
          <div class="ars-gauge-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="ars-gauge-value">${Math.round(pct)}%</span>
      </div>
    `;
    }

    // ── 結果カード生成 ──
    function createResultCard(item, index) {
        const scoreColor = getScoreColor(item.antiScore);
        const label = getScoreLabel(item.antiScore);
        const personalPct = item.personalIndex || 0;
        const commercialPct = item.commercialIndex || 0;

        const card = document.createElement('div');
        card.className = 'ars-card';
        card.style.animationDelay = `${index * 0.05}s`;

        // URLをエスケープ
        const safeUrl = item.url.replace(/"/g, '&quot;');
        const safeTitle = item.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        card.innerHTML = `
      <div class="ars-card-header">
        <span class="ars-rank">#${index + 1}</span>
        <span class="ars-score-badge" style="background:${scoreColor}">${item.antiScore.toFixed(1)}</span>
        <span class="ars-score-label">${label}</span>
      </div>
      <a class="ars-card-title" href="${safeUrl}" target="_blank" rel="noopener">${safeTitle}</a>
      <div class="ars-card-url">${safeUrl}</div>
      <div class="ars-card-gauges">
        ${createGauge('個人性', personalPct, 100, '#10b981')}
        ${createGauge('商業性', commercialPct, 100, '#ef4444')}
      </div>
      <details class="ars-reasons">
        <summary>判定理由</summary>
        <ul>
          ${item.reasons.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </details>
    `;

        return card;
    }

    // ── サイドパネル生成 ──
    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'ars-panel';

        panel.innerHTML = `
      <div class="ars-panel-header">
        <div class="ars-logo">
          <span class="ars-logo-icon">🔮</span>
          <span class="ars-logo-text">ARS</span>
          <span class="ars-logo-sub">Anti-Recommend Search</span>
        </div>
        <button id="ars-close" class="ars-close-btn" title="閉じる">✕</button>
      </div>
      <div class="ars-panel-status">
        <div class="ars-loading">
          <div class="ars-spinner"></div>
          <span>解析中...</span>
        </div>
      </div>
      <div id="ars-results" class="ars-results"></div>
      <div class="ars-panel-footer">
        <span class="ars-footer-text">商業バイアスを除去した検索結果</span>
      </div>
    `;

        document.body.appendChild(panel);
        console.log('[ARS] Panel created');

        document.getElementById('ars-close').addEventListener('click', () => {
            panel.classList.add('ars-panel-hidden');
        });

        return panel;
    }

    // ── トグルボタン ──
    function createToggleButton() {
        const btn = document.createElement('button');
        btn.id = 'ars-toggle';
        btn.className = 'ars-toggle-btn';
        btn.innerHTML = '🔮';
        btn.title = 'ARSパネルを表示';
        btn.addEventListener('click', () => {
            const panel = document.getElementById('ars-panel');
            if (panel) {
                panel.classList.remove('ars-panel-hidden');
            }
        });
        document.body.appendChild(btn);
    }

    // ── 結果をパネルに描画 ──
    function renderResults(results) {
        const container = document.getElementById('ars-results');
        const status = document.querySelector('.ars-panel-status');

        if (!container) return;

        if (results.length === 0) {
            status.innerHTML = `
        <div class="ars-empty">
          <span class="ars-empty-icon">🤷</span>
          <span>該当する結果がありませんでした</span>
        </div>
      `;
            return;
        }

        status.innerHTML = `
      <div class="ars-summary">
        <span class="ars-summary-count">${results.length}件</span>の個人コンテンツを発見
      </div>
    `;

        container.innerHTML = '';
        results.forEach((item, index) => {
            container.appendChild(createResultCard(item, index));
        });
        console.log(`[ARS] Rendered ${results.length} result cards`);
    }

    // ── エラー表示 ──
    function renderError(message) {
        const status = document.querySelector('.ars-panel-status');
        if (status) {
            status.innerHTML = `
        <div class="ars-error">
          <span class="ars-error-icon">⚠️</span>
          <span>${message}</span>
        </div>
      `;
        }
    }

    // ── ローカル解析 ──
    function analyzeLocally(results) {
        if (typeof ARS === 'undefined') {
            console.warn('[ARS] ARS filter engine not loaded');
            return results.map(r => ({
                ...r,
                antiScore: 0,
                personalIndex: 0,
                commercialIndex: 0,
                reasons: ['フィルタエンジン未読込'],
            }));
        }

        const analyzed = results
            .filter(r => !ARS.isBlacklisted(r.url))
            .map(r => {
                const text = r.title + ' ' + r.snippet;
                const personalScore = ARS.calcPersonalScore(text);
                const seoScore = ARS.calcSeoScore(text);
                const adScore = 0;
                const brandScore = ARS.calcBrandScore(r.url, '');
                const antiScore = ARS.calcAntiScore({
                    personalScore, seoScore, adScore, brandScore, rank: r.rank
                });

                const reasons = [];
                if (personalScore > 3) reasons.push(`一人称表現 多め (${personalScore.toFixed(1)})`);
                if (seoScore < 2) reasons.push('SEOワード含有率 低');
                else if (seoScore > 5) reasons.push(`SEOワード多数 (${seoScore.toFixed(1)})`);
                reasons.push('アフィリエイト 未解析（ローカルモード）');
                if (brandScore < 2) reasons.push('独自ドメイン');
                else reasons.push('大手ドメインの可能性');
                reasons.push(`検索順位 ${r.rank}位`);

                return {
                    ...r,
                    personalScore, seoScore, adScore, brandScore, antiScore, reasons,
                    personalIndex: Math.min(100, Math.round(personalScore * 5)),
                    commercialIndex: Math.min(100, Math.round((seoScore + brandScore) * 3)),
                };
            });

        analyzed.sort((a, b) => b.antiScore - a.antiScore);
        console.log(`[ARS] Local analysis: ${analyzed.length} results after filtering`);
        return analyzed;
    }

    // ── メイン処理 ──
    async function main() {
        console.log('[ARS] Starting main()');

        // 設定確認
        let arsEnabled = true;
        try {
            const settings = await chrome.storage.sync.get(['arsEnabled']);
            if (settings.arsEnabled === false) {
                console.log('[ARS] Extension disabled');
                return;
            }
        } catch (e) {
            console.warn('[ARS] Could not read settings:', e);
        }

        const query = getSearchQuery();
        if (!query) {
            console.log('[ARS] No query found, aborting');
            return;
        }

        const googleResults = extractGoogleResults();
        if (googleResults.length === 0) {
            console.log('[ARS] No results extracted, aborting');
            return;
        }

        // UI生成
        const panel = createPanel();
        createToggleButton();

        try {
            // Background Workerに解析依頼
            console.log('[ARS] Sending to background worker...');
            const analyzed = await chrome.runtime.sendMessage({
                type: 'ARS_ANALYZE',
                data: { results: googleResults, query }
            });

            if (analyzed && Array.isArray(analyzed) && analyzed.length > 0) {
                console.log(`[ARS] Background returned ${analyzed.length} results`);
                renderResults(analyzed);
            } else {
                // フォールバック：ローカル解析
                console.log('[ARS] Background returned empty, using local analysis');
                const local = analyzeLocally(googleResults);
                renderResults(local);
            }
        } catch (error) {
            console.warn('[ARS] Background worker error, falling back to local:', error);
            const local = analyzeLocally(googleResults);
            renderResults(local);
        }
    }

    // ── 実行（少し遅延させてGoogleの動的コンテンツを待つ）──
    function run() {
        // すでにコンテンツがある場合は即実行
        const rso = document.getElementById('rso') || document.getElementById('search');
        if (rso && rso.children.length > 0) {
            console.log('[ARS] Content ready, running immediately');
            main().catch(err => {
                console.error('[ARS] Error:', err);
                renderError('解析中にエラーが発生しました');
            });
        } else {
            // まだ読み込まれていない場合は少し待つ
            console.log('[ARS] Waiting for content to load...');
            setTimeout(() => {
                main().catch(err => {
                    console.error('[ARS] Error:', err);
                    renderError('解析中にエラーが発生しました');
                });
            }, 1500);
        }
    }

    run();
})();
