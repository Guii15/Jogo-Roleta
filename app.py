import random
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SIMBOLOS = {
    "Laranja": {"multiplicador": 2,  "peso": 10},
    "Cereja":  {"multiplicador": 3,  "peso": 8},
    "Sino":    {"multiplicador": 5,  "peso": 6},
    "BAR":     {"multiplicador": 10, "peso": 4},
    "7":       {"multiplicador": 20, "peso": 2},
    "Tigre":   {"multiplicador": 50, "peso": 1},
}

lista_simbolos = list(SIMBOLOS.keys())
lista_pesos    = [v["peso"] for v in SIMBOLOS.values()]
LOW_VALUE      = ["Laranja", "Cereja", "Sino"]


@app.route("/spin", methods=["POST"])
def spin():
    data   = request.get_json()
    aposta = data.get("bet", 10)

    if not isinstance(aposta, (int, float)) or aposta <= 0 or aposta > 10000:
        return jsonify({"error": "Aposta inválida."}), 400

    resultado = random.choices(lista_simbolos, weights=lista_pesos, k=3)
    ganho     = 0
    mensagem  = "Tente novamente!"
    near_miss = False
    win_type  = None

    if resultado[0] == resultado[1] == resultado[2]:
        simbolo = resultado[0]
        mult    = SIMBOLOS[simbolo]["multiplicador"]
        ganho   = round(aposta * mult, 2)

        if simbolo == "Tigre":
            win_type = "jackpot"
            mensagem = f"JACKPOT! Tigre x Tigre x Tigre! Premio: R$ {ganho:.2f}!"
        elif mult >= 10:
            win_type = "mega"
            mensagem = f"MEGA VITORIA! {simbolo} x 3! Premio: R$ {ganho:.2f}!"
        elif mult >= 5:
            win_type = "big"
            mensagem = f"GRANDE VITORIA! {simbolo} x 3! Premio: R$ {ganho:.2f}!"
        else:
            win_type = "win"
            mensagem = f"Ganhou! {simbolo} x 3! Premio: R$ {ganho:.2f}!"
    else:
        # 25% chance de near-miss para manter suspense
        if random.random() < 0.25:
            nm  = random.choice(LOW_VALUE)
            odd = random.randint(0, 2)
            resultado = [
                random.choice([s for s in LOW_VALUE if s != nm]) if i == odd else nm
                for i in range(3)
            ]
            near_miss = True

    return jsonify({
        "reels":     resultado,
        "winAmount": ganho,
        "message":   mensagem,
        "nearMiss":  near_miss,
        "winType":   win_type,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
