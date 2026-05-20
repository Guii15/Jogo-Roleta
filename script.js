const {
    initializeApp,
    getAuth, signInAnonymously, onAuthStateChanged, signOut,
    getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc, increment
} = window.firebase;

const firebaseConfig = {
    apiKey: "AIzaSyD79AJDJKB7Lk_opDiHY1tZTN50N5msE9o",
    authDomain: "cassino-da-sorte-c86e8.firebaseapp.com",
    projectId: "cassino-da-sorte-c86e8",
    storageBucket: "cassino-da-sorte-c86e8.firebasestorage.app",
    messagingSenderId: "354608458657",
    appId: "1:354608458657:web:bc241db3f07148aedc79e0"
};

let db, auth, app;
let currentUserId      = null;
let balanceUnsubscribe = null;
let isSpinning         = false;

const IMAGENS_SIMBOLOS = {
    "Laranja": "https://img.icons8.com/fluency/96/orange.png",
    "Cereja":  "https://img.icons8.com/fluency/96/cherry.png",
    "Sino":    "https://img.icons8.com/fluency/96/bell.png",
    "BAR":     "https://img.icons8.com/fluency/96/bar.png",
    "7":       "https://img.icons8.com/fluency/96/7.png",
    "Tigre":   "https://img.icons8.com/fluency/96/tiger.png"
};

const API_URL      = 'http://127.0.0.1:5000/spin';
const symbolNames  = Object.keys(IMAGENS_SIMBOLOS);
const randomSymbol = () => symbolNames[Math.floor(Math.random() * symbolNames.length)];
const fmt          = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

try {
    app  = initializeApp(firebaseConfig);
    db   = getFirestore(app);
    auth = getAuth(app);
} catch (e) {
    console.error("Erro ao inicializar Firebase.", e);
}

// ─────────────────────────────────────────────────────────────────
// SESSION STATS
// ─────────────────────────────────────────────────────────────────
let sessionWagered = 0;
let sessionWon     = 0;
let sessionBest    = 0;

function updateSessionStats(wagered, won) {
    sessionWagered += wagered;
    sessionWon     += won;
    if (won > sessionBest) sessionBest = won;

    const net   = sessionWon - sessionWagered;
    const netEl = document.getElementById('stat-net');

    document.getElementById('stat-wagered').textContent = fmt(sessionWagered);
    document.getElementById('stat-won').textContent     = fmt(sessionWon);
    document.getElementById('stat-best').textContent    = fmt(sessionBest);
    netEl.textContent  = fmt(net);
    netEl.className    = 'sstat-value ' + (net >= 0 ? 'sstat-green' : 'sstat-red');
}

// ─────────────────────────────────────────────────────────────────
// JACKPOT COUNTER
// ─────────────────────────────────────────────────────────────────
let jackpotValue = 1_000_000 + Math.random() * 150_000;

function startJackpotGrowth() {
    function tick() {
        jackpotValue += Math.random() * 80 + 15;
        const el = document.getElementById('jackpot-amount');
        if (el) el.textContent = fmt(jackpotValue);
        setTimeout(tick, 1200 + Math.random() * 2000);
    }
    tick();
}

function resetJackpot() {
    jackpotValue = 950_000 + Math.random() * 60_000;
    const el = document.getElementById('jackpot-amount');
    if (el) el.textContent = fmt(jackpotValue);
}

// ─────────────────────────────────────────────────────────────────
// WINS TICKER
// ─────────────────────────────────────────────────────────────────
const SEED_WINS = [
    { symbols: ['Tigre', 'Tigre', 'Tigre'], amount: 50000, type: 'jackpot', player: 'Jogador 7G2K' },
    { symbols: ['7', '7', '7'],             amount: 2000,  type: 'mega',    player: 'Jogador M9PL' },
    { symbols: ['BAR', 'BAR', 'BAR'],       amount: 500,   type: 'big',     player: 'Jogador X3FQ' },
    { symbols: ['Sino', 'Sino', 'Sino'],    amount: 250,   type: 'big',     player: 'Jogador A1KZ' },
    { symbols: ['7', '7', '7'],             amount: 1000,  type: 'mega',    player: 'Jogador D8NR' },
    { symbols: ['Cereja', 'Cereja', 'Cereja'], amount: 150, type: 'win',   player: 'Jogador T5WB' },
    { symbols: ['BAR', 'BAR', 'BAR'],       amount: 750,   type: 'big',     player: 'Jogador R2JH' },
    { symbols: ['Laranja', 'Laranja', 'Laranja'], amount: 100, type: 'win', player: 'Jogador E6YC' },
];

function makeTickerItem({ symbols, amount, type, player }) {
    const div = document.createElement('div');
    div.className = `ticker-item ticker-${type}`;
    div.innerHTML =
        `<span class="ticker-player">${player}</span>` +
        symbols.map(s => `<img src="${IMAGENS_SIMBOLOS[s]}" alt="${s}">`).join('') +
        `<span class="ticker-amount">${fmt(amount)}</span>`;
    return div;
}

function initTicker() {
    const track = document.getElementById('wins-ticker-track');
    if (!track) return;
    const doubled = [...SEED_WINS, ...SEED_WINS];
    doubled.forEach(w => track.appendChild(makeTickerItem(w)));
}

function addWinToTicker(symbols, amount, type) {
    const track = document.getElementById('wins-ticker-track');
    if (!track) return;
    const item = makeTickerItem({ symbols, amount, type, player: 'Você' });
    item.style.fontWeight = '700';
    item.style.color = 'var(--gold-light)';
    track.prepend(item);
}

// ─────────────────────────────────────────────────────────────────
// PARTICLE SYSTEM
// ─────────────────────────────────────────────────────────────────
let particles     = [];
let partAnimId    = null;

function spawnParticles(count) {
    const canvas    = document.getElementById('win-canvas');
    canvas.width    = window.innerWidth;
    canvas.height   = window.innerHeight;
    const colors    = ['#d4af37', '#f5e070', '#ffd700', '#fff', '#ff6b6b', '#00e676', '#7c4dff', '#ffec00'];
    particles       = [];

    for (let i = 0; i < count; i++) {
        particles.push({
            x:       (0.15 + Math.random() * 0.7) * canvas.width,
            y:       (0.35 + Math.random() * 0.25) * canvas.height,
            vx:      (Math.random() - 0.5) * 18,
            vy:      -(Math.random() * 24 + 8),
            size:    Math.random() * 14 + 5,
            color:   colors[Math.floor(Math.random() * colors.length)],
            rot:     Math.random() * 360,
            rotSpd:  (Math.random() - 0.5) * 16,
            gravity: 0.5,
            opacity: 1,
            shape:   Math.random() > 0.5 ? 'coin' : 'rect',
        });
    }
}

function drawParticles() {
    const canvas = document.getElementById('win-canvas');
    const ctx    = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = false;
    particles.forEach(p => {
        if (p.opacity <= 0) return;
        alive  = true;
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += p.gravity;
        p.rot += p.rotSpd;
        if (p.y > canvas.height + 60) { p.opacity = 0; return; }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'coin') {
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size / 2, p.size / 3, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
    });

    if (alive) partAnimId = requestAnimationFrame(drawParticles);
}

function fadeParticles(delay) {
    setTimeout(() => {
        const id = setInterval(() => {
            particles.forEach(p => { p.opacity -= 0.025; });
            if (particles.every(p => p.opacity <= 0)) {
                clearInterval(id);
                if (partAnimId) { cancelAnimationFrame(partAnimId); partAnimId = null; }
            }
        }, 40);
    }, delay);
}

// ─────────────────────────────────────────────────────────────────
// WIN OVERLAY
// ─────────────────────────────────────────────────────────────────
const WIN_CONFIGS = {
    win:     { badge: 'VITÓRIA',         title: 'VOCÊ GANHOU!',   count: 35  },
    big:     { badge: 'GRANDE VITÓRIA',  title: 'INCRÍVEL!',      count: 75  },
    mega:    { badge: 'MEGA VITÓRIA',    title: 'SENSACIONAL!',   count: 130 },
    jackpot: { badge: '🏆  JACKPOT  🏆', title: 'J A C K P O T', count: 230 },
};

function showWinOverlay(winType, winAmount, symbols) {
    const overlay  = document.getElementById('win-overlay');
    const cfg      = WIN_CONFIGS[winType] || WIN_CONFIGS.win;

    document.getElementById('win-badge').textContent  = cfg.badge;
    document.getElementById('win-title').textContent  = cfg.title;
    document.getElementById('win-amount').textContent = fmt(0);
    document.getElementById('win-symbols').innerHTML  =
        symbols.map(s => `<img src="${IMAGENS_SIMBOLOS[s]}" alt="${s}">`).join('');

    overlay.className = `win-overlay win-type-${winType}`;

    spawnParticles(cfg.count);
    drawParticles();
    fadeParticles(2800);

    animateCounter(document.getElementById('win-amount'), 0, winAmount, 1400);

    if (winType === 'jackpot') setTimeout(resetJackpot, 2200);
}

function hideWinOverlay() {
    document.getElementById('win-overlay').classList.add('hidden');
    if (partAnimId) { cancelAnimationFrame(partAnimId); partAnimId = null; }
    particles = [];
    const canvas = document.getElementById('win-canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function animateCounter(el, from, to, duration) {
    const start = performance.now();
    (function step(now) {
        const t      = Math.min((now - start) / duration, 1);
        const eased  = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(step);
    })(start);
}

// ─────────────────────────────────────────────────────────────────
// AUTO-SPIN
// ─────────────────────────────────────────────────────────────────
let autoSpinActive    = false;
let autoSpinSelected  = 10;
let autoSpinRemaining = 0;

function toggleAutoSpinMenu() {
    if (autoSpinActive) { stopAutoSpin(); return; }
    document.getElementById('autospin-menu').classList.toggle('hidden');
}

function startAutoSpin() {
    document.getElementById('autospin-menu').classList.add('hidden');
    autoSpinActive    = true;
    autoSpinRemaining = autoSpinSelected;
    document.getElementById('autospin-button').classList.add('active');
    refreshAutoSpinBadge();
    if (!isSpinning) handleSpin();
}

function stopAutoSpin() {
    autoSpinActive    = false;
    autoSpinRemaining = 0;
    document.getElementById('autospin-button').classList.remove('active');
    document.getElementById('autospin-badge').classList.add('hidden');
}

function refreshAutoSpinBadge() {
    const badge = document.getElementById('autospin-badge');
    if (autoSpinActive) {
        badge.classList.remove('hidden');
        badge.textContent = autoSpinRemaining === -1 ? '∞' : autoSpinRemaining;
    } else {
        badge.classList.add('hidden');
    }
}

// ─────────────────────────────────────────────────────────────────
// QUICK BET BUTTONS
// ─────────────────────────────────────────────────────────────────
function syncQuickBetActive(value) {
    document.querySelectorAll('.btn-qbet').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.bet, 10) === value);
    });
}

function initQuickBets() {
    document.querySelectorAll('.btn-qbet').forEach(btn => {
        btn.addEventListener('click', () => {
            const bet = parseInt(btn.dataset.bet, 10);
            ui.betAmountInput.value = bet;
            syncQuickBetActive(bet);
            ui.betAmountInput.dispatchEvent(new Event('input'));
        });
    });
}

// ─────────────────────────────────────────────────────────────────
// UI MAP
// ─────────────────────────────────────────────────────────────────
const ui = {
    loginView:            document.getElementById('login-view'),
    gameView:             document.getElementById('game-view'),
    walletView:           document.getElementById('wallet-view'),
    loginButton:          document.getElementById('login-button'),
    logoutButton:         document.getElementById('logout-button'),
    spinButton:           document.getElementById('spin-button'),
    goToWalletButton:     document.getElementById('goto-wallet-button'),
    goToGameButton:       document.getElementById('goto-game-button'),
    depositButton:        document.getElementById('deposit-button'),
    withdrawButton:       document.getElementById('withdraw-button'),
    reelsContainer:       document.getElementById('reels-container'),
    balanceDisplay:       document.getElementById('balance-display'),
    userIdDisplay:        document.getElementById('user-id-display'),
    messageBox:           document.getElementById('message-box'),
    betAmountInput:       document.getElementById('bet-amount'),
    walletBalanceDisplay: document.getElementById('wallet-balance'),
    walletAmountInput:    document.getElementById('wallet-amount'),
};

function showView(viewName) {
    ui.loginView.classList.add('hidden');
    ui.gameView.classList.add('hidden');
    ui.walletView.classList.add('hidden');
    if (viewName === 'login')  ui.loginView.classList.remove('hidden');
    if (viewName === 'game')   ui.gameView.classList.remove('hidden');
    if (viewName === 'wallet') ui.walletView.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────
async function handleGuestLogin() {
    ui.loginButton.disabled    = true;
    ui.loginButton.textContent = "A entrar...";
    try {
        await signInAnonymously(auth);
    } catch (e) {
        ui.loginButton.disabled    = false;
        ui.loginButton.textContent = "Entrar como Convidado";
    }
}

async function handleLogout() {
    try { await signOut(auth); } catch (e) {}
}

function handleAuthStateChanged(user) {
    if (user) {
        currentUserId = user.uid;
        ui.userIdDisplay.textContent = `Jogador ${currentUserId.slice(-6).toUpperCase()}`;
        setupUserBalance(user.uid);
        setupBalanceListener(user.uid);
        showView('game');
        updateReelsUI([randomSymbol(), randomSymbol(), randomSymbol()]);
    } else {
        currentUserId = null;
        if (balanceUnsubscribe) { balanceUnsubscribe(); balanceUnsubscribe = null; }
        showView('login');
        ui.loginButton.disabled    = false;
        ui.loginButton.textContent = "Entrar como Convidado";
    }
}

// ─────────────────────────────────────────────────────────────────
// DATABASE / BALANCE
// ─────────────────────────────────────────────────────────────────
function userDocRef(uid) {
    return doc(db, "artifacts", "cassino-da-sorte", "users", uid);
}

async function setupUserBalance(uid) {
    try {
        const snap = await getDoc(userDocRef(uid));
        if (!snap.exists()) {
            await setDoc(userDocRef(uid), { balance: 100, createdAt: new Date() });
        }
    } catch (e) {}
}

function setupBalanceListener(uid) {
    if (balanceUnsubscribe) balanceUnsubscribe();
    balanceUnsubscribe = onSnapshot(userDocRef(uid), snap => {
        if (snap.exists()) updateBalanceUI(snap.data().balance);
    });
}

function updateBalanceUI(balance) {
    ui.balanceDisplay.textContent       = fmt(balance);
    ui.walletBalanceDisplay.textContent = fmt(balance);

    const bet = parseInt(ui.betAmountInput.value, 10);
    if (balance < bet) {
        ui.spinButton.disabled    = true;
        if (!isSpinning) ui.messageBox.textContent = "Saldo insuficiente para esta aposta.";
        if (autoSpinActive) stopAutoSpin();
    } else if (!isSpinning) {
        ui.spinButton.disabled = false;
    }
}

// ─────────────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────────────
async function handleTransaction(type) {
    if (!currentUserId) return;
    const amount = parseInt(ui.walletAmountInput.value, 10);
    if (isNaN(amount) || amount <= 0) { alert("Por favor, insira um valor válido."); return; }

    try {
        if (type === 'deposit') {
            await updateDoc(userDocRef(currentUserId), { balance: increment(amount) });
        } else {
            const snap = await getDoc(userDocRef(currentUserId));
            if (amount > snap.data().balance) { alert("Não pode sacar mais do que tem!"); return; }
            await updateDoc(userDocRef(currentUserId), { balance: increment(-amount) });
        }
        ui.walletAmountInput.value = "";
    } catch (e) {
        alert("Erro ao processar transação.");
    }
}

// ─────────────────────────────────────────────────────────────────
// SLOT MACHINE
// ─────────────────────────────────────────────────────────────────
const SYMBOL_HEIGHT = 130;
const STRIP_SIZE    = 20;

function animateReel(reelDiv, resultado, delay) {
    return new Promise(resolve => {
        const strip = reelDiv.querySelector('.reel-strip');
        strip.style.transition = 'none';
        strip.style.transform  = 'translateY(0)';
        strip.innerHTML        = '';

        for (let i = 0; i < STRIP_SIZE; i++) {
            const img = document.createElement('img');
            img.src   = IMAGENS_SIMBOLOS[randomSymbol()];
            strip.appendChild(img);
        }
        const imgFinal = document.createElement('img');
        imgFinal.src   = IMAGENS_SIMBOLOS[resultado];
        imgFinal.alt   = resultado;
        strip.appendChild(imgFinal);

        strip.getBoundingClientRect();

        setTimeout(() => {
            strip.style.transition = 'transform 1100ms cubic-bezier(0.25, 0.1, 0.25, 1)';
            strip.style.transform  = `translateY(${-(STRIP_SIZE * SYMBOL_HEIGHT)}px)`;
            setTimeout(resolve, 1100);
        }, delay);
    });
}

async function handleSpin() {
    if (isSpinning || !currentUserId) return;

    const bet     = parseInt(ui.betAmountInput.value, 10);
    const ref     = userDocRef(currentUserId);

    // Pre-spin balance check
    try {
        const snap = await getDoc(ref);
        if (snap.data().balance < bet) {
            ui.messageBox.textContent = "Saldo insuficiente!";
            stopAutoSpin();
            return;
        }
    } catch (e) {
        ui.messageBox.textContent = "Erro de rede. Tente novamente.";
        return;
    }

    isSpinning               = true;
    ui.spinButton.disabled   = true;
    ui.messageBox.textContent = "Girando...";

    const reelDivs = Array.from(ui.reelsContainer.children);
    reelDivs.forEach(r => r.classList.add('pre-spinning'));

    // Deduct bet
    try {
        await updateDoc(ref, { balance: increment(-bet) });
    } catch (e) {
        ui.messageBox.textContent = "Erro ao apostar.";
        isSpinning = false;
        reelDivs.forEach(r => r.classList.remove('pre-spinning'));
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ bet }),
        });
        if (!response.ok) throw new Error('Servidor indisponível.');
        const data = await response.json();

        reelDivs.forEach(r => r.classList.remove('pre-spinning'));
        await Promise.all(data.reels.map((s, i) => animateReel(reelDivs[i], s, i * 350)));

        if (data.nearMiss) {
            reelDivs.forEach(r => {
                r.classList.add('near-miss');
                setTimeout(() => r.classList.remove('near-miss'), 600);
            });
            ui.messageBox.textContent = "😤 Quase! Tente de novo!";
        } else {
            ui.messageBox.textContent = data.message;
        }

        if (data.winAmount > 0) {
            await updateDoc(ref, { balance: increment(data.winAmount) });
            updateSessionStats(bet, data.winAmount);

            reelDivs.forEach(r => r.classList.add('winner'));
            setTimeout(() => reelDivs.forEach(r => r.classList.remove('winner')), 2200);

            addWinToTicker(data.reels, data.winAmount, data.winType || 'win');

            if (['big', 'mega', 'jackpot'].includes(data.winType)) {
                stopAutoSpin();
                showWinOverlay(data.winType, data.winAmount, data.reels);
            }
        } else {
            updateSessionStats(bet, 0);
        }

    } catch (error) {
        ui.messageBox.textContent = "Servidor indisponível. Devolvendo aposta...";
        reelDivs.forEach(r => r.classList.remove('pre-spinning'));
        try { await updateDoc(ref, { balance: increment(bet) }); } catch (e) {}
    } finally {
        isSpinning = false;
        const snap = await getDoc(ref);
        updateBalanceUI(snap.data().balance);

        if (autoSpinActive) {
            if (autoSpinRemaining === -1) {
                setTimeout(handleSpin, 700);
            } else {
                autoSpinRemaining--;
                if (autoSpinRemaining <= 0) {
                    stopAutoSpin();
                } else {
                    refreshAutoSpinBadge();
                    setTimeout(handleSpin, 700);
                }
            }
        }
    }
}

function updateReelsUI(reelsResult) {
    Array.from(ui.reelsContainer.children).forEach((reelDiv, i) => {
        const strip = reelDiv.querySelector('.reel-strip');
        strip.style.transition = 'none';
        strip.style.transform  = 'translateY(0)';
        strip.innerHTML        = '';
        const img = document.createElement('img');
        img.src   = IMAGENS_SIMBOLOS[reelsResult[i]] || '';
        img.alt   = reelsResult[i] || '';
        strip.appendChild(img);
    });
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
function main() {
    if (!auth || !db) {
        console.error("Firebase não inicializado.");
        return;
    }

    ui.loginButton.addEventListener('click', handleGuestLogin);
    ui.logoutButton.addEventListener('click', handleLogout);
    ui.goToWalletButton.addEventListener('click', () => showView('wallet'));
    ui.goToGameButton.addEventListener('click',   () => showView('game'));
    ui.depositButton.addEventListener('click',  () => handleTransaction('deposit'));
    ui.withdrawButton.addEventListener('click', () => handleTransaction('withdraw'));
    ui.spinButton.addEventListener('click', handleSpin);

    document.getElementById('bet-down').addEventListener('click', () => {
        const inp = ui.betAmountInput;
        const v   = parseInt(inp.value, 10) - parseInt(inp.step, 10);
        if (v >= parseInt(inp.min, 10)) { inp.value = v; syncQuickBetActive(v); }
        inp.dispatchEvent(new Event('input'));
    });
    document.getElementById('bet-up').addEventListener('click', () => {
        const inp = ui.betAmountInput;
        const v   = parseInt(inp.value, 10) + parseInt(inp.step, 10);
        if (v <= parseInt(inp.max, 10)) { inp.value = v; syncQuickBetActive(v); }
        inp.dispatchEvent(new Event('input'));
    });

    ui.betAmountInput.addEventListener('input', async () => {
        if (!currentUserId) return;
        const snap = await getDoc(userDocRef(currentUserId));
        updateBalanceUI(snap.data().balance);
    });

    initQuickBets();

    document.getElementById('autospin-button').addEventListener('click', toggleAutoSpinMenu);
    document.getElementById('start-autospin-btn').addEventListener('click', startAutoSpin);
    document.querySelectorAll('.btn-asopt').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-asopt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            autoSpinSelected = parseInt(btn.dataset.count, 10);
        });
    });

    document.addEventListener('click', e => {
        const menu = document.getElementById('autospin-menu');
        const btn  = document.getElementById('autospin-button');
        if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    document.getElementById('win-close-btn').addEventListener('click', hideWinOverlay);

    Array.from(ui.reelsContainer.children).forEach(reelDiv => {
        const fade = document.createElement('div');
        fade.className = 'reel-fade';
        reelDiv.appendChild(fade);
    });

    startJackpotGrowth();
    initTicker();

    onAuthStateChanged(auth, handleAuthStateChanged);
}

main();
