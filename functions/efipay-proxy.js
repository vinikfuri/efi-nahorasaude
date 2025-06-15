const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = 8080;

app.use(bodyParser.json());

app.post("/", async (req, res) => {
  try {
    const { endpoint, method, body } = req.body;

    if (!endpoint || !method || !body) {
      console.error("❌ Proxy recebeu payload incompleto:", req.body);
      return res.status(400).json({
        success: false,
        error: "Payload incompleto",
        details: "Campos endpoint, method e body são obrigatórios"
      });
    }

    console.log("✅ Requisição recebida no proxy");
    console.log("➡️  Enviando para EfiPay:", method, `/v2/${endpoint}`);

    // Verifique se a variável de ambiente EFIPAY_TOKEN está configurada corretamente no Railway
    const accessToken = process.env.EFIPAY_TOKEN;
    if (!accessToken) {
      console.error("❌ Access token não definido");
      return res.status(500).json({ success: false, error: "Token não configurado" });
    }

    const response = await axios.request({
      method,
      url: `https://api.efipay.com.br/${endpoint}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      data: body
    });

    console.log("✅ Resposta recebida da EfiPay");
    return res.status(200).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || null;

    console.error("❌ ERRO NO AXIOS:", error.message);
    if (data) console.error("📄 Detalhes:", data);

    return res.status(status).json({
      success: false,
      error: "Erro ao processar proxy",
      details: data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ EfiPay proxy server running on port ${PORT}`);
});
