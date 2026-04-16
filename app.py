import random
from flask import Flask, jsonify, request
from flask_cors import CORS

# 1. Inicialização do App
app = Flask(__name__)
# Permite que nosso frontend acesse este backend
CORS(app) 

# 2. Definição dos Símbolos e Pagamentos
SIMBOLOS = {
    "Laranja": {"multiplicador": 2, "peso": 10},
    "Cereja": {"multiplicador": 3, "peso": 8},
    "Sino": {"multiplicador": 5, "peso": 6},
    "BAR": {"multiplicador": 10, "peso": 4},
    "7": {"multiplicador": 20, "peso": 2},
    "Tigre": {"multiplicador": 50, "peso": 1} # O mais raro!
}

# Criamos listas separadas para os nomes e os pesos (probabilidades)
lista_simbolos = list(SIMBOLOS.keys())
lista_pesos = [item["peso"] for item in SIMBOLOS.values()]

# 3. A Lógica do Sorteio
@app.route("/spin", methods=['POST'])
def spin():
    # Lê os dados json enviados pelo frontend
    data = request.get_json()
    aposta = data.get('bet', 10) # Pega o valor de 'bet' ou usa 10 como padrão

    # Validação: garante que a aposta é um número positivo dentro de um limite razoável
    # Sem isso, alguém poderia mandar bet=-100 e ganhar dinheiro sem jogar
    if not isinstance(aposta, (int, float)) or aposta <= 0 or aposta > 10000:
        return jsonify({"error": "Aposta inválida."}), 400

    # Sorteia 3 símbolos usando os pesos definidos
    resultado_roleta = random.choices(lista_simbolos, weights=lista_pesos, k=3)
    
    ganho = 0
    mensagem = "Você não ganhou. Tente novamente!"
    
    # Se todos os 3 símbolos forem iguais
    if resultado_roleta[0] == resultado_roleta[1] == resultado_roleta[2]:
        simbolo_vencedor = resultado_roleta[0]
        multiplicador = SIMBOLOS[simbolo_vencedor]["multiplicador"]
        # O cálculo do ganho agora usa a aposta recebida
        ganho = aposta * multiplicador
        mensagem = f"Você ganhou! Combinação de {simbolo_vencedor}! Prêmio: {ganho} créditos."

    # 5. Envia a Resposta para o Frontend
    return jsonify({
        "reels": resultado_roleta,
        "winAmount": ganho,
        "message": mensagem
    })

# 6. Roda o servidor
if __name__ == "__main__":
    app.run(debug=True, port=5000)