// --- INÍCIO DAS FERRAMENTAS DO FIREBASE ---
// O 'window.firebase' foi criado no index.html para nos dar acesso a estas ferramentas
const {
    initializeApp,
    getAuth, signInAnonymously, onAuthStateChanged, signOut,
    getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc, increment
} = window.firebase;
// --- FIM DAS FERRAMENTAS DO FIREBASE ---


// ---------------------------------------------------------------------------------
// PASSO 1: COLE AS SUAS CHAVES DO FIREBASE AQUI
// ---------------------------------------------------------------------------------
// Substitua o comentário abaixo pelo objeto 'firebaseConfig' que copiou do site do Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyD79AJDJKB7Lk_opDiHY1tZTN50N5msE9o",
  authDomain: "cassino-da-sorte-c86e8.firebaseapp.com",
  projectId: "cassino-da-sorte-c86e8",
  storageBucket: "cassino-da-sorte-c86e8.firebasestorage.app",
  messagingSenderId: "354608458657",
  appId: "1:354608458657:web:bc241db3f07148aedc79e0"
};

// ---------------------------------------------------------------------------------
// PASSO 2: INICIALIZAR O FIREBASE
// ---------------------------------------------------------------------------------
// (Não precisa de mexer aqui, apenas cole as suas chaves acima)

let db, auth, app;
let currentUserId = null;
let balanceUnsubscribe = null; // Função para parar de "ouvir" o saldo
let isSpinning = false; // Estado de girar a roleta

// Dicionário de Imagens
const IMAGENS_SIMBOLOS = {
    "Laranja": "https://img.icons8.com/fluency/96/orange.png",
    "Cereja": "https://img.icons8.com/fluency/96/cherry.png",
    "Sino": "https://img.icons8.com/fluency/96/bell.png",
    "BAR": "https://img.icons8.com/fluency/96/bar.png",
    "7": "https://img.icons8.com/fluency/96/7.png",
    "Tigre": "https://img.icons8.com/fluency/96/tiger.png"
};

const API_URL = 'http://127.0.0.1:5000/spin';

// --- NOVO ---
// Pega os nomes dos símbolos para usar no estado inicial
const symbolNames = Object.keys(IMAGENS_SIMBOLOS);
/**
 * Retorna um nome de símbolo aleatório da lista
 * @returns {string} Nome de um símbolo (ex: "Tigre")
 */
const getRandomSymbol = () => symbolNames[Math.floor(Math.random() * symbolNames.length)];
// --- FIM DO NOVO ---


try {
    // Inicializa o Firebase com as chaves que colou acima
    app = initializeApp(firebaseConfig);
    
    // Obtém acesso ao "Cofre" (Banco de Dados)
    db = getFirestore(app);
    
    // Obtém acesso ao "Porteiro" (Autenticação)
    auth = getAuth(app);
    
} catch (e) {
    console.error("Erro ao inicializar o Firebase. Verifique as suas 'firebaseConfig'.", e);
    alert("ERRO: Não foi possível ligar ao servidor do jogo. Verifique as suas chaves do Firebase e recarregue a página.");
}

// ---------------------------------------------------------------------------------
// O RESTO DO CÓDIGO DO JOGO
// ---------------------------------------------------------------------------------


// --- Mapeamento dos Elementos da UI (Interface do Utilizador) ---
// Guardamos todos os elementos que vamos manipular num objeto para organizar
const ui = {
    // Vistas (Telas)
    loginView: document.getElementById('login-view'),
    gameView: document.getElementById('game-view'),
    walletView: document.getElementById('wallet-view'),

    // Botões
    loginButton: document.getElementById('login-button'),
    logoutButton: document.getElementById('logout-button'),
    spinButton: document.getElementById('spin-button'),
    goToWalletButton: document.getElementById('goto-wallet-button'),
    goToGameButton: document.getElementById('goto-game-button'),
    depositButton: document.getElementById('deposit-button'),
    withdrawButton: document.getElementById('withdraw-button'),

    // Elementos de Jogo e Informação
    reelsContainer: document.getElementById('reels-container'),
    balanceDisplay: document.getElementById('balance-display'),
    userIdDisplay: document.getElementById('user-id-display'),
    messageBox: document.getElementById('message-box'),
    betAmountInput: document.getElementById('bet-amount'),
    
    // Elementos da Carteira
    walletBalanceDisplay: document.getElementById('wallet-balance'),
    walletAmountInput: document.getElementById('wallet-amount')
};

// --- Gestão das Vistas (Telas) ---

/**
 * Mostra uma vista (tela) e esconde as outras.
 * @param {string} viewName - O nome da vista a mostrar ('login', 'game', 'wallet')
 */
function showView(viewName) {
    // Esconde todas as vistas primeiro
    ui.loginView.classList.add('hidden');
    ui.gameView.classList.add('hidden');
    ui.walletView.classList.add('hidden');

    // Mostra a vista pedida
    if (viewName === 'login') {
        ui.loginView.classList.remove('hidden');
    } else if (viewName === 'game') {
        ui.gameView.classList.remove('hidden');
    } else if (viewName === 'wallet') {
        ui.walletView.classList.remove('hidden');
    }
}

// --- Lógica de Autenticação (Login) ---

/**
 * Chamada quando o utilizador clica em "Entrar como Convidado".
 */
async function handleGuestLogin() {
    ui.loginButton.disabled = true;
    ui.loginButton.textContent = "A entrar...";
    try {
        await signInAnonymously(auth);
        // O onAuthStateChanged vai tratar de mudar a tela
        console.log("Login anónimo com sucesso.");
    } catch (error) {
        console.error("Erro no login anónimo:", error);
        ui.loginButton.disabled = false;
        ui.loginButton.textContent = "Entrar como Convidado";
    }
}

/**
 * Chamada quando o utilizador clica em "Sair".
 */
async function handleLogout() {
    try {
        await signOut(auth);
        // O onAuthStateChanged vai tratar de mudar a tela
        console.log("Logout com sucesso.");
    } catch (error) {
        console.error("Erro no logout:", error);
    }
}

/**
 * A função MAIS IMPORTANTE. Ouve as mudanças de estado de login.
 * Esta função é chamada automaticamente pelo Firebase:
 * 1. Quando a página carrega.
 * 2. Quando o utilizador faz login.
 * 3. Quando o utilizador faz logout.
 * @param {object} user - O objeto do utilizador (ou null se estiver desligado)
 */
function handleAuthStateChanged(user) {
    if (user) {
        // --- UTILIZADOR ESTÁ LOGADO ---
        console.log("Utilizador está logado:", user.uid);
        currentUserId = user.uid;
        
        // --- LÓGICA DO NOME DE UTILIZADOR ATUALIZADA ---
        // Pega os últimos 6 caracteres do ID para criar um "Nome de Jogador"
        const shortId = currentUserId.slice(-6).toUpperCase();
        const displayName = `Jogador ${shortId}`;
        ui.userIdDisplay.textContent = displayName; // Mostra o nome amigável
        
        // Prepara o "cofre" do utilizador no banco de dados
        setupUserBalance(user.uid);
        
        // Começa a "ouvir" as mudanças de saldo
        setupBalanceListener(user.uid);
        
        // Mostra a tela do jogo
        showView('game');

        // --- NOVO ---
        // Define um estado inicial aleatório para os rolos
        // para não mostrar '?'
        updateReelsUI([getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]);
        // --- FIM DO NOVO ---
        
    } else {
        // --- UTILIZADOR ESTÁ DESLOGADO ---
        console.log("Utilizador está deslogado.");
        currentUserId = null;
        
        // Para de "ouvir" o saldo antigo
        if (balanceUnsubscribe) {
            balanceUnsubscribe();
            balanceUnsubscribe = null;
        }
        
        // Mostra a tela de login
        showView('login');
        ui.loginButton.disabled = false;
        ui.loginButton.textContent = "Entrar como Convidado";
    }
}

// --- Lógica do Banco de Dados (Saldo) ---

/**
 * Verifica se o utilizador já tem um "cofre". Se não, cria um com 100.
 * @param {string} uid - ID único do utilizador
 */
async function setupUserBalance(uid) {
    // Cria uma referência para o documento do utilizador no "cofre"
    const userDocRef = doc(db, "artifacts", "cassino-da-sorte", "users", uid);
    
    try {
        const docSnap = await getDoc(userDocRef);
        
        if (!docSnap.exists()) {
            // O utilizador é novo! Cria o "cofre" dele com 100.
            console.log("Utilizador novo! A criar saldo inicial de 100.");
            await setDoc(userDocRef, { 
                balance: 100,
                createdAt: new Date() // Guarda a data de criação
            });
        } else {
            // O utilizador já existe, não faz nada.
            console.log("Utilizador já existente encontrado.");
        }
    } catch (error) {
        console.error("Erro ao verificar/criar saldo do utilizador:", error);
    }
}

/**
 * "Ouve" o saldo do utilizador em tempo real.
 * @param {string} uid - ID único do utilizador
 */
function setupBalanceListener(uid) {
    // Se já estivermos a "ouvir" algo, paramos primeiro
    if (balanceUnsubscribe) {
        balanceUnsubscribe();
    }
    
    const userDocRef = doc(db, "artifacts", "cassino-da-sorte", "users", uid);
    
    // onSnapshot é a magia do tempo real!
    // Esta função é chamada automaticamente sempre que o saldo no "cofre" muda.
    balanceUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const newBalance = data.balance;
            updateBalanceUI(newBalance);
        } else {
            // Isto não deve acontecer se o setupUserBalance funcionou
            console.warn("Documento do utilizador não encontrado no listener.");
        }
    }, (error) => {
        console.error("Erro ao 'ouvir' o saldo:", error);
    });
}

/**
 * Atualiza o saldo em TODOS os locais da interface.
 * @param {number} newBalance - O novo valor do saldo
 */
function updateBalanceUI(newBalance) {
    // !! ESTA É A LINHA QUE MUDÁMOS !!
    // Formata o número para o padrão de moeda do Brasil (R$ 10.000,00)
    const formattedBalance = newBalance.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    ui.balanceDisplay.textContent = formattedBalance;
    ui.walletBalanceDisplay.textContent = formattedBalance;
    
    // Verifica se o utilizador pode apostar
    const currentBet = parseInt(ui.betAmountInput.value, 10);
    if (newBalance < currentBet) {
        ui.spinButton.disabled = true;
        ui.messageBox.textContent = "Saldo insuficiente para esta aposta.";
    } else if (!isSpinning) { // Só re-ativa se não estiver a girar
        ui.spinButton.disabled = false;
        ui.messageBox.textContent = "Boa sorte!";
    }
}

// --- Lógica da Carteira (Depósito/Saque) ---

/**
 * Adiciona ou remove dinheiro fictício do "cofre" do utilizador.
 * @param {'deposit' | 'withdraw'} type - O tipo de transação
 */
async function handleTransaction(type) {
    if (!currentUserId) return; // Não faz nada se não estiver logado

    const amount = parseInt(ui.walletAmountInput.value, 10);
    
    // Validação
    if (isNaN(amount) || amount <= 0) {
        alert("Por favor, insira um valor válido.");
        return;
    }

    const userDocRef = doc(db, "artifacts", "cassino-da-sorte", "users", currentUserId);

    try {
        if (type === 'deposit') {
            // increment() é uma função segura do Firebase para adicionar valores
            await updateDoc(userDocRef, {
                balance: increment(amount)
            });
            console.log(`Depósito de ${amount} realizado.`);
            
        } else if (type === 'withdraw') {
            // Para sacar, primeiro lemos o saldo para garantir que não fica negativo
            const docSnap = await getDoc(userDocRef);
            const currentBalance = docSnap.data().balance;
            
            if (amount > currentBalance) {
                alert("Não pode sacar mais do que tem!");
                return;
            }
            
            await updateDoc(userDocRef, {
                balance: increment(-amount) // Subtrai o valor
            });
            console.log(`Saque de ${amount} realizado.`);
        }
        
        ui.walletAmountInput.value = ""; // Limpa o campo

    } catch (error) {
        console.error(`Erro ao processar ${type}:`, error);
        alert(`Erro ao processar ${type}. Tente novamente.`);
    }
}


// --- Lógica do Jogo (Girar a Roleta) ---

// Deve ser igual ao --reel-size do CSS (em px)
const SYMBOL_HEIGHT = 110;
// Quantos símbolos aleatórios passam antes de mostrar o resultado
const STRIP_SIZE = 20;

/**
 * Anima um rolo rolando e parando no símbolo correto.
 *
 * Como funciona:
 * 1. Monta uma lista de STRIP_SIZE símbolos aleatórios + o resultado no final
 * 2. Posiciona a faixa no topo (translateY = 0), mostrando o 1º símbolo
 * 3. Anima até a posição do último símbolo (o resultado) com ease-out
 *    → ease-out = começa rápido e desacelera, igual a uma caça-níquel real
 *
 * @param {HTMLElement} reelDiv    - O div .reel que será animado
 * @param {string}      resultado  - Nome do símbolo final (ex: "Tigre")
 * @param {number}      delay      - Atraso em ms (para escalonar os 3 rolos)
 * @returns {Promise}              - Resolve quando a animação termina
 */
function animateReel(reelDiv, resultado, delay) {
    return new Promise(resolve => {
        const strip = reelDiv.querySelector('.reel-strip');

        // Reseta sem animação para não acumular estados
        strip.style.transition = 'none';
        strip.style.transform  = 'translateY(0)';
        strip.innerHTML = '';

        // Preenche a faixa: aleatórios + resultado no final
        for (let i = 0; i < STRIP_SIZE; i++) {
            const img = document.createElement('img');
            img.src = IMAGENS_SIMBOLOS[getRandomSymbol()];
            strip.appendChild(img);
        }
        const imgResultado = document.createElement('img');
        imgResultado.src = IMAGENS_SIMBOLOS[resultado];
        imgResultado.alt = resultado;
        strip.appendChild(imgResultado);

        // getBoundingClientRect() força o browser a "renderizar" o estado atual
        // antes de aplicar a transição. Sem isso a animação não ocorre.
        strip.getBoundingClientRect();

        setTimeout(() => {
            const posicaoFinal = -(STRIP_SIZE * SYMBOL_HEIGHT);
            strip.style.transition = `transform 1100ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
            strip.style.transform  = `translateY(${posicaoFinal}px)`;

            // Resolve a Promise quando a animação CSS terminar
            setTimeout(resolve, 1100);
        }, delay);
    });
}

/**
 * Chamada quando o utilizador clica em "GIRAR!".
 */
async function handleSpin() {
    if (isSpinning || !currentUserId) return;

    const currentBet = parseInt(ui.betAmountInput.value, 10);
    
    // --- 1. Verificações Iniciais ---
    const userDocRef = doc(db, "artifacts", "cassino-da-sorte", "users", currentUserId);
    try {
        const docSnap = await getDoc(userDocRef);
        const currentBalance = docSnap.data().balance;
        if (currentBalance < currentBet) {
            ui.messageBox.textContent = "Saldo insuficiente!";
            return;
        }
    } catch (e) {
        console.error("Erro ao ler saldo antes de girar:", e);
        ui.messageBox.textContent = "Erro de rede. Tente novamente.";
        return;
    }
    
    // --- 2. Iniciar o Giro (Visual) ---
    isSpinning = true;
    ui.spinButton.disabled = true;
    ui.messageBox.textContent = "Girando...";
    const reelDivs = Array.from(ui.reelsContainer.children);
    // Desfoca os rolos enquanto busca o resultado no servidor
    reelDivs.forEach(reelDiv => reelDiv.classList.add('pre-spinning'));

    // --- 3. Pagar a Aposta (no Cofre) ---
    try {
        await updateDoc(userDocRef, {
            balance: increment(-currentBet)
        });
        console.log(`Aposta de ${currentBet} paga.`);
    } catch (e) {
        console.error("Erro ao pagar aposta:", e);
        ui.messageBox.textContent = "Erro ao pagar aposta. Tente novamente.";
        isSpinning = false; // Permite tentar de novo
        return; // Não gira se não conseguiu pagar
    }

    // --- 4. Chamar o Backend da Roleta ---
    try {
        // Busca o resultado no servidor (sem delay artificial — a animação é o delay)
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet: currentBet })
        });

        if (!response.ok) throw new Error('Erro de rede no servidor da roleta.');

        const data = await response.json();

        // --- 5. Animar os rolos em cascata com o resultado real ---
        // Remove o desfoque e inicia a animação de cada rolo com atraso escalonado:
        // rolo 0 → 0ms, rolo 1 → 350ms, rolo 2 → 700ms
        // Isso cria o efeito "para um por um" dos caça-níqueis reais
        reelDivs.forEach(reelDiv => reelDiv.classList.remove('pre-spinning'));
        await Promise.all(
            data.reels.map((simbolo, i) => animateReel(reelDivs[i], simbolo, i * 350))
        );

        ui.messageBox.textContent = data.message;

        if (data.winAmount > 0) {
            await updateDoc(userDocRef, { balance: increment(data.winAmount) });
            console.log(`Prémio de ${data.winAmount} pago.`);

            // Pulsa em dourado por 2s (0.5s × 4 repetições definidas no CSS)
            reelDivs.forEach(reelDiv => reelDiv.classList.add('winner'));
            setTimeout(() => {
                reelDivs.forEach(reelDiv => reelDiv.classList.remove('winner'));
            }, 2000);
        }

    } catch (error) {
        console.error("Erro durante o giro (fetch) ou pagamento:", error);
        ui.messageBox.textContent = "Erro na roleta. A devolver aposta...";
        reelDivs.forEach(reelDiv => reelDiv.classList.remove('pre-spinning'));
        try {
            await updateDoc(userDocRef, { balance: increment(currentBet) });
        } catch (e) {
            console.error("Erro crítico ao devolver aposta:", e);
        }
    } finally {
        // --- 6. Finalizar ---
        isSpinning = false;
        const docSnap = await getDoc(userDocRef);
        updateBalanceUI(docSnap.data().balance);
    }
}

/**
 * Exibe símbolos de forma estática (sem animação).
 * Usado na inicialização para mostrar símbolos aleatórios em vez de vazio.
 * @param {Array<string>} reelsResult - Nomes dos símbolos (ex: ["Tigre", "7", "Cereja"])
 */
function updateReelsUI(reelsResult) {
    const reelDivs = Array.from(ui.reelsContainer.children);
    reelDivs.forEach((reelDiv, index) => {
        const strip = reelDiv.querySelector('.reel-strip');
        // Reseta sem transição para não animar na inicialização
        strip.style.transition = 'none';
        strip.style.transform  = 'translateY(0)';
        strip.innerHTML = '';

        const img = document.createElement('img');
        const nome = reelsResult[index];
        img.src = IMAGENS_SIMBOLOS[nome] || '';
        img.alt = nome || '';
        strip.appendChild(img);
    });
}


// --- Inicialização da Aplicação ---

/**
 * Função principal que é executada quando a página termina de carregar.
 */
function main() {
    if (!auth || !db) {
        console.error("Firebase não foi inicializado corretamente. Verifique o PASSO 1.");
        return; // Para a execução se o Firebase falhou
    }
    
    // 1. Liga todos os botões às suas funções
    ui.loginButton.addEventListener('click', handleGuestLogin);
    ui.logoutButton.addEventListener('click', handleLogout);
    ui.goToWalletButton.addEventListener('click', () => showView('wallet'));
    ui.goToGameButton.addEventListener('click', () => showView('game'));
    ui.depositButton.addEventListener('click', () => handleTransaction('deposit'));
    ui.withdrawButton.addEventListener('click', () => handleTransaction('withdraw'));
    ui.spinButton.addEventListener('click', handleSpin);

    // Botões − e + ajustam a aposta dentro dos limites do input
    document.getElementById('bet-down').addEventListener('click', () => {
        const input = ui.betAmountInput;
        const novoValor = parseInt(input.value, 10) - parseInt(input.step, 10);
        if (novoValor >= parseInt(input.min, 10)) input.value = novoValor;
        input.dispatchEvent(new Event('input')); // dispara a validação de saldo
    });

    document.getElementById('bet-up').addEventListener('click', () => {
        const input = ui.betAmountInput;
        const novoValor = parseInt(input.value, 10) + parseInt(input.step, 10);
        if (novoValor <= parseInt(input.max, 10)) input.value = novoValor;
        input.dispatchEvent(new Event('input'));
    });
    
    // 2. Ouve por mudanças no valor da aposta para desativar o botão
    ui.betAmountInput.addEventListener('input', async () => {
        if (!currentUserId) return;
        const docSnap = await getDoc(doc(db, "artifacts", "cassino-da-sorte", "users", currentUserId));
        const currentBalance = docSnap.data().balance;
        updateBalanceUI(currentBalance); // Re-valida o saldo vs aposta
    });

    // 3. Inicia o "porteiro" do Firebase
    // A função 'handleAuthStateChanged' será chamada assim que isto for executado
    onAuthStateChanged(auth, handleAuthStateChanged);
}

// Inicia a aplicação
main();

