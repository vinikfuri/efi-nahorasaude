const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

app.post("/", async (req, res) => {
  console.log("✅ Requisição recebida no proxy");
  const { method, endpoint, body } = req.body || {};

  if (!method || !endpoint || !body) {
    console.error("❌ Campos obrigatórios ausentes no payload");
    return res.status(400).json({ success: false, error: "Campos obrigatórios ausentes" });
  }

  const clientId = process.env.EFIPAY_CLIENT_ID;
  const clientSecret = process.env.EFIPAY_CLIENT_SECRET;
  const baseUrl = process.env.EFIPAY_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    console.error("❌ Variáveis de ambiente ausentes no Railway");
    return res.status(500).json({ success: false, error: "Credenciais EfiPay não configuradas" });
  }

  const fullUrl = `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
  const token = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await axios({
      method,
      url: fullUrl,
      headers: {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/json"
      },
      data: body,
      timeout: 10000 // 10 segundos
    });

    console.log("✅ Resposta recebida da EfiPay");
    return res.json(response.data);
  } catch (err) {
    console.error("❌ ERRO NO AXIOS:", err?.message);
    return res.status(500).json({
      success: false,
      error: "Erro ao processar proxy",
      details: err?.message || "Erro inesperado"
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ EfiPay proxy server running on port ${PORT}`);
});
