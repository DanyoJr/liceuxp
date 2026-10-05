# Documentação do Projeto LiceuXP (VAR Experimental)

Este documento detalha o funcionamento do projeto, as tecnologias utilizadas, a arquitetura geral e os passos para executá-lo. O projeto consiste em um sistema experimental de VAR (Video Assistant Referee) que utiliza Inteligência Artificial para analisar lances de futebol.

## 🛠 Tecnologias Utilizadas

O projeto é dividido em duas partes (Backend e Frontend), ambas escritas em **TypeScript**.

### Backend
- **Node.js** com **Express**: Servidor web principal para lidar com as requisições HTTP.
- **Multer**: Middleware utilizado para lidar com o upload temporário dos arquivos de vídeo enviados pelo cliente.
- **@google/genai**: SDK oficial do Google Gemini para interagir com a IA (modelo `gemini-3.8-flash`).
- **dotenv**: Para gerenciamento de variáveis de ambiente (como a chave da API do Gemini).
- **tsx**: Utilizado para executar o TypeScript diretamente sem precisar transpilar antes.

### Frontend
- **Vue 3**: Framework progressivo utilizado para a construção da interface de usuário.
- **Vite**: Ferramenta de build super rápida e servidor de desenvolvimento para o Vue.
- **TypeScript**: Tipagem estática para maior segurança no código.

---

## 🏗 Como foi feito

O desenvolvimento ocorreu em duas fases principais:

1. **Prova de Conceito (PoC - `poc.ts`)**:
   Inicialmente, foi criado um script simples para testar a comunicação com a API do Google Gemini. O objetivo era garantir que o upload do vídeo funcionaria, entender o tempo de processamento necessário e afinar o prompt enviado à IA para que ela retornasse a análise no formato desejado (JSON).

2. **API Completa (`server.ts`)**:
   Após o sucesso da PoC, foi desenvolvido um servidor Express robusto. Ele expõe o endpoint `/api/analyze`.
   O servidor foi projetado para:
   - Receber dinamicamente o vídeo via formulário multipart.
   - Validar as entradas (garantir que um arquivo foi enviado e que a categoria da infração é válida).
   - Gerenciar o ciclo de vida do arquivo temporário (salvar no disco local, enviar para o Google, e depois deletar de ambos os lugares para não ocupar espaço).
   - Tratar erros de requisição, como casos de o servidor da IA estar sobrecarregado (erro 503).

3. **Frontend**:
   Uma interface em Vue foi criada para permitir que o usuário faça o upload de um vídeo, escolha a categoria de análise e visualize o resultado retornado pelo backend.

---

## 🔄 Fluxo Esperado

1. **Seleção e Envio**: O usuário acessa o frontend, seleciona um vídeo (`.mp4`) e escolhe o tipo de infração que deseja analisar (Impedimento, Falta ou Mão na bola).
2. **Recepção no Backend**: O formulário é enviado para a rota POST `/api/analyze` do backend. O Multer intercepta a requisição e salva o vídeo na pasta `uploads/`.
3. **Upload para o Gemini**: O backend faz o upload do arquivo para os servidores do Google através do método `ai.files.upload`.
4. **Processamento**: O backend aguarda (fazendo requisições em *loop* a cada 2 segundos) até que o status do vídeo no Gemini mude de `PROCESSING` para concluído.
5. **Análise por IA**: Com o vídeo pronto, o backend envia um *prompt* detalhado instruindo o modelo `gemini-3.8-flash` a focar na infração selecionada, exigindo um formato de resposta rígido em JSON contendo:
   - Decisão (SIM, NÃO, INCONCLUSIVO)
   - Justificativa
   - Instantes relevantes (timeline em segundos)
   - Limitações da análise (ângulo ruim, baixa resolução, etc).
6. **Limpeza**: Após receber a resposta, o backend deleta o arquivo da nuvem (API do Google) e do disco local (`fs.unlinkSync`).
7. **Resposta ao Usuário**: O JSON de resposta é validado e enviado de volta ao frontend, onde o resultado é exibido na tela do usuário.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Ter o **Node.js** instalado na máquina.
- Ter uma chave de API válida do Google Gemini.

### Configurando o Backend
1. Navegue até a raiz do projeto.
2. Crie um arquivo `.env` baseado em um exemplo (se houver), ou apenas adicione a seguinte variável:
   ```env
   GEMINI_API_KEY=sua_chave_de_api_aqui
   ```
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
   *(O backend será iniciado, por padrão, na porta 3000)*

### Configurando o Frontend
1. Abra uma nova aba no terminal e navegue até a pasta `frontend`:
   ```bash
   cd frontend
   ```
2. Instale as dependências do Vue:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento do Vite:
   ```bash
   npm run dev
   ```
4. O terminal exibirá uma URL (geralmente `http://localhost:5173/`). Acesse-a no seu navegador para utilizar o sistema.
