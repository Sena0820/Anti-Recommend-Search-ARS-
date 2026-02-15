// =============================================================
// Anti-Recommend Search (ARS) — Popup Script
// =============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const enabledCheckbox = document.getElementById('ars-enabled');
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('status-msg');
    const strengthRadios = document.querySelectorAll('input[name="strength"]');
    const blInput = document.getElementById('bl-domain-input');
    const blAddBtn = document.getElementById('bl-add-btn');
    const blList = document.getElementById('bl-list');

    // ── 設定読み込み ──
    const settings = await chrome.storage.sync.get([
        'arsEnabled',
        'filterStrength',
        'customBlacklist',
    ]);

    enabledCheckbox.checked = settings.arsEnabled !== false;
    const strength = settings.filterStrength || 'medium';
    strengthRadios.forEach(r => {
        r.checked = r.value === strength;
    });

    // カスタムブラックリスト読み込み
    let customBlacklist = settings.customBlacklist || [];

    function renderBlacklist() {
        blList.innerHTML = '';
        if (customBlacklist.length === 0) {
            blList.innerHTML = '<div class="bl-empty">追加されたドメインはありません</div>';
            return;
        }
        customBlacklist.forEach((domain, i) => {
            const item = document.createElement('div');
            item.className = 'bl-item';
            item.innerHTML = `
                <span class="bl-domain">${domain}</span>
                <button class="bl-remove" data-index="${i}" title="削除">✕</button>
            `;
            blList.appendChild(item);
        });

        // 削除ボタンにイベント
        blList.querySelectorAll('.bl-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                customBlacklist.splice(idx, 1);
                renderBlacklist();
            });
        });
    }

    renderBlacklist();

    // ── ドメイン追加 ──
    function addDomain() {
        let domain = blInput.value.trim().toLowerCase();
        if (!domain) return;

        // URLが入力された場合はドメインだけ抽出
        try {
            if (domain.includes('://')) {
                domain = new URL(domain).hostname.replace(/^www\./, '');
            } else if (domain.includes('/')) {
                domain = domain.split('/')[0];
            }
        } catch { }

        // www.を除去
        domain = domain.replace(/^www\./, '');

        if (!domain || domain.length < 3) {
            showStatus('❌ 有効なドメインを入力してください', '#ef4444');
            return;
        }
        if (customBlacklist.includes(domain)) {
            showStatus('⚠️ すでに追加済みです', '#f59e0b');
            return;
        }

        customBlacklist.push(domain);
        blInput.value = '';
        renderBlacklist();
        showStatus(`✅ ${domain} を追加しました`, '#10b981');
    }

    blAddBtn.addEventListener('click', addDomain);
    blInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addDomain();
    });

    // ── ステータス表示 ──
    function showStatus(message, color) {
        statusMsg.textContent = message;
        statusMsg.style.color = color || '#10b981';
        statusMsg.classList.add('show');
        setTimeout(() => statusMsg.classList.remove('show'), 2000);
    }

    // ── 保存 ──
    saveBtn.addEventListener('click', async () => {
        const selectedStrength = document.querySelector('input[name="strength"]:checked');

        await chrome.storage.sync.set({
            arsEnabled: enabledCheckbox.checked,
            filterStrength: selectedStrength ? selectedStrength.value : 'medium',
            customBlacklist: customBlacklist,
        });

        showStatus('✅ 設定を保存しました', '#10b981');
    });
});
