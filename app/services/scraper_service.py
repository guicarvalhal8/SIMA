"""
Serviço de Web Scraping para o portal Lyceum (UniEvangélica).

Encapsula o scraping de notas, faltas, disciplinas e horários
do aluno diretamente do portal acadêmico.

IMPORTANTE: Requer Selenium + Chrome/Chromium instalado.
"""

import json
import logging
import time
from typing import Optional, Dict, Any, List

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class LyceumScraperService:
    """
    Serviço de scraping para o portal Lyceum.

    Métodos públicos:
        run_full_scrape(student_id, cpf, password, db) → dict
        save_grades(student_id, grades_data, db)
        save_attendance(student_id, attendance_data, db)
        save_subjects(student_id, subjects_data, db)
        save_schedule(student_id, schedule_data, db)
    """

    BASE_URL = "https://portal.unievangelica.edu.br/aluno/"
    LOGIN_URL = BASE_URL + "#/login"
    NOTAS_URL = BASE_URL + "#/home/boletim/notas"
    FREQUENCIA_URL = BASE_URL + "#/home/frequencia"
    DISCIPLINAS_URL = BASE_URL + "#/home/disciplinas"

    def __init__(self):
        """Inicializa sem webdriver (criado sob demanda)."""
        self.driver = None

    def _init_driver(self):
        """Cria driver Selenium com opções headless."""
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.service import Service
            from selenium.webdriver.chrome.options import Options

            options = Options()
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")

            self.driver = webdriver.Chrome(options=options)
            self.driver.implicitly_wait(10)
            logger.info("✅ Driver Selenium inicializado (headless)")
        except Exception as e:
            logger.error(f"❌ Falha ao inicializar Selenium: {e}")
            raise RuntimeError(
                "Selenium ou Chrome não está disponível. "
                "Instale com: pip install selenium e certifique-se de ter o Chrome instalado."
            ) from e

    def _close_driver(self):
        """Fecha o driver de forma segura."""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None

    def _login(self, registration_number: str, password: str) -> bool:
        """Faz login no portal Lyceum usando matrícula + senha."""
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC

            self.driver.get(self.LOGIN_URL)
            # SPA Angular — aguardar renderização
            time.sleep(5)

            # Preencher matrícula (campo "Aluno ou Responsável")
            user_field = WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.ID, "username"))
            )
            user_field.clear()
            user_field.send_keys(registration_number)

            # Preencher senha
            pass_field = self.driver.find_element(By.ID, "password")
            pass_field.clear()
            pass_field.send_keys(password)

            # Clicar em "Entrar"
            login_btn = None
            buttons = self.driver.find_elements(By.TAG_NAME, "button")
            for btn in buttons:
                if "entrar" in btn.text.strip().lower():
                    login_btn = btn
                    break
            if not login_btn:
                # Fallback: primeiro botão submit
                login_btn = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            login_btn.click()

            time.sleep(5)

            # Verificar se logou (URL sai de #/login)
            if "login" not in self.driver.current_url.lower():
                logger.info(f"✅ Login no Lyceum efetuado com matrícula={registration_number}")
                return True
            else:
                logger.warning(f"⚠️ Login falhou para matrícula={registration_number}")
                return False

        except Exception as e:
            logger.error(f"❌ Erro durante login: {e}")
            return False

    def _get_password_attempts(self, cpf: str, custom_password: Optional[str] = None) -> List[str]:
        """
        Gera lista de senhas para tentar no login do Lyceum.
        Ordem: senha personalizada (se fornecida) → 9 primeiros dígitos do CPF → CPF completo.
        """
        # Extrair apenas dígitos do CPF
        cpf_digits = ''.join(c for c in cpf if c.isdigit())
        attempts = []

        # Tentativa 1: senha personalizada (se o aluno alterou no portal)
        if custom_password:
            attempts.append(custom_password)

        # Tentativa 2: primeiros 9 dígitos do CPF (senha padrão)
        if len(cpf_digits) >= 9:
            attempts.append(cpf_digits[:9])

        # Tentativa 3: CPF completo (só dígitos)
        if len(cpf_digits) >= 11:
            attempts.append(cpf_digits)

        return attempts

    def _navigate_sidebar(self, menu_text: str, submenu_text: str = None):
        """Navega pelo sidebar do portal Ionic clicando nos menus."""
        from selenium.webdriver.common.by import By
        import time

        # Clicar no menu principal
        sidebar_links = self.driver.find_elements(By.CSS_SELECTOR, "a")
        for link in sidebar_links:
            try:
                text = link.text.strip().lower()
                if menu_text.lower() in text:
                    link.click()
                    time.sleep(1)
                    break
            except:
                continue

        if submenu_text:
            time.sleep(1)
            sub_links = self.driver.find_elements(By.CSS_SELECTOR, "a")
            for link in sub_links:
                try:
                    text = link.text.strip().lower()
                    if text == submenu_text.lower():
                        link.click()
                        time.sleep(3)
                        break
                except:
                    continue

    def _scrape_grades(self) -> List[Dict[str, Any]]:
        """Extrai notas do portal Lyceum (Ionic SPA).
        
        Navega: sidebar Avaliação → Notas → aba 'Notas e Faltas'.
        O portal usa cards com ng-repeat, não tabelas HTML.
        """
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC

            # Navegar para a página de notas via sidebar
            self._navigate_sidebar("Avaliação", "Notas")
            time.sleep(3)

            # Se caiu na página de boletim, clicar na aba "Notas e Faltas"
            tabs = self.driver.find_elements(By.CSS_SELECTOR, "a, button, div, span")
            for tab in tabs:
                try:
                    text = tab.text.strip().lower()
                    if "notas e faltas" in text:
                        tab.click()
                        time.sleep(3)
                        break
                except:
                    continue

            grades = []

            # O boletim usa card-shadow com card-item contendo disciplina, média, faltas, situação
            cards = self.driver.find_elements(By.CSS_SELECTOR, "div.card-shadow")
            for card in cards:
                try:
                    items = card.find_elements(By.CSS_SELECTOR, "div.card-item")
                    grade_info = {
                        "disciplina": "",
                        "va1": None,
                        "va2": None,
                        "va3": None,
                        "media": None,
                        "situacao": "Cursando",
                    }
                    for item in items:
                        try:
                            label_el = item.find_elements(By.CSS_SELECTOR, "p.card-label, .card-label")
                            value_el = item.find_elements(By.CSS_SELECTOR, "p.card-value, .card-value")
                            if label_el and value_el:
                                label = label_el[0].text.strip().lower()
                                value = value_el[0].text.strip()
                                if "disciplina" in label:
                                    grade_info["disciplina"] = value
                                elif "média" in label or "media" in label:
                                    grade_info["media"] = self._parse_float(value)
                                elif "situação" in label or "situacao" in label:
                                    grade_info["situacao"] = value
                        except:
                            continue

                    if grade_info["disciplina"]:
                        grades.append(grade_info)
                except:
                    continue

            # Fallback: se não encontrou cards, extrair da frequência
            if not grades:
                # Tentar extrair nomes das disciplinas da frequência como fallback
                freq_data = self._scrape_attendance_internal()
                for item in freq_data:
                    grades.append({
                        "disciplina": item["disciplina"],
                        "va1": None,
                        "va2": None,
                        "va3": None,
                        "media": None,
                        "situacao": "Em andamento",
                    })

            logger.info(f"📊 {len(grades)} notas extraídas")
            return grades
        except Exception as e:
            logger.error(f"❌ Erro ao extrair notas: {e}")
            return []

    def _scrape_attendance_internal(self) -> List[Dict[str, Any]]:
        """Extrai frequência/faltas do portal Lyceum (Ionic SPA).
        
        Página: #/home/frequencia
        Estrutura HTML:
          <ul class="list-group" ng-repeat="falta in ctrl.faltas">
            <li class="list-group-item freq-heading">DISCIPLINA</li>
            <li class="list-group-item"><span class="badge">0</span> Faltas</li>
            <li class="list-group-item"><span class="badge">100</span> Frequência (%)</li>
          </ul>
        """
        from selenium.webdriver.common.by import By

        self.driver.get(self.FREQUENCIA_URL)
        time.sleep(5)

        attendance = []
        groups = self.driver.find_elements(By.CSS_SELECTOR, "ul.list-group")

        for group in groups:
            try:
                items = group.find_elements(By.CSS_SELECTOR, "li.list-group-item")
                if len(items) < 2:
                    continue

                # Primeiro li = nome da disciplina (class freq-heading)
                heading = group.find_elements(By.CSS_SELECTOR, "li.freq-heading")
                if not heading:
                    continue

                disciplina = heading[0].text.strip()
                if not disciplina or disciplina.upper() == "TOTAL":
                    continue

                faltas = 0
                frequencia = 100.0

                for item in items:
                    text = item.text.strip()
                    badge = item.find_elements(By.CSS_SELECTOR, "span.badge")
                    if badge:
                        value = badge[0].text.strip()
                        if "Falta" in text:
                            faltas = self._parse_int(value)
                        elif "Frequência" in text or "Frequ" in text:
                            frequencia = self._parse_float(value)

                att_info = {
                    "disciplina": disciplina,
                    "total_faltas": faltas,
                    "total_aulas": 60,  # Valor padrão (portal não mostra total de aulas)
                    "percentual_presenca": frequencia,
                }
                attendance.append(att_info)
            except:
                continue

        return attendance

    def _scrape_attendance(self) -> List[Dict[str, Any]]:
        """Extrai frequência/faltas (wrapper público)."""
        try:
            attendance = self._scrape_attendance_internal()
            logger.info(f"📋 {len(attendance)} registros de frequência extraídos")
            return attendance
        except Exception as e:
            logger.error(f"❌ Erro ao extrair frequência: {e}")
            return []

    def _scrape_subjects(self) -> List[Dict[str, Any]]:
        """Extrai disciplinas matriculadas do portal Lyceum (Ionic SPA).
        
        Página: #/home/disciplinas
        Estrutura HTML:
          <div class="card-shadow" ng-repeat="row in listaDisciplinas">
            <div class="card-item"><p class="card-label">Disciplina</p><p class="card-value">NOME</p></div>
            <div class="card-item"><p class="card-label">Situação</p><p class="card-value">Matriculado</p></div>
            <div class="card-item"><p class="card-label">Período</p><p class="card-value">1º SEMESTRE DE 2026</p></div>
            <div class="card-item"><p class="card-label">Docente</p><p class="card-value">PROFESSOR</p></div>
            <div class="card-item"><p class="card-label">Data Inicial</p><p class="card-value">02/02/2026</p></div>
          </div>
        """
        try:
            from selenium.webdriver.common.by import By

            self.driver.get(self.DISCIPLINAS_URL)
            time.sleep(5)

            subjects = []
            cards = self.driver.find_elements(By.CSS_SELECTOR, "div.card-shadow")

            for card in cards:
                try:
                    items = card.find_elements(By.CSS_SELECTOR, "div.card-item")
                    subj_info = {
                        "disciplina": "",
                        "situacao": "Matriculado",
                        "periodo": None,
                        "docente": None,
                        "data_inicial": None,
                    }
                    for item in items:
                        try:
                            label_el = item.find_elements(By.CSS_SELECTOR, "p.card-label, .card-label")
                            value_el = item.find_elements(By.CSS_SELECTOR, "p.card-value, .card-value")
                            if label_el and value_el:
                                label = label_el[0].text.strip().lower()
                                value = value_el[0].text.strip()
                                if "disciplina" in label:
                                    subj_info["disciplina"] = value
                                elif "situação" in label or "situacao" in label:
                                    subj_info["situacao"] = value
                                elif "período" in label or "periodo" in label:
                                    subj_info["periodo"] = value
                                elif "docente" in label:
                                    subj_info["docente"] = value
                                elif "data" in label:
                                    subj_info["data_inicial"] = value
                        except:
                            continue

                    if subj_info["disciplina"]:
                        subjects.append(subj_info)
                except:
                    continue

            logger.info(f"📚 {len(subjects)} disciplinas extraídas")
            return subjects
        except Exception as e:
            logger.error(f"❌ Erro ao extrair disciplinas: {e}")
            return []

    def _scrape_schedule(self) -> List[Dict[str, Any]]:
        """Horários não estão disponíveis no portal Lyceum atual.
        
        O portal Ionic não possui uma página dedicada de horários.
        Retorna lista vazia por segurança.
        """
        logger.warning("⚠️ Página de horários não disponível no portal Lyceum atual")
        return []

    # ── Persistência ──

    def save_grades(self, student_id: int, grades_data: List[Dict], db: Session):
        """Salva notas extraídas no banco."""
        from app.models.scraped_data import ScrapedGrade

        # Limpar dados antigos
        db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student_id).delete()

        for g in grades_data:
            record = ScrapedGrade(
                student_id=student_id,
                disciplina=g.get("disciplina", ""),
                va1=g.get("va1", 0.0),
                va2=g.get("va2", 0.0),
                va3=g.get("va3", 0.0),
                media=g.get("media", 0.0),
                situacao=g.get("situacao", "Cursando"),
                avaliacoes=json.dumps(g.get("avaliacoes", [])) if g.get("avaliacoes") else None,
            )
            db.add(record)

        db.commit()
        logger.info(f"💾 {len(grades_data)} notas salvas para student_id={student_id}")

    def save_attendance(self, student_id: int, attendance_data: List[Dict], db: Session):
        """Salva frequência extraída no banco."""
        from app.models.scraped_data import ScrapedAttendance

        db.query(ScrapedAttendance).filter(ScrapedAttendance.student_id == student_id).delete()

        for a in attendance_data:
            record = ScrapedAttendance(
                student_id=student_id,
                disciplina=a.get("disciplina", ""),
                total_faltas=a.get("total_faltas", 0),
                total_aulas=a.get("total_aulas", 60),
                percentual_presenca=a.get("percentual_presenca", 100.0),
            )
            db.add(record)

        db.commit()
        logger.info(f"💾 {len(attendance_data)} registros de frequência salvos para student_id={student_id}")

    def save_subjects(self, student_id: int, subjects_data: List[Dict], db: Session):
        """Salva disciplinas extraídas no banco e garante que existam na tabela de cursos."""
        from app.models.scraped_data import ScrapedSubject
        from app.models.course import Course
        from app.models.student import Student
        import hashlib

        # Obter dados do estudante para usar o nome do curso como departamento
        student = db.query(Student).filter(Student.id == student_id).first()
        dept = student.course_name if student and student.course_name else "Geral"

        # Limpar registros específicos de scraping do aluno
        db.query(ScrapedSubject).filter(ScrapedSubject.student_id == student_id).delete()

        for s in subjects_data:
            name = s.get("disciplina", "").strip()
            if not name:
                continue

            # 1. Salvar no log de scraping do aluno
            record = ScrapedSubject(
                student_id=student_id,
                disciplina=name,
                situacao=s.get("situacao", "Matriculado"),
                periodo=s.get("periodo"),
                docente=s.get("docente"),
                data_inicial=s.get("data_inicial"),
            )
            db.add(record)

            # 2. Garantir que a disciplina exista na tabela global de cursos (selectable)
            # Gerar um código determinístico baseado no nome se não tiver (ex: IA -> IA_hash)
            # O Lyceum às vezes não mostra o código na listagem, então usamos um hash curto
            name_hash = hashlib.md5(name.encode()).hexdigest()[:6].upper()
            code = f"SUBJ-{name_hash}" 

            # Verificar se já existe (pelo nome - deduplicação)
            existing_course = db.query(Course).filter(Course.name == name).first()
            if not existing_course:
                new_course = Course(
                    name=name,
                    code=code,
                    credits=4,
                    semester="2026.1", # Default
                    department=dept
                )
                db.add(new_course)
                logger.info(f"✨ Novo curso registrado: {name} ({code})")

        db.commit()
        logger.info(f"💾 {len(subjects_data)} disciplinas salvas para student_id={student_id}")

    def save_schedule(self, student_id: int, schedule_data: List[Dict], db: Session):
        """Salva horários extraídos no banco."""
        from app.models.scraped_data import ScrapedSchedule

        db.query(ScrapedSchedule).filter(ScrapedSchedule.student_id == student_id).delete()

        for s in schedule_data:
            record = ScrapedSchedule(
                student_id=student_id,
                dia_semana=s.get("dia_semana", 0),
                dia_nome=s.get("dia_nome"),
                disciplina=s.get("disciplina", ""),
                horario_inicio=s.get("horario_inicio"),
                horario_fim=s.get("horario_fim"),
                local=s.get("local"),
                professor=s.get("professor"),
            )
            db.add(record)

        db.commit()
        logger.info(f"💾 {len(schedule_data)} horários salvos para student_id={student_id}")

    # ── Execução completa ──

    def run_full_scrape(
        self, student_id: int, registration_number: str, cpf: str,
        custom_password: Optional[str], db: Session
    ) -> Dict[str, Any]:
        """
        Executa scraping completo e salva no banco.
        Tenta login com matrícula + senha derivada do CPF (9 primeiros dígitos,
        depois CPF completo, depois senha personalizada se fornecida).

        Returns:
            dict com contagens e status de cada tipo de dado extraído.
        """
        result = {
            "success": False,
            "grades_count": 0,
            "attendance_count": 0,
            "subjects_count": 0,
            "schedule_count": 0,
            "errors": [],
        }

        try:
            self._init_driver()

            # Tentar login com cada senha possível
            password_attempts = self._get_password_attempts(cpf, custom_password)
            logged_in = False

            for i, pwd in enumerate(password_attempts, 1):
                logger.info(f"🔑 Tentativa de login {i}/{len(password_attempts)} para matrícula={registration_number}")
                if self._login(registration_number, pwd):
                    logged_in = True
                    break
                # Se falhou e tem mais tentativas, recarregar a página de login
                if i < len(password_attempts):
                    logger.info(f"⚠️ Tentativa {i} falhou, tentando próxima senha...")

            if not logged_in:
                result["errors"].append(
                    "Falha no login — nenhuma combinação de senha funcionou. "
                    "Se você alterou sua senha no portal Lyceum, informe a nova senha nas configurações."
                )
                return result

            # Notas
            try:
                grades = self._scrape_grades()
                if grades:
                    self.save_grades(student_id, grades, db)
                    result["grades_count"] = len(grades)
            except Exception as e:
                result["errors"].append(f"Erro nas notas: {str(e)}")

            # Frequência
            try:
                attendance = self._scrape_attendance()
                if attendance:
                    self.save_attendance(student_id, attendance, db)
                    result["attendance_count"] = len(attendance)
            except Exception as e:
                result["errors"].append(f"Erro na frequência: {str(e)}")

            # Disciplinas
            try:
                subjects = self._scrape_subjects()
                if subjects:
                    self.save_subjects(student_id, subjects, db)
                    result["subjects_count"] = len(subjects)
            except Exception as e:
                result["errors"].append(f"Erro nas disciplinas: {str(e)}")

            # Horários
            try:
                schedule = self._scrape_schedule()
                if schedule:
                    self.save_schedule(student_id, schedule, db)
                    result["schedule_count"] = len(schedule)
            except Exception as e:
                result["errors"].append(f"Erro nos horários: {str(e)}")

            result["success"] = True
            return result

        except Exception as e:
            result["errors"].append(f"Erro geral no scraping: {str(e)}")
            return result
        finally:
            self._close_driver()

    # ── Helpers ──

    @staticmethod
    def _parse_float(text: str) -> float:
        """Converte texto em float, retornando 0.0 se inválido."""
        try:
            return float(text.strip().replace(",", "."))
        except (ValueError, AttributeError):
            return 0.0

    @staticmethod
    def _parse_int(text: str) -> int:
        """Converte texto em int, retornando 0 se inválido."""
        try:
            return int(text.strip())
        except (ValueError, AttributeError):
            return 0


# Instância singleton do serviço
scraper_service = LyceumScraperService()
