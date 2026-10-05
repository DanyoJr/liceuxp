import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const ai = new GoogleGenAI({});

async function analisarVideo() {
    console.log("Iniciando a Prova de Conceito (PoC) da API do Gemini...");
    
    // Caminho do vídeo local
    const caminhoVideo = './teste.mp4';
    
    try {
        if (!fs.existsSync(caminhoVideo)) {
            throw new Error(`Vídeo não encontrado. Por favor, coloque um vídeo chamado 'teste.mp4' na pasta liceuxp.`);
        }

        console.log("1. Fazendo upload do vídeo para a API do Gemini...");
        const uploadResult = await ai.files.upload({
            file: caminhoVideo,
            mimeType: 'video/mp4',
        });
        
        console.log(`Upload concluído! Nome do arquivo no Gemini: ${uploadResult.name}`);
        console.log("Aguardando o vídeo estar pronto para processamento (isso pode levar alguns segundos)...");

        let file = await ai.files.get({ name: uploadResult.name });
        while (file.state === 'PROCESSING') {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            file = await ai.files.get({ name: uploadResult.name });
        }

        if (file.state === 'FAILED') {
            throw new Error("O processamento do vídeo falhou na API do Google.");
        }

        console.log("\n\n2. Vídeo pronto. Solicitando análise ao Gemini (isso pode demorar um pouco)...");
        
        const prompt = `Você é um assistente de vídeo arbitragem (VAR) experimental. 
Analise este lance de futebol e devolva sua avaliação estruturada.
Avalie três categorias: impedimento, falta e mão na bola.
Para cada uma, forneça:
- decisao: "SIM", "NAO" ou "INCONCLUSIVO"
- justificativa: sua explicação baseada em evidências observáveis
- instantes_relevantes: array com os instantes aproximados de tempo em segundos, ex: ["00:04-00:06"] ou []
- limitacoes: array de problemas que impedem uma decisão certa (ângulo, resolução, etc)

Retorne estritamente um JSON no seguinte formato:
{
  "impedimento": {
    "decisao": "...",
    "justificativa": "...",
    "instantes_relevantes": [],
    "limitacoes": []
  },
  "falta": { ... },
  "mao_na_bola": { ... },
  "observacao_geral": "Análise experimental; não substitui a arbitragem humana."
}`;

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
        
        console.log("\n--- RESULTADO DA ANÁLISE ---");
        console.log(response.text);
        
        console.log("\nLimpeza: deletando o arquivo temporário na nuvem...");
        await ai.files.delete({ name: uploadResult.name });
        console.log("Arquivo apagado com sucesso.");

    } catch (error) {
        console.error("\nErro durante a PoC:", (error as Error).message);
    }
}

analisarVideo();
