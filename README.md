# NEXORA / SIMA

Plataforma academica institucional para monitoramento, sincronizacao com portal academico, analise historica, predicao de risco e apoio a decisao para aluno, professor, coordenacao e pro-reitoria.

## Visao geral

O projeto e dividido em duas partes:

- `app/`: backend FastAPI
- `frontend/`: frontend React + Vite

Principais capacidades:

- autenticacao e autorizacao por papel
- sincronizacao do aluno com o portal Lyceum
- dashboards por perfil
- upload e organizacao de planilhas historicas
- central analitica com exportacao
- leitura de risco academico com camada estatistica

## Stack

### Backend

- FastAPI
- SQLAlchemy
- SQLite
- Alembic
- Selenium
- scikit-learn
- pandas
- reportlab

### Frontend

- React
- Vite
- Tailwind CSS
- Framer Motion
- Recharts
- Axios

## Perfis do sistema

- `student`
- `professor`
- `coordinator`
- `admin`
- `viewer`

No frontend, o papel `admin` aparece como `proreitor`.

## Seguranca atual

Esta versao ja inclui:

- `SECRET_KEY` fora do codigo-fonte
- credenciais do Lyceum armazenadas criptografadas
- RBAC reforcado nas rotas criticas
- CORS por lista explicita de origens
- upload historico com validacao de extensao, tamanho e volume
- access cookie curto + refresh token rotativo `HttpOnly`
- revogacao de sessao atual, logout global e revogacao por dispositivo
- migracoes com Alembic

## Estrutura do repositorio

```text
app/
  config.py
  database.py
  main.py
  models/
  routers/
  schemas/
  security/
  services/
  utils/
frontend/
  src/
seed/
tests/
alembic/
requirements.txt
alembic.ini
README.md
DOCUMENTACAO_TECNICA.md
```

## Pre-requisitos

- Python 3.11+ com `venv`
- Node.js 18+
- npm

Para scraping com Selenium:

- Google Chrome ou Microsoft Edge instalado

## Configuracao

Copie o arquivo de exemplo:

```powershell
copy .env.example .env
```

Configure no minimo:

```env
SECRET_KEY=defina-um-segredo-forte
DATABASE_URL=sqlite:///./academico.db
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ACCESS_COOKIE_NAME=nexora_access
REFRESH_COOKIE_NAME=nexora_refresh
REFRESH_TOKEN_EXPIRE_DAYS=7
SESSION_COOKIE_SAMESITE=lax
```

Configuracoes importantes:

- `AUTO_CREATE_SCHEMA=false` e o padrao recomendado
- `SESSION_COOKIE_SECURE=true` deve ser ligado em producao HTTPS
- `ENABLE_DEMO_BOOTSTRAP=false` por padrao
- `CREATE_DEFAULT_ADMIN=false` por padrao

## Como rodar o sistema manualmente

### 1. Entrar na pasta do projeto

```powershell
cd "C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main"
```

### 2. Criar a virtualenv, se ainda nao existir

```powershell
py -m venv .venv
```

### 3. Instalar dependencias do backend, se necessario

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 4. Aplicar migracoes

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

### 5. Subir o backend

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### 6. Em outro terminal, entrar no frontend

```powershell
cd "C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main\frontend"
```

### 7. Instalar dependencias do frontend, se necessario

```powershell
npm install
```

### 8. Subir o frontend

```powershell
npm run dev
```

## Enderecos

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`

## Fluxo de autenticacao

- o frontend nao guarda token de autenticacao em `localStorage`
- o backend emite:
  - access cookie curto
  - refresh cookie `HttpOnly`
- o frontend reidrata a sessao com `GET /api/auth/me`
- quando recebe `401`, tenta uma renovacao automatica com `POST /api/auth/refresh`
- o backend suporta:
  - `POST /api/auth/logout`
  - `POST /api/auth/logout-all`
  - `GET /api/auth/sessions`
  - `DELETE /api/auth/sessions/{session_identifier}`

## Modo demo e bootstrap

O modo demo nao sobe automaticamente.

Se quiser ambiente demonstrativo:

```env
ENABLE_DEMO_BOOTSTRAP=true
SEED_EMPTY_DATABASE=true
```

Se quiser criar admin inicial automaticamente:

```env
CREATE_DEFAULT_ADMIN=true
DEFAULT_ADMIN_PASSWORD=defina-uma-senha-forte
```

## Upload historico

Restricoes atuais:

- extensoes aceitas: `csv`, `xls`, `xlsx`, `txt`, `pdf`
- limite de tamanho por `MAX_UPLOAD_BYTES`
- limite de registros por `MAX_HISTORICAL_RECORDS_PER_FILE`
- fallback de IA controlado por `ENABLE_GEMINI_UPLOAD_FALLBACK`

## Scraping Lyceum

Comportamento atual:

- usa Selenium
- usa a senha explicita salva pelo aluno
- fallback de senha por CPF fica desativado por padrao

Para reabilitar o fallback em ambiente controlado:

```env
ALLOW_LYCEUM_CPF_PASSWORD_FALLBACK=true
```

## Testes

Rodar os testes principais da API:

```powershell
cd "C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main"
.\.venv\Scripts\python.exe -m pytest tests\test_api.py -q
```

Build do frontend:

```powershell
cd "C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main\frontend"
npm run build
```

## Documentacao complementar

- [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md)

## Proximos passos recomendados

- migrar SQLite para PostgreSQL em ambiente compartilhado
- adicionar rate limit e lockout por tentativa de login
- adicionar cabecalhos fortes de seguranca HTTP
- criar painel visual de gerenciamento de sessoes no frontend
- quebrar servicos e paginas muito grandes da area analitica
