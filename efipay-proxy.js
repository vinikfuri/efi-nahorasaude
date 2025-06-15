const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const EFIPAY_CLIENT_ID = process.env.EFIPAY_CLIENT_ID;
const EFIPAY_CLIENT_SECRET = process.env.EFIPAY_CLIENT_SECRET;
const EFIPAY_PIX_KEY = process.env.EFIPAY_PIX_KEY;

app.post("/", async (req, res) => {
  try {
    const payload = req.body;

    if (!EFIPAY_CLIENT_ID || !EFIPAY_CLIENT_SECRET || !EFIPAY_PIX_KEY) {
      return res.status(500).json({ success: false, error: "Credenciais EfiPay não configuradas" });
    }

    const basic = Buffer.from(`${EFIPAY_CLIENT_ID}:${EFIPAY_CLIENT_SECRET}`).toString("base64");
    const tokenResponse = await fetch("https://pix.api.efipay.com.br/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenResponse.json();
    const efipay_token = tokenData.access_token;

    const txid = `txid-na-hora-${Date.now().toString().slice(-8)}`;
    const chargePayload = {
      calendario: { expiracao: 3600 },
      devedor: { nome: payload.nome_cliente, cpf: payload.cpf_cliente },
      valor: { original: payload.valor.toFixed(2) },
      chave: EFIPAY_PIX_KEY,
      solicitacaoPagador: payload.descricao || "Plano NaHoraSaude",
      infoAdicionais: [
        { nome: "Cliente", valor: payload.nome_cliente },
        { nome: "Franqueado", valor: payload.franqueado_codigo },
        { nome: "Plano", valor: "NaHoraSaude" }
      ]
    };

    const chargeResponse = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${efipay_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chargePayload)
    });

    const chargeResult = await chargeResponse.json();

    return res.status(200).json({
      success: true,
      data: {
        txid,
        qr_code: chargeResult.pixCopiaECola,
        qr_code_image: chargeResult.qrcode,
        efipay_response: chargeResult
      }
    });

  } catch (err) {
    console.error("Erro ao processar requisição:", err);
    return res.status(500).json({ success: false, error: "Erro interno", details: err.message });
  }
});

app.listen(3000, () => {
  console.log("Servidor iniciado na porta 3000");
});