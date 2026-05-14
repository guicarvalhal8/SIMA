# 🎓 SIMA — Sistema Inteligente de Monitoramento Acadêmico

![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)
![Python Version](https://img.shields.io/badge/python-3.11%2B-blue)
![React Version](https://img.shields.io/badge/react-18-61dafb)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-05998b)
![AI Powered](https://img.shields.io/badge/AI-Google%20Gemini-orange)

O **SIMA** é uma plataforma Fullstack estado-da-arte projetada para transformar a gestão educacional. Utilizando Inteligência Artificial (Google Gemini) e Web Scraping automatizado, o sistema permite que coordenadores e professores monitorem o desempenho dos alunos, prevejam riscos de evasão e tomem decisões baseadas em dados em tempo real.

---

## ✨ Principais Funcionalidades

### 🧠 Inteligência Artificial (Google Gemini)
- **Insights Estratégicos**: Geração automática de relatórios analíticos sobre a saúde da turma.
- **Mentor Digital**: Análise personalizada para cada aluno, sugerindo trilhas de estudo e motivação.
- **Chat para Professores**: Assistente virtual para tirar dúvidas sobre o desempenho da turma e sugerir intervenções.
- **Parsing Inteligente**: Extração automática de dados de planilhas históricas (CSV/Excel) via IA.

### 🌐 Sincronização Automatizada (Lyceum Scraper)
- **Integração UniEvangélica**: Sincronização direta de notas, faltas, horários e disciplinas do portal acadêmico.
- **Dados em Tempo Real**: Mantenha o sistema sempre atualizado com os dados oficiais sem entrada manual.

### 📊 Analytics & Predição
- **Score de Risco**: Algoritmo que classifica alunos em risco (Baixo, Médio, Alto, Crítico).
- **Visualização de Dados**: Gráficos de dispersão, histogramas de notas e correlação de presença vs. desempenho.
- **Gestão de Disciplinas**: Controle total sobre notas (VA1, VA2, VA3) e frequência.

---

## 🛠️ Stack Tecnológica

### Backend (Python/FastAPI)
- **FastAPI**: API de alta performance com tipagem estática.
- **SQLAlchemy & SQLite**: Persistência de dados robusta e leve.
- **Google Generative AI**: Integração com o modelo Gemini 1.5 Flash.
- **Selenium**: Engine de Web Scraping para automação acadêmica.

### Frontend (React/Vite)
- **React 18**: Interface reativa e moderna.
- **TailwindCSS**: Estilização premium com efeitos de glassmorphism e tema dark.
- **Framer Motion**: Micro-animações fluidas.
- **Recharts**: Visualização de dados complexos em gráficos interativos.

---

## 🚀 Como Executar o Projeto

### 1. Pré-requisitos
- **Python 3.11+**
- **Node.js 18+**
- **Google Gemini API Key** (Obtenha [aqui](https://aistudio.google.com/app/apikey))

### 2. Configuração (Variáveis de Ambiente)
Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:
```env
# Google Gemini
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-1.5-flash

# API Config
APP_NAME=SIMA
APP_VERSION=1.0.0
```

### 3. Rodando com um clique (Windows)
Basta executar o arquivo **`run.bat`** na raiz do projeto. Ele irá:
1. Ativar o ambiente virtual Python.
2. Iniciar o Servidor API na porta `8000`.
3. Instalar dependências e iniciar o Frontend na porta `5173`.

### 4. Credenciais de Demonstração
| Perfil | E-mail | Senha |
| :--- | :--- | :--- |
| **Administrador** | `admin@sima.com` | `admin123` |
| **Professor** | (Use um código de matrícula: `20001` até `20010`) | (Criada no registro) |
| **Aluno** | (Use o fluxo de cadastro para criar seu perfil) | (Criada no registro) |

---

## 📂 Estrutura do Projeto

```text
├── app/                  # 🧠 Backend (API & Serviços)
│   ├── analytics/        # Motores estatísticos
│   ├── models/           # Definições do Banco (ORM)
│   ├── routers/          # Endpoints da API
│   ├── services/         # Gemini & Scraper Services
│   └── main.py           # Entrypoint da aplicação
├── frontend/             # 🎨 Frontend (React App)
│   ├── src/components/   # Componentes UI reusáveis
│   ├── src/pages/        # Telas do sistema
│   └── src/services/     # Integração com a API
├── seed/                 # Scripts de população de banco
├── run.bat               # Script automatizado de startup
└── requirements.txt      # Dependências Python
```

---

## 🛡️ Licença

Este projeto está sob a licença [MIT](LICENSE).

---
Desenvolvido para revolucionar a educação com tecnologia de ponta. 🚀
