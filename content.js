// =============================================================
// Anti-Recommend Search (ARS) — Content Script
// Google検索結果ページにサイドパネルを注入
// =============================================================

(function () {
    'use strict';

    // 二重注入防止
    if (document.getElementById('ars-panel')) return;

    // ── Google検索結果からデータ抽出 ──
    function extractGoogleResults() {
        const results = [];
        const items = document.querySelectorAll('#search .g, #rso .g');
        let rank = 0;

        items.forEach((item) => {
            const linkEl = item.querySelector('a[href]');
            const titleEl = item.querySelector('h3');
            const snippetEl = item.querySelector('[data-sncf], .VwiC3b, .IsZvec, .s3v9rd');

            if (!linkEl || !titleEl) return;

            const url = linkEl.href;
            if (!url || url.startsWith('https://www.google') || url.startsWith('/')) return;

            rank++;
            results.push({
                title: titleEl.textContent || '',
                url: url,
                snippet: snippetEl ? snippetEl.textContent || '' : '',
                rank: rank,
            });
        });

        return results;
    }

    // ── 検索キーワード取得 ──
    function getSearchQuery() {
        const input = document.querySelector('input[name="q"], textarea[name="q"]');
        return input ? input.value : '';
    }

    // ── スコアに応じた色 ──
    function getScoreColor(score) {
        if (score >= 20) return '#10b981';  // 高い → 緑
        if (score >= 0) return '#f59e0b';   // 中程度 → 黄
        return '#ef4444';                    // 低い → 赤
    }

    // ── スコアバッジ ──
    function getScoreLabel(score) {
        if (score >= 30) return '⭐ 超個人的';
        if (score >= 15) return '✨ 個人的';
        if (score >= 0) return '🔍 中立';
        return '🏢 商業寄り';
    }

    // ── 個人性ゲージ ──
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

        card.innerHTML = `
      <div class="ars-card-header">
        <span class="ars-rank">#${index + 1}</span>
        <span class="ars-score-badge" style="background:${scoreColor}">${item.antiScore.toFixed(1)}</span>
        <span class="ars-score-label">${label}</span>
      </div>
      <a class="ars-card-title" href="${item.url}" target="_blank" rel="noopener">${item.title}</a>
      <div class="ars-card-url">${item.url}</div>
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

        // 閉じるボタン
        document.getElementById('ars-close').addEventListener('click', () => {
            panel.classList.add('ars-panel-hidden');
        });

        return panel;
    }

    // ── トグルボタン（パネルが閉じた時に再表示するため）──
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

    // ── ローカル解析（APIキーなしフォールバック）──
    function analyzeLocally(results) {
        if (typeof ARS === 'undefined') return results;

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
                reasons.push('アフィリエイトリンク 未解析（ローカルモード）');
                if (brandScore < 2) reasons.push('独自ドメイン');
                else reasons.push('大手ドメインの可能性');
                reasons.push(`検索順位 ${r.rank}位`);

                return {
                    ...r,
                    personalScore,
                    seoScore,
                    adScore,
                    brandScore,
                    antiScore,
                    reasons,
                    personalIndex: Math.min(100, Math.round(personalScore * 5)),
                    commercialIndex: Math.min(100, Math.round((seoScore + brandScore) * 3)),
                };
            });

        analyzed.sort((a, b) => b.antiScore - a.antiScore);
        return analyzed;
    }

    // ── メイン処理 ──
    async function main() {
        // 設定確認
        const settings = await chrome.storage.sync.get(['arsEnabled', 'filterStrength']);
        if (settings.arsEnabled === false) return; // OFF時は何もしない

        const query = getSearchQuery();
        if (!query) return;

        const googleResults = extractGoogleResults();
        if (googleResults.length === 0) return;

        // UI生成
        const panel = createPanel();
        createToggleButton();

        try {
            // Background Workerに解析依頼
            const analyzed = await chrome.runtime.sendMessage({
                type: 'ARS_ANALYZE',
                data: { results: googleResults, query }
            });

            if (analyzed && analyzed.length > 0) {
                renderResults(analyzed);
            } else {
                // フォールバック：ローカル解析
                const local = analyzeLocally(googleResults);
                renderResults(local);
            }
        } catch (error) {
            console.warn('[ARS] Background worker error, falling back to local:', error);
            const local = analyzeLocally(googleResults);
            renderResults(local);
        }
    }

    // ── 実行 ──
    main().catch(err => {
        console.error('[ARS] Error:', err);
        renderError('解析中にエラーが発生しました');
    });
})();
