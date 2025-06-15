const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  const { endpoint, method, body } = req.body;
  if (!endpoint || !method || !body) {
    return res.status(400).json({ success: false, error: "Campos obrigatórios ausentes" });
  }

  try {
    const tokenRes = await axios({
      method: "POST",
      url: "https://pix.api.efipay.com.br/oauth/token",
      headers: { "Content-Type": "application/json" },
      auth: {
        username: process.env.EFI_CLIENT_ID,
        password: process.env.EFI_CLIENT_SECRET,
      },
      data: { grant_type: "client_credentials" }
    });

    const access_token = tokenRes.data?.access_token;
    if (!access_token) throw new Error("Token não obtido");

    const efipayRes = await axios({
      method,
      url: `https://pix.api.efipay.com.br/${endpoint}`,
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      data: body
    });

    return res.json(efipayRes.data);
  } catch (err) {
    console.error("[proxy][ERRO]", err?.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: "Erro ao processar proxy",
      details: err?.response?.data || err.message
    });
  }
});

app.listen(3000, () => {
  console.log("EfiPay proxy server running on port 3000");
});