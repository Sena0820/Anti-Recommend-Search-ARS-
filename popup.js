// =============================================================
// Anti-Recommend Search (ARS) — Popup Script
// =============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const enabledCheckbox = document.getElementById('ars-enabled');
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('status-msg');
    const strengthRadios = document.querySelectorAll('input[name="strength"]');

    // ── 設定読み込み ──
    const settings = await chrome.storage.sync.get([
        'arsEnabled',
        'filterStrength',
    ]);

    enabledCheckbox.checked = settings.arsEnabled !== false;
    const strength = settings.filterStrength || 'medium';
    strengthRadios.forEach(r => {
        r.checked = r.value === strength;
    });

    // ── 保存 ──
    saveBtn.addEventListener('click', async () => {
        const selectedStrength = document.querySelector('input[name="strength"]:checked');

        await chrome.storage.sync.set({
            arsEnabled: enabledCheckbox.checked,
            filterStrength: selectedStrength ? selectedStrength.value : 'medium',
        });

        statusMsg.textContent = '✅ 設定を保存しました';
        statusMsg.classList.add('show');

        setTimeout(() => {
            statusMsg.classList.remove('show');
        }, 2000);
    });
});
