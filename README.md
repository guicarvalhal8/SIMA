# NEXORA / SIMA

Plataforma academica institucional para monitoramento, sincronizacao, analise historica e apoio a decisao para aluno, professor, coordenacao e pro-reitoria.

## Stack

- Backend: FastAPI, SQLAlchemy, SQLite, Selenium, scikit-learn, Gemini
- Frontend: React, Vite, Tailwind, Framer Motion, Recharts
- Migracoes: Alembic

## Modulos principais

- autenticacao e autorizacao por papel
- sincronizacao do portal Lyceum
- dashboard do aluno
- dashboard e escopo docente
- upload de planilhas historicas
- central analitica
- exportacao em PDF, CSV, XLSX e JSON

## Perfis

- `student`
- `professor`
- `coordinator`
- `admin` na API, exibido como `proreitor` no frontend
- `viewer`

## Seguranca aplicada nesta versao

- `SECRET_KEY` removida do codigo-fonte e movida para ambiente
- credenciais do Lyceum armazenadas criptografadas
- bootstrap demo e criacao de admin padrao desativados por default
- `CORS` configuravel por origem explicita
- RBAC reforcado em alunos, cursos, notas e frequencia
- autenticacao web com access cookie curto + refresh rotativo `HttpOnly`
- upload historico com validacao de extensao, tamanho e limite de registros
- base de migracoes com Alembic adicionada

## Configuracao

Copie o exemplo:

```powershell
copy .env.example .env
```

Edite o `.env` e configure no minimo:

```env
SECRET_KEY=defina-um-segredo-forte
GEMINI_API_KEY=sua_chave_se_for_usar_ia
DATABASE_URL=sqlite:///./academico.db
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
REFRESH_TOKEN_EXPIRE_DAYS=7
ACCESS_COOKIE_NAME=nexora_access
REFRESH_COOKIE_NAME=nexora_refresh
SESSION_COOKIE_SAMESITE=lax
```

Observacoes:

- o frontend nao usa mais `localStorage` para guardar token de autenticacao
- o login cria cookies `HttpOnly` separados de acesso e refresh
- o frontend reidrata a sessao via `GET /api/auth/me` e renova acesso via `POST /api/auth/refresh`
- o servidor permite revogacao por sessao, logout global e controle por dispositivo
- em producao, habilite `SESSION_COOKIE_SECURE=true`

## Migracoes

O projeto agora usa Alembic como fluxo oficial.

Criar uma revisao:

```powershell
alembic revision --autogenerate -m "descricao"
```

Aplicar migracoes:

```powershell
alembic upgrade head
```

Observacao:

- `AUTO_CREATE_SCHEMA=false` e o padrao recomendado
- em ambiente local antigo, so use `AUTO_CREATE_SCHEMA=true` de forma temporaria, quando souber exatamente o que esta fazendo

## Executando o backend

```powershell
cd "C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Executando o frontend

```powershell
cd "C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main\frontend"
npm run dev
```

## URLs

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`

## Bootstrap demo

O modo demo ficou desativado por padrao.

So habilite se quiser subir um ambiente de demonstracao:

```env
ENABLE_DEMO_BOOTSTRAP=true
SEED_EMPTY_DATABASE=true
```

Para criar um admin inicial automaticamente:

```env
CREATE_DEFAULT_ADMIN=true
DEFAULT_ADMIN_PASSWORD=defina-uma-senha-forte
```

## Upload historico

Restricoes atuais:

- extensoes: `csv`, `xls`, `xlsx`, `txt`, `pdf`
- tamanho maximo controlado por `MAX_UPLOAD_BYTES`
- quantidade maxima de registros controlada por `MAX_HISTORICAL_RECORDS_PER_FILE`
- fallback de IA controlado por `ENABLE_GEMINI_UPLOAD_FALLBACK`

## Scraping Lyceum

Comportamento atual:

- usa Selenium
- tenta senha explicita salva pelo aluno
- fallback por CPF fica desativado por padrao

Se quiser reabilitar o fallback por CPF em ambiente controlado:

```env
ALLOW_LYCEUM_CPF_PASSWORD_FALLBACK=true
```

## Estrutura

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
```

## Documentacao tecnica completa

Leia:

- [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md)

## Gerenciamento de sessao

Endpoints novos de sessao:

- `POST /api/auth/refresh`
- `POST /api/auth/logout-all`
- `GET /api/auth/sessions`
- `DELETE /api/auth/sessions/{session_identifier}`

Uso esperado:

- access cookie expira rapido e pode ser renovado sem novo login enquanto o refresh estiver valido
- cada login cria uma sessao persistida no servidor
- o usuario pode revogar a sessao atual ou todas as sessoes
- o backend limita a quantidade de sessoes simultaneas por usuario

## Proximos passos recomendados

- migrar SQLite para PostgreSQL em ambiente compartilhado
- adicionar painel visual de gerenciamento de sessoes para o usuario no frontend
- incluir rate limit, lockout por tentativa e cabecalhos fortes de seguranca
- ampliar testes automatizados com banco isolado
- quebrar servicos e paginas monoliticas da analise historica
