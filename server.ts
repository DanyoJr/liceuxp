import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuração do Multer para salvar os uploads temporariamente
const upload = multer({ dest: 'uploads/' });

// Instância do Gemini
const ai = new GoogleGenAI({});

app.post('/api/analyze', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum vídeo enviado.' });
        }

        const category = req.body.category;
        if (!category || !['impedimento', 'falta', 'mao_na_bola'].includes(category)) {
            return res.status(400).json({ error: 'Categoria inválida. Escolha: impedimento, falta ou mao_na_bola.' });
        }

        console.log(`[Backend] Recebido vídeo de ${req.file.size} bytes para análise de: ${category}`);

        // 1. Upload para o Gemini
        const uploadResult = await ai.files.upload({
            file: req.file.path,
            config: {
                mimeType: req.file.mimetype || 'video/mp4'
            }
        });

        console.log(`[Backend] Upload feito. Aguardando processamento do arquivo ${uploadResult.name}...`);

        let fileState = await ai.files.get({ name: uploadResult.name });
        while (fileState.state === 'PROCESSING') {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            fileState = await ai.files.get({ name: uploadResult.name });
        }

        if (fileState.state === 'FAILED') {
            throw new Error('Falha no processamento do vídeo no Google Gemini.');
        }

        console.log(`[Backend] Vídeo pronto. Gerando análise para a categoria: ${category}...`);

        // 2. Monta o Prompt baseado na categoria escolhida
        const prompt = `Você é um assistente de vídeo arbitragem (VAR) experimental. 
Analise este lance de futebol focando EXCLUSIVAMENTE na seguinte infração: ${category.toUpperCase()}.

Para a categoria solicitada, forneça:
- decisao: "SIM" (ocorreu), "NAO" (não ocorreu) ou "INCONCLUSIVO" (não é possível determinar)
- justificativa: sua explicação baseada em evidências observáveis do vídeo.
- instantes_relevantes: array de strings com os momentos em segundos (ex: ["00:04-00:06"]) ou [] se não aplicável.
- limitacoes: array de problemas que impedem uma decisão certa (ângulo, resolução, etc).

Retorne estritamente um JSON no seguinte formato:
{
  "${category}": {
    "decisao": "...",
    "justificativa": "...",
    "instantes_relevantes": [],
    "limitacoes": []
  },
  "observacao_geral": "Análise experimental; não substitui a arbitragem humana."
}`;

        // 3. Chamada da API
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { fileData: { fileUri: uploadResult.uri, mimeType: uploadResult.mimeType } },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        // 4. Limpeza
        await ai.files.delete({ name: uploadResult.name });
        fs.unlinkSync(req.file.path);

        // 5. Retorna a resposta
        console.log(`[Backend] Análise concluída com sucesso.`);
        const jsonResponse = JSON.parse(response.text || '{}');
        res.json(jsonResponse);

    } catch (error: any) {
        console.error('[Backend] Erro na análise:', error.message);

        // Limpa o arquivo local se der erro no meio do caminho
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        // Se for erro de tráfego do Google, envia um 503 limpo para o front
        if (error.message && error.message.includes('503')) {
            return res.status(503).json({ error: 'Os servidores da IA estão lotados. Tente novamente em alguns instantes.' });
        }

        res.status(500).json({ error: 'Erro interno no servidor ao analisar o vídeo.' });
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor LiceuXP rodando na porta ${port}`);
});
