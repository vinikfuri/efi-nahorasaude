// functions/efipay-proxy.js

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

console.log("✅ EfiPay proxy server inicializando...");

app.post("/", async (req, res) => {
  const { endpoint, method, body } = req.body;

  if (!endpoint || !method || !body) {
    return res.status(400).json({
      success: false,
      error: "Campos obrigatórios ausentes",
      details: { endpoint, method, body }
    });
  }

  console.log("✅ Requisição recebida no proxy");
  console.log("➡️ Endpoint:", endpoint);
  console.log("➡️ Método:", method);
  console.log("➡️ Corpo:", JSON.stringify(body));

  try {
    const clientId = process.env.EFIPAY_CLIENT_ID;
    const clientSecret = process.env.EFIPAY_CLIENT_SECRET;
    const pixKey = process.env.EFIPAY_PIX_KEY;

    const tokenRes = await axios({
      method: "POST",
      url: "https://api.efipay.com.br/v1/authorize",
      headers: {
        "Content-Type": "application/json"
      },
      auth: {
        username: clientId,
        password: clientSecret
      }
    });

    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) {
      console.error("❌ Erro ao obter token da EfiPay");
      return res.status(500).json({
        success: false,
        error: "Erro ao obter token da EfiPay"
      });
    }

    console.log("✅ Token recebido com sucesso");

    // Se o campo 'chave' não estiver presente no body, insere automaticamente do env
    if (!body.chave && pixKey) {
      body.chave = pixKey;
    }

    const efipayRes = await axios({
      method,
      url: `https://api.efipay.com.br/${endpoint}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      data: body
    });

    console.log("✅ Resposta recebida da EfiPay");
    return res.status(200).json(efipayRes.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || null;

    console.error("❌ ERRO NO AXIOS:", error.message);
    if (error.response) {
      console.error("📄 Response Headers:", error.response.headers);
      console.error("📄 Response Data:", data);
    } else if (error.request) {
      console.error("📄 Nenhuma resposta recebida da EfiPay:", error.request);
    } else {
      console.error("📄 Erro ao montar requisição:", error.message);
    }

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
