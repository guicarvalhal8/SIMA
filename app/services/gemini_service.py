"""
Serviço de Insights com IA — Google Gemini.

Recebe dados agregados do sistema (KPIs, correlações, alunos em risco)
e utiliza o Gemini para gerar insights estratégicos, padrões e
recomendações que complementam os algoritmos tradicionais.
"""

import json
import logging
import re
from typing import Dict, Any, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class GeminiInsightsService:
    """
    Orquestra chamadas ao Gemini para análise inteligente
    dos dados acadêmicos.
    """

    def __init__(self):
        self._model = None
        self._available = False
        self._init_client()

    def _init_client(self):
        """Inicializa o client do Gemini se a API key estiver configurada."""
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY não configurada. Insights IA desabilitados.")
            return

        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._model = genai.GenerativeModel(settings.GEMINI_MODEL)
            self._available = True
            logger.info(f"Gemini configurado com modelo: {settings.GEMINI_MODEL}")
        except Exception as e:
            logger.error(f"Erro ao inicializar Gemini: {e}")

    @property
    def is_available(self) -> bool:
        return self._available

    @staticmethod
    def _extract_json(text: str) -> dict:
        """
        Tenta extrair JSON válido de uma string que pode conter texto extra,
        blocos markdown, ou thinking blocks do modelo.
        """
        cleaned = text.strip()

        # 0) Remover blocos de "thinking" (<think>...</think>)
        # Modelos mais novos (como 2.5) podem incluir isso.
        cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()

        # 1) Remover blocos de código markdown (```json ... ``` ou ``` ... ```)
        # O regex anterior pegava apenas o primeiro bloco. Vamos tentar ser mais abrangentes.
        md_match = re.search(r"```(?:json)?\s*\n?(.*?)```", cleaned, re.DOTALL)
        if md_match:
            cleaned = md_match.group(1).strip()

        # 2) Tentar parsear diretamente
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # 3) Procurar o primeiro objeto JSON válido na string (entre { e })
        # Vamos tentar encontrar o primeiro '{' e o último '}'
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')

        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            possible_json = cleaned[start_idx : end_idx + 1]
            try:
                return json.loads(possible_json)
            except json.JSONDecodeError:
                pass

        # 3.5) Procurar array JSON (entre [ e ])
        start_arr = cleaned.find('[')
        end_arr = cleaned.rfind(']')

        if start_arr != -1 and end_arr != -1 and end_arr > start_arr:
            possible_json = cleaned[start_arr : end_arr + 1]
            try:
                return json.loads(possible_json)
            except json.JSONDecodeError:
                pass

        # 4) Tentar reparar JSON truncado (Best Effort)
        try:
            return GeminiInsightsService._repair_json(cleaned)
        except Exception:
            pass

        # 5) Nenhuma extração funcionou
        raise json.JSONDecodeError("Não foi possível extrair JSON da resposta", cleaned, 0)

    @staticmethod
    def _repair_json(text: str) -> dict:
        """
        Tenta reparar um JSON truncado fechando chaves e colchetes abertos.
        """
        text = text.strip()
        # Encontrar o início do JSON (pode ser { ou [)
        start_obj = text.find('{')
        start_arr = text.find('[')
        
        if start_obj == -1 and start_arr == -1:
            raise ValueError("Não encontrou início de JSON")
        
        if start_arr != -1 and (start_obj == -1 or start_arr < start_obj):
            start = start_arr
        else:
            start = start_obj
        
        text = text[start:]
        
        # Contar aberturas e fechamentos
        open_braces = text.count('{')
        close_braces = text.count('}')
        open_brackets = text.count('[')
        close_brackets = text.count(']')
        
        # Adicionar fechamentos faltantes (ordem simplificada)
        # Assumindo que o corte foi no final, geralmente precisamos fechar
        # strings, arrays e objetos nesta ordem.
        
        # Se terminou no meio de uma string, fecha a aspa
        if text.count('"') % 2 != 0:
            text += '"'
            
        # Fechar colchetes e chaves faltantes
        text += ']' * (open_brackets - close_brackets)
        text += '}' * (open_braces - close_braces)
        
        return json.loads(text)

    def _build_prompt(
        self,
        kpis: Dict[str, Any],
        correlations: Dict[str, Any],
        risk_students: List[Dict[str, Any]],
        recommendations_summary: Dict[str, Any],
    ) -> str:
        """Monta o prompt estruturado para o Gemini."""

        risk_list = "\n".join([
            f"  - {s['student_name']} (ID: {s['student_id']}): "
            f"GPA={s.get('gpa', 'N/A')}, Frequência={s.get('attendance_rate', 'N/A')}%, "
            f"Risco={s.get('risk_score', 'N/A')}"
            for s in risk_students[:15]
        ])

        corr_text = ""
        if "pairs" in correlations:
            corr_text = "\n".join([
                f"  - {p.get('pair', 'N/A')}: r={p.get('coefficient', 'N/A')}"
                for p in correlations.get("pairs", [])[:10]
            ])

        prompt = f"""Você é um analista acadêmico especializado. Analise os dados abaixo de uma 
instituição de ensino e gere insights estratégicos em português brasileiro.

═══ DADOS DO SISTEMA ═══

📊 KPIs ATUAIS:
  - Total de alunos: {kpis.get('total_students', 0)}
  - Alunos ativos: {kpis.get('active_students', 0)}
  - Disciplinas: {kpis.get('total_courses', 0)}
  - GPA médio: {kpis.get('average_gpa', 0)}
  - Frequência média: {kpis.get('average_attendance_rate', 0)}%
  - Alunos em risco: {kpis.get('at_risk_count', 0)}
  - Taxa de aprovação: {kpis.get('pass_rate', 0)}%

📈 CORRELAÇÕES ENTRE VARIÁVEIS:
{corr_text if corr_text else "  Dados não disponíveis"}

⚠️ ALUNOS COM MAIOR RISCO DE EVASÃO:
{risk_list if risk_list else "  Nenhum aluno em risco identificado"}

📋 RESUMO DAS RECOMENDAÇÕES TRADICIONAIS:
  - Total de recomendações: {recommendations_summary.get('total_recommendations', 0)}
  - Por prioridade: {json.dumps(recommendations_summary.get('by_priority', {}), ensure_ascii=False)}

═══ INSTRUÇÕES ═══

Com base nos dados acima, gere uma análise em formato JSON com a seguinte estrutura.
IMPORTANTE: Seja EXTREMAMENTE CONCISO para economizar tokens.
Responda APENAS com o JSON. NÃO USE MARKDOWN. NÃO USE ```json.

{{
  "patterns": [
    {{
      "title": "Título curto",
      "description": "Descrição max 1 frase.",
      "severity": "high" | "medium" | "low",
      "affected_percentage": numero
    }}
  ],
  "focus_students": [
    {{
      "student_name": "Nome",
      "student_id": ID,
      "reason": "Motivo curto",
      "suggested_action": "Ação curta"
    }}
  ],
  "strategic_recommendations": [
    {{
      "title": "Título",
      "description": "Descrição max 1 frase",
      "impact": "high" | "medium" | "low",
      "category": "academic" | "support" | "institutional" | "monitoring"
    }}
  ],
  "summary": "Resumo geral em 1 frase."
}}

Gere no MÁXIMO 2 itens por categoria. Priorize o essencial."""

        return prompt

    def _build_student_prompt(
        self,
        student_name: str,
        course: str,
        kpis: Dict[str, Any],
        history: List[Dict[str, Any]],
        recommendations: List[Dict[str, Any]],
    ) -> str:
        """Monta prompt personalizado para análise de um único aluno."""

        # Formatar histórico de disciplinas
        history_text = "\n".join([
            f"  - {h.get('disciplina', 'N/A')}: Média={h.get('media', 0)}, "
            f"Situação={h.get('situacao', 'N/A')}"
            for h in (history or [])[:15]
        ]) or "  Nenhuma disciplina registrada"

        # Formatar recomendações do sistema
        recs_text = "\n".join([
            f"  - [{r.get('priority', 'N/A').upper()}] {r.get('title', '')}: {r.get('message', '')[:80]}"
            for r in (recommendations or [])[:5]
        ]) or "  Nenhuma recomendação"

        # Classificar risco em texto legível
        risk_score = kpis.get('risk_score', 0)
        risk_label = kpis.get('risk_level', 'low')

        prompt = f"""Você é um mentor acadêmico pessoal e empático. Analise o perfil abaixo de um 
aluno universitário e gere conselhos PERSONALIZADOS, práticos e motivadores em português brasileiro.

═══ PERFIL DO ALUNO ═══

👤 Nome: {student_name}
🎓 Curso: {course or 'Não informado'}

📊 INDICADORES ATUAIS:
  - Média Geral (GPA): {kpis.get('gpa', 0)}
  - Taxa de Presença: {kpis.get('attendance_rate', 0)}%
  - Reprovações: {kpis.get('failures', 0)}
  - Tendência de Notas: {kpis.get('grade_trend', 0)} (positivo = melhorando)
  - Score de Risco: {risk_score} ({risk_label})

📚 DISCIPLINAS ATUAIS:
{history_text}

📋 ALERTAS DO SISTEMA:
{recs_text}

═══ INSTRUÇÕES ═══

IMPORTANTE: Você está falando DIRETAMENTE com o aluno. Use "você" e seja encorajador.
Se o GPA for 0.0 e as disciplinas estiverem "Em andamento", isso significa que o semestre 
acabou de começar e as notas ainda não foram lançadas — NÃO trate como problema.
Foque em dicas práticas para o semestre atual.

Gere uma análise em formato JSON com a estrutura abaixo.
Responda APENAS com o JSON puro. NÃO use markdown. NÃO use ```json.

{{
  "summary": "Resumo geral do seu momento acadêmico em 2-3 frases, falando diretamente com o aluno.",
  "strengths": [
    {{
      "title": "Ponto forte identificado",
      "description": "Explicação curta e motivadora"
    }}
  ],
  "alerts": [
    {{
      "title": "Ponto de atenção",
      "description": "O que o aluno deve ficar atento",
      "severity": "high" | "medium" | "low"
    }}
  ],
  "study_tips": [
    {{
      "title": "Dica prática",
      "description": "Conselho específico para melhorar",
      "category": "study" | "organization" | "wellbeing" | "career"
    }}
  ],
  "motivation": "Uma frase motivacional personalizada para o contexto do aluno."
}}

Gere no MÁXIMO 2 itens por categoria. Seja CONCISO e ESPECÍFICO ao contexto do aluno."""

        return prompt

    async def analyze_student(
        self,
        student_name: str,
        course: str,
        kpis: Dict[str, Any],
        history: List[Dict[str, Any]],
        recommendations: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Gera insights personalizados para um aluno individual usando o Gemini.
        """
        if not self._available:
            return {
                "error": "Serviço de IA não disponível. Configure GEMINI_API_KEY no arquivo .env",
                "available": False,
            }

        try:
            prompt = self._build_student_prompt(
                student_name, course, kpis, history, recommendations
            )

            import asyncio
            response = await asyncio.to_thread(
                self._model.generate_content,
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json",
                },
            )

            # Extrair texto da resposta
            text = ""
            try:
                text = response.text
            except Exception:
                for candidate in getattr(response, "candidates", []):
                    for part in getattr(candidate.content, "parts", []):
                        part_text = getattr(part, "text", None)
                        if part_text and part_text.strip():
                            text = part_text
                            break
                    if text:
                        break

            if not text or not text.strip():
                logger.error(f"Resposta vazia do Gemini (student). Response: {response}")
                return {
                    "error": "A IA retornou uma resposta vazia. Tente novamente.",
                    "available": True,
                }

            logger.debug(f"Resposta Gemini student ({len(text)} chars): {text[:500]}")

            result = self._extract_json(text)

            # Validar estrutura mínima
            result.setdefault("summary", "Análise concluída.")
            result.setdefault("strengths", [])
            result.setdefault("alerts", [])
            result.setdefault("study_tips", [])
            result.setdefault("motivation", "Continue se dedicando!")
            result["available"] = True
            result["model"] = settings.GEMINI_MODEL

            return result

        except json.JSONDecodeError as e:
            logger.error(f"Erro ao parsear resposta do Gemini (student): {e}")
            return {
                "error": "A IA retornou uma resposta em formato inválido. Tente novamente.",
                "available": True,
            }
        except Exception as e:
            logger.error(f"Erro na chamada ao Gemini (student): {e}", exc_info=True)
            return {
                "error": f"Erro ao gerar análise: {str(e)}",
                "available": True,
            }

    async def analyze(
        self,
        kpis: Dict[str, Any],
        correlations: Dict[str, Any],
        risk_students: List[Dict[str, Any]],
        recommendations_summary: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Gera insights usando o Gemini.

        Returns:
            Dict com patterns, focus_students, strategic_recommendations e summary.
            Em caso de erro, retorna dict com campo 'error'.
        """
        if not self._available:
            return {
                "error": "Serviço de IA não disponível. Configure GEMINI_API_KEY no arquivo .env",
                "available": False,
            }

        try:
            prompt = self._build_prompt(kpis, correlations, risk_students, recommendations_summary)

            # Chamada ao Gemini (síncrona, wrappada em async)
            import asyncio
            response = await asyncio.to_thread(
                self._model.generate_content,
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json",
                },
            )

            # Extrair texto da resposta — modelos "thinking" (2.5-*) podem
            # ter várias parts; precisamos iterar para encontrar text válido.
            text = ""
            try:
                # Método padrão
                text = response.text
            except Exception:
                # Fallback: iterar pelos candidates / parts
                for candidate in getattr(response, "candidates", []):
                    for part in getattr(candidate.content, "parts", []):
                        part_text = getattr(part, "text", None)
                        if part_text and part_text.strip():
                            text = part_text
                            break
                    if text:
                        break

            if not text or not text.strip():
                logger.error(f"Resposta vazia do Gemini. Response: {response}")
                return {
                    "error": "A IA retornou uma resposta vazia. Tente novamente.",
                    "available": True,
                }

            logger.debug(f"Resposta bruta do Gemini ({len(text)} chars): {text[:500]}")

            # Extrair JSON de forma robusta
            result = self._extract_json(text)

            # Validar estrutura mínima
            result.setdefault("patterns", [])
            result.setdefault("focus_students", [])
            result.setdefault("strategic_recommendations", [])
            result.setdefault("summary", "Análise concluída sem resumo.")
            result["available"] = True
            result["model"] = settings.GEMINI_MODEL

            return result

        except json.JSONDecodeError as e:
            logger.error(f"Erro ao parsear resposta do Gemini: {e}")
            logger.error(f"Texto recebido (primeiros 1000 chars): {text[:1000] if text else '(vazio)'}")
            return {
                "error": "A IA retornou uma resposta em formato inválido. Tente novamente.",
                "available": True,
            }

    async def chat(
        self,
        message: str,
        kpis: Dict[str, Any],
        risk_students: List[Dict[str, Any]],
        history: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Conversa com o professor de forma estratégica e personalizada.
        """
        if not self._available:
            return "Serviço de IA não disponível."

        try:
            risk_list = "\n".join([
                f"- {s['student_name']} (ID: {s['student_id']}): GPA={s.get('gpa', 'N/A')}, Risco={s.get('risk_level', 'N/A')}"
                for s in risk_students[:10]
            ])

            system_instruction = f"""Você é um Consultor Estratégico Acadêmico assistindo um professor.
Seu objetivo é ajudar o professor a interpretar dados, identificar padrões de comportamento dos alunos e sugerir intervenções pedagógicas.

═══ CONTEXTO DA TURMA ═══
- Total de Alunos: {kpis.get('total_students', 0)}
- GPA Médio: {kpis.get('average_gpa', 0)}
- Taxa de Presença: {kpis.get('average_attendance_rate', 0)}%
- Alunos em Risco Crítico/Alto:
{risk_list if risk_list else "Nenhum no momento."}

═══ REGRAS DE COMPORTAMENTO ═══
1. Foco em Pedagogia: Sugira métodos de ensino, mentorias ou feedbacks.
2. Análise de Padrões: Se o professor perguntar sobre tendências, analise os números fornecidos.
3. Tom Profissional e Colaborativo: Você é um parceiro do professor.
4. Respostas Curtas e Práticas: Evite textos longos demais.
5. Se não tiver um dado específico, peça ao professor ou sugira onde ele pode encontrar no sistema.
"""
            
            # Formatar chat session (simplificado para stateless no backend por enquanto)
            # Todo: Implementar histórico propriamente se necessário
            full_prompt = f"{system_instruction}\n\nProfessor pergunta: {message}"

            import asyncio
            response = await asyncio.to_thread(
                self._model.generate_content,
                full_prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 2048,
                },
            )

            text = ""
            try:
                text = response.text
            except Exception:
                for candidate in getattr(response, "candidates", []):
                    for part in getattr(candidate.content, "parts", []):
                        part_text = getattr(part, "text", None)
                        if part_text and part_text.strip():
                            text = part_text
                            break
                    if text: break

            return text or "Não consegui gerar uma resposta."

        except Exception as e:
            logger.error(f"Erro no chat Gemini: {e}")
            return f"Erro ao processar conversa: {str(e)}"

    async def parse_historical_spreadsheet(self, spreadsheet_text: str) -> List[Dict[str, Any]]:
        """
        Analisa o texto de uma planilha (CSV/Excel extraído) e extrai registros estruturados.
        """
        if not self._available:
            logger.error("Gemini not available for spreadsheet parsing")
            return []

        # Truncate if needed
        if len(spreadsheet_text) > 15000:
            spreadsheet_text = spreadsheet_text[:15000]
            logger.info("Spreadsheet text truncated to 15000 chars")

        prompt = f"""Você é um extrator de dados especialista. Abaixo está o conteúdo de uma planilha 
acadêmica de semestres passados de uma universidade brasileira.

Sua tarefa é extrair os dados de cada linha e organizar em um formato JSON padronizado.

CONTEÚDO DA PLANILHA:
---
{spreadsheet_text}
---

MAPEAMENTO DE COLUNAS COMUNS:
- ID_ALUNO / MATRICULA / RA → use como student_name (se não houver nome, use o ID como nome: "Aluno 12345")
- NOME / NOME_ALUNO → student_name
- NOME_CURSO / COD_CURSO → course_name  
- NOME_DISCIPLINA / COD_DISCIPLINA → subject (matéria)
- ANO + SEMESTRE / SEM_LETIVO → semester (combine como "2024-1")
- SERIE / PERIODO → period
- SITUACAO / SITUAÇÃO → coloque em grades como {{"SITUAÇÃO": "valor"}}
- NOTA / MEDIA / N1 / N2 / NOTA_FINAL → coloque em grades
- FREQUENCIA / FREQ / FALTAS → attendance (se for FALTAS, converta: 100 - faltas)
- TURMA → pode ignorar ou incluir como info adicional

INSTRUÇÕES:
1. Retorne uma LISTA JSON de objetos.
2. Cada objeto DEVE ter estas chaves:
   - "semester": String (ex: "2024-1"). Se tiver ANO e SEMESTRE separados, combine: ANO + "-" + SEMESTRE
   - "course_name": String (nome do curso)
   - "subject": String (nome da disciplina/matéria)
   - "period": Inteiro ou null
   - "student_name": String (nome ou ID do aluno)  
   - "grades": Objeto com todas as notas e situação encontradas
   - "attendance": Numero (0-100) ou null
3. Extraia TODOS os registros/linhas da planilha.
4. Se um campo não existir na planilha, use valores padrão ("Desconhecido", null, {{}}).
5. Responda APENAS com o JSON válido. SEM markdown, SEM comentários.
"""

        try:
            import asyncio
            response = await asyncio.to_thread(
                self._model.generate_content,
                prompt,
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 8192,
                },
            )

            # Extract text robustly
            text = ""
            try:
                text = response.text
            except Exception:
                for candidate in getattr(response, "candidates", []):
                    for part in getattr(candidate.content, "parts", []):
                        part_text = getattr(part, "text", None)
                        if part_text and part_text.strip():
                            text = part_text
                            break
                    if text: break

            if not text or not text.strip():
                logger.error(f"Empty response from Gemini for spreadsheet parsing. Response: {response}")
                return []

            logger.info(f"Gemini spreadsheet response ({len(text)} chars): {text[:1000]}")

            result = self._extract_json(text)
            
            if isinstance(result, list):
                logger.info(f"Parsed {len(result)} records from list")
                return result
            elif isinstance(result, dict):
                # Try to find a list in any key of the dict
                for key, value in result.items():
                    if isinstance(value, list) and len(value) > 0:
                        logger.info(f"Parsed {len(value)} records from dict key '{key}'")
                        return value
                # If dict has the expected fields, wrap in a list
                if "student_name" in result or "semester" in result:
                    logger.info("Parsed 1 record from dict")
                    return [result]
            
            logger.error(f"Unexpected result type: {type(result)}, content: {str(result)[:500]}")
            return []

        except Exception as e:
            logger.error(f"Erro ao parsear planilha histórica: {e}", exc_info=True)
            return []

    async def chat_with_file(
        self,
        message: str,
        file_content: str,
        kpis: Dict[str, Any],
        risk_students: List[Dict[str, Any]]
    ) -> str:
        """
        Realiza análise temporária de um arquivo no chat.
        """
        if not self._available:
            return "Serviço de IA não disponível."

        try:
            system_instruction = f"""Você é um Consultor Estratégico Acadêmico. 
O professor acabou de carregar um arquivo para análise temporária.
Analise o conteúdo do arquivo abaixo em conjunto com a pergunta do professor.

CONTEÚDO DO ARQUIVO:
---
{file_content[:5000]}  # Limitar para não estourar o contexto
---

Contexto Geral da Turma: {kpis.get('total_students', 0)} alunos, GPA {kpis.get('average_gpa', 0)}.
"""
            full_prompt = f"{system_instruction}\n\nPergunta do Professor: {message}"

            import asyncio
            response = await asyncio.to_thread(
                self._model.generate_content,
                full_prompt,
                generation_config={"temperature": 0.7},
            )

            return response.text
        except Exception as e:
            logger.error(f"Erro no chat com arquivo: {e}")
            return f"Erro ao processar arquivo: {str(e)}"

    async def chat_historical_insights(
        self,
        message: str,
        records_summary: str,
        total_records: int,
    ) -> str:
        """
        Chat com o professor sobre insights dos dados históricos.
        Completamente isolado dos dados atuais de alunos.
        """
        if not self._available:
            return "Serviço de IA não disponível."

        try:
            system_instruction = f"""Você é um Analista de Dados Acadêmicos Históricos.
Você está analisando EXCLUSIVAMENTE dados de semestres PASSADOS carregados pelo professor.
ATENÇÃO: NÃO misture com dados de alunos atuais do sistema. Foque APENAS nos dados históricos abaixo.

═══ DADOS HISTÓRICOS (Total: {total_records} registros) ═══
{records_summary[:8000]}

═══ SEU PAPEL ═══
1. Identificar PADRÕES: disciplinas com maiores índices de reprovação, sazonalidade, tendências ao longo dos semestres
2. Detectar ANOMALIAS: turmas com desempenho muito acima ou abaixo da média
3. Sugerir TRATAMENTO DE DADOS: limpeza, normalização, agrupamentos úteis
4. Fornecer INSIGHTS PEDAGÓGICOS: o que os dados históricos revelam para melhorar o ensino futuro
5. Recomendar INTERVENÇÕES PREVENTIVAS baseadas em padrões históricos de evasão/reprovação
6. Ser PRÁTICO e DIRETO: forneça dados concretos quando possível (percentuais, médias, etc.)

Se o professor não fizer uma pergunta específica, gere uma análise geral completa com:
- Resumo dos dados
- Principais padrões encontrados
- Disciplinas mais críticas
- Tendências ao longo dos semestres
- Recomendações práticas

Responda em português brasileiro, de forma profissional e com dados concretos."""

            full_prompt = f"{system_instruction}\n\nProfessor: {message}"

            import asyncio
            response = await asyncio.to_thread(
                self._model.generate_content,
                full_prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 4096,
                },
            )

            text = ""
            try:
                text = response.text
            except Exception:
                for candidate in getattr(response, "candidates", []):
                    for part in getattr(candidate.content, "parts", []):
                        part_text = getattr(part, "text", None)
                        if part_text and part_text.strip():
                            text = part_text
                            break
                    if text: break

            return text or "Não consegui gerar uma resposta."

        except Exception as e:
            logger.error(f"Erro no chat insights históricos: {e}")
            return f"Erro ao processar: {str(e)}"


# Singleton
gemini_service = GeminiInsightsService()
