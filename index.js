import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" })); // Aumenta limite de payload

app.post("/v1/chatbots/37768/messages", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages precisa ser um array" });
    }

    // Pega as últimas 50 mensagens enviadas pelo Janitor AI
    const lastMessages = messages.slice(-50);

    // Formata as mensagens de forma "crua" em um único texto estruturado
    const rawConversation = lastMessages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");

    // Payload exigido pelo endpoint de Chatbots do Anakin AI
    const payload = {
      content: rawConversation,
      stream: false 
    };

    // Requisição para a API do Anakin AI
    const response = await axios.post(
      `https://api.anakin.ai/v1/chatbots/37768/messages`,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${process.env.API_KEY}`,
          'X-Anakin-Api-Version': '2024-05-06',
          "Content-Type": "application/json"
        }
      }
    );

    let responseData = response.data;

    // Extrai o conteúdo da resposta do Anakin (geralmente vem em 'content' ou 'output')
    let content = responseData.content || responseData.output || "";

    if (content) {
      console.log("--- TEXTO RECEBIDO ---");
      console.log(content.substring(0, 100) + "...");

      // REMOÇÃO DAS TAGS DE PENSAMENTO DO DEEPSEEK R1
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
      content = content.replace(/<\/?think>/gi, "");
      content = content.replace(/^[\s\S]*?<\/think>/gi, "");
      
      content = content.trim();

      // Devolve no formato que o Janitor AI espera (Chat Completion da OpenAI)
      return res.json({
        id: "chatcmpl-" + Date.now(),
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: content
            },
            finish_reason: "stop"
          }
        ]
      });
    }

    res.json(responseData);

  } catch (err) {
    console.error("ERRO DO ANAKIN:", err.response?.data || err.message);
    res.status(500).json({ 
      error: "Erro no Anakin AI", 
      detalhes: err.response?.data?.body?.detail || err.response?.data || err.message 
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`API rodando na porta ${process.env.PORT || 3000}`);
});
