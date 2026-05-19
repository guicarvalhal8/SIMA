"""
Service de scraping para o portal Lyceum.

Extrai notas, faltas, disciplinas e horarios do aluno.
O driver do navegador e criado sob demanda com fallback entre
Google Chrome e Microsoft Edge no Windows.
"""

import importlib.util
import json
import logging
import os
import sys
import tempfile
import time
from pathlib import Path
from shutil import rmtree, which
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.utils.subject_name import clean_subject_name, normalize_subject_key

logger = logging.getLogger(__name__)


class LyceumScraperService:
    BASE_URL = "https://portal.unievangelica.edu.br/aluno/"
    LOGIN_URL = BASE_URL + "#/login"
    NOTAS_URL = BASE_URL + "#/home/boletim/notas"
    FREQUENCIA_URL = BASE_URL + "#/home/frequencia"
    DISCIPLINAS_URL = BASE_URL + "#/home/disciplinas"

    def __init__(self):
        self.driver = None
        self.active_browser_name: Optional[str] = None
        self._runtime_dirs: list[str] = []

    def _ensure_selenium_available(self):
        if importlib.util.find_spec("selenium") is not None:
            return

        major = sys.version_info.major
        minor = sys.version_info.minor
        local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
        app_data = Path(os.environ.get("APPDATA", ""))

        candidate_paths = [
            app_data / f"Python/Python{major}{minor}/site-packages",
            local_app_data / f"Programs/Python/Python{major}{minor}/Lib/site-packages",
        ]

        package_roots = local_app_data / "Packages"
        if package_roots.exists():
            for package_dir in package_roots.glob("PythonSoftwareFoundation.Python.*"):
                candidate_paths.append(
                    package_dir / f"LocalCache/local-packages/Python{major}{minor}/site-packages"
                )

        for candidate in candidate_paths:
            if candidate.exists() and str(candidate) not in sys.path:
                sys.path.append(str(candidate))
                if importlib.util.find_spec("selenium") is not None:
                    logger.info("selenium carregado a partir de %s", candidate)
                    return

        raise RuntimeError(
            "A dependencia selenium nao esta instalada na venv ativa nem em um Python local detectavel. "
            "Instale no mesmo Python que sobe o backend."
        )

    def _browser_candidates(self) -> list[tuple[str, list[str]]]:
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        program_files = os.environ.get("PROGRAMFILES", "")
        program_files_x86 = os.environ.get("PROGRAMFILES(X86)", "")

        return [
            (
                "chrome",
                [
                    os.environ.get("NEXORA_BROWSER_BINARY", ""),
                    os.environ.get("CHROME_BINARY", ""),
                    str(Path(local_app_data) / "Google/Chrome/Application/chrome.exe"),
                    str(Path(program_files) / "Google/Chrome/Application/chrome.exe"),
                    str(Path(program_files_x86) / "Google/Chrome/Application/chrome.exe"),
                ],
            ),
            (
                "edge",
                [
                    os.environ.get("EDGE_BINARY", ""),
                    str(Path(local_app_data) / "Microsoft/Edge/Application/msedge.exe"),
                    str(Path(program_files) / "Microsoft/Edge/Application/msedge.exe"),
                    str(Path(program_files_x86) / "Microsoft/Edge/Application/msedge.exe"),
                ],
            ),
        ]

    def _find_browser_binary(self, browser_name: str) -> Optional[str]:
        executable_name = "chrome.exe" if browser_name == "chrome" else "msedge.exe"
        path_on_shell = which(executable_name)
        if path_on_shell:
            return path_on_shell

        for candidate_name, candidates in self._browser_candidates():
            if candidate_name != browser_name:
                continue
            for candidate in candidates:
                if candidate and Path(candidate).exists():
                    return candidate
        return None

    def _find_driver_binary(self, browser_name: str) -> Optional[str]:
        executable_name = "chromedriver.exe" if browser_name == "chrome" else "msedgedriver.exe"
        path_on_shell = which(executable_name)
        if path_on_shell:
            return path_on_shell

        home = Path.home()
        cache_roots = [
            home / ".cache/selenium/chromedriver",
            home / ".cache/selenium/edgedriver",
        ]
        for cache_root in cache_roots:
            if browser_name == "chrome" and "chromedriver" not in str(cache_root):
                continue
            if browser_name == "edge" and "edgedriver" not in str(cache_root):
                continue
            if not cache_root.exists():
                continue
            matches = sorted(cache_root.rglob(executable_name), reverse=True)
            if matches:
                return str(matches[0])
        return None

    def _build_common_args(self, options):
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--disable-features=VizDisplayCompositor")
        options.add_argument("--remote-debugging-pipe")
        options.add_argument("--log-level=3")
        options.add_argument("--window-size=1920,1080")
        return options

    def _init_driver(self):
        self._ensure_selenium_available()

        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options as ChromeOptions
            from selenium.webdriver.chrome.service import Service as ChromeService
            from selenium.webdriver.edge.options import Options as EdgeOptions
            from selenium.webdriver.edge.service import Service as EdgeService
        except Exception as exc:
            raise RuntimeError(
                "A dependencia selenium existe, mas nao pode ser carregada pelo backend atual. "
                "Reinicie a API e confirme a instalacao no Python da aplicacao."
            ) from exc

        cache_dir = Path(__file__).resolve().parents[2] / ".nexora-runtime" / "selenium-cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        os.environ["SE_CACHE_PATH"] = str(cache_dir)

        errors: list[str] = []

        for browser_name in ("chrome", "edge"):
            binary_path = self._find_browser_binary(browser_name)
            driver_path = self._find_driver_binary(browser_name)
            try:
                if browser_name == "chrome":
                    options = self._build_common_args(ChromeOptions())
                    if binary_path:
                        options.binary_location = binary_path
                    service = ChromeService(executable_path=driver_path) if driver_path else ChromeService()
                    self.driver = webdriver.Chrome(service=service, options=options)
                else:
                    options = self._build_common_args(EdgeOptions())
                    if binary_path:
                        options.binary_location = binary_path
                    service = EdgeService(executable_path=driver_path) if driver_path else EdgeService()
                    self.driver = webdriver.Edge(service=service, options=options)

                self.driver.implicitly_wait(10)
                self.active_browser_name = browser_name
                logger.info("Driver Selenium inicializado com %s", browser_name)
                return
            except Exception as exc:
                errors.append(f"{browser_name}: {exc}")
                self._close_driver()

        raise RuntimeError(
            "Nao foi possivel inicializar o navegador de scraping. "
            "Instale o Google Chrome ou Microsoft Edge e garanta que o selenium esteja instalado. "
            f"Tentativas: {' | '.join(errors)}"
        )

    def _close_driver(self):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
            self.active_browser_name = None

        while self._runtime_dirs:
            runtime_dir = self._runtime_dirs.pop()
            try:
                rmtree(runtime_dir, ignore_errors=True)
            except Exception:
                pass

    def _login(self, registration_number: str, password: str) -> bool:
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC

            self.driver.get(self.LOGIN_URL)
            time.sleep(5)

            user_field = WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.ID, "username"))
            )
            user_field.clear()
            user_field.send_keys(registration_number)

            pass_field = self.driver.find_element(By.ID, "password")
            pass_field.clear()
            pass_field.send_keys(password)

            login_btn = None
            buttons = self.driver.find_elements(By.TAG_NAME, "button")
            for btn in buttons:
                if "entrar" in btn.text.strip().lower():
                    login_btn = btn
                    break
            if not login_btn:
                login_btn = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            login_btn.click()

            time.sleep(5)
            if "login" not in self.driver.current_url.lower():
                logger.info("Login no Lyceum efetuado com matricula=%s", registration_number)
                return True

            logger.warning("Login falhou para matricula=%s", registration_number)
            return False
        except Exception as exc:
            logger.error("Erro durante login: %s", exc)
            return False

    def _get_password_attempts(self, cpf: str, custom_password: Optional[str] = None) -> List[str]:
        cpf_digits = "".join(char for char in cpf if char.isdigit())
        attempts: list[str] = []

        if custom_password:
            attempts.append(custom_password)
        if len(cpf_digits) >= 9:
            attempts.append(cpf_digits[:9])
        if len(cpf_digits) >= 11:
            attempts.append(cpf_digits)

        return attempts

    def _navigate_sidebar(self, menu_text: str, submenu_text: str = None):
        from selenium.webdriver.common.by import By

        sidebar_links = self.driver.find_elements(By.CSS_SELECTOR, "a")
        for link in sidebar_links:
            try:
                if menu_text.lower() in link.text.strip().lower():
                    link.click()
                    time.sleep(1)
                    break
            except Exception:
                continue

        if submenu_text:
            time.sleep(1)
            for link in self.driver.find_elements(By.CSS_SELECTOR, "a"):
                try:
                    if link.text.strip().lower() == submenu_text.lower():
                        link.click()
                        time.sleep(3)
                        break
                except Exception:
                    continue

    def _scrape_grades(self) -> List[Dict[str, Any]]:
        try:
            self._navigate_sidebar("Avaliacao", "Notas")
            time.sleep(3)

            for tab in self.driver.find_elements("css selector", "a, button, div, span"):
                try:
                    if "notas e faltas" in tab.text.strip().lower():
                        tab.click()
                        time.sleep(3)
                        break
                except Exception:
                    continue

            grades = []
            cards = self.driver.find_elements("css selector", "div.card-shadow")
            for card in cards:
                try:
                    items = card.find_elements("css selector", "div.card-item")
                    grade_info = {
                        "disciplina": "",
                        "va1": None,
                        "va2": None,
                        "va3": None,
                        "media": None,
                        "situacao": "Cursando",
                    }
                    for item in items:
                        label_el = item.find_elements("css selector", "p.card-label, .card-label")
                        value_el = item.find_elements("css selector", "p.card-value, .card-value")
                        if not (label_el and value_el):
                            continue
                        label = label_el[0].text.strip().lower()
                        value = value_el[0].text.strip()
                        if "disciplina" in label:
                            grade_info["disciplina"] = clean_subject_name(value)
                        elif "media" in label:
                            grade_info["media"] = self._parse_float(value)
                        elif "situacao" in label:
                            grade_info["situacao"] = value
                    if grade_info["disciplina"]:
                        grades.append(grade_info)
                except Exception:
                    continue

            if not grades:
                for item in self._scrape_attendance_internal():
                    grades.append({
                        "disciplina": item["disciplina"],
                        "va1": None,
                        "va2": None,
                        "va3": None,
                        "media": None,
                        "situacao": "Em andamento",
                    })

            logger.info("%s notas extraidas", len(grades))
            return grades
        except Exception as exc:
            logger.error("Erro ao extrair notas: %s", exc)
            return []

    def _scrape_attendance_internal(self) -> List[Dict[str, Any]]:
        self.driver.get(self.FREQUENCIA_URL)
        time.sleep(5)

        attendance = []
        groups = self.driver.find_elements("css selector", "ul.list-group")
        for group in groups:
            try:
                items = group.find_elements("css selector", "li.list-group-item")
                if len(items) < 2:
                    continue

                heading = group.find_elements("css selector", "li.freq-heading")
                if not heading:
                    continue

                disciplina = clean_subject_name(heading[0].text.strip())
                if not disciplina or disciplina.upper() == "TOTAL":
                    continue

                faltas = 0
                frequencia = 100.0
                for item in items:
                    text = item.text.strip()
                    badge = item.find_elements("css selector", "span.badge")
                    if not badge:
                        continue
                    value = badge[0].text.strip()
                    if "Falta" in text:
                        faltas = self._parse_int(value)
                    elif "Frequencia" in text or "Frequ" in text:
                        frequencia = self._parse_float(value)

                attendance.append({
                    "disciplina": disciplina,
                    "total_faltas": faltas,
                    "total_aulas": 60,
                    "percentual_presenca": frequencia,
                })
            except Exception:
                continue

        return attendance

    def _scrape_attendance(self) -> List[Dict[str, Any]]:
        try:
            attendance = self._scrape_attendance_internal()
            logger.info("%s registros de frequencia extraidos", len(attendance))
            return attendance
        except Exception as exc:
            logger.error("Erro ao extrair frequencia: %s", exc)
            return []

    def _scrape_subjects(self) -> List[Dict[str, Any]]:
        try:
            self.driver.get(self.DISCIPLINAS_URL)
            time.sleep(5)

            subjects = []
            cards = self.driver.find_elements("css selector", "div.card-shadow")
            for card in cards:
                try:
                    items = card.find_elements("css selector", "div.card-item")
                    subj_info = {
                        "disciplina": "",
                        "situacao": "Matriculado",
                        "periodo": None,
                        "docente": None,
                        "data_inicial": None,
                    }
                    for item in items:
                        label_el = item.find_elements("css selector", "p.card-label, .card-label")
                        value_el = item.find_elements("css selector", "p.card-value, .card-value")
                        if not (label_el and value_el):
                            continue
                        label = label_el[0].text.strip().lower()
                        value = value_el[0].text.strip()
                        if "disciplina" in label:
                            subj_info["disciplina"] = clean_subject_name(value)
                        elif "situacao" in label:
                            subj_info["situacao"] = value
                        elif "periodo" in label:
                            subj_info["periodo"] = value
                        elif "docente" in label:
                            subj_info["docente"] = value
                        elif "data" in label:
                            subj_info["data_inicial"] = value
                    if subj_info["disciplina"]:
                        subjects.append(subj_info)
                except Exception:
                    continue

            logger.info("%s disciplinas extraidas", len(subjects))
            return subjects
        except Exception as exc:
            logger.error("Erro ao extrair disciplinas: %s", exc)
            return []

    def _scrape_schedule(self) -> List[Dict[str, Any]]:
        logger.warning("Pagina de horarios nao disponivel no portal Lyceum atual")
        return []

    def save_grades(self, student_id: int, grades_data: List[Dict[str, Any]], db: Session):
        from app.models.scraped_data import ScrapedGrade

        db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student_id).delete()
        for grade in grades_data:
            db.add(
                ScrapedGrade(
                    student_id=student_id,
                    disciplina=clean_subject_name(grade.get("disciplina", "")),
                    va1=grade.get("va1", 0.0),
                    va2=grade.get("va2", 0.0),
                    va3=grade.get("va3", 0.0),
                    media=grade.get("media", 0.0),
                    situacao=grade.get("situacao", "Cursando"),
                    avaliacoes=json.dumps(grade.get("avaliacoes", [])) if grade.get("avaliacoes") else None,
                )
            )
        db.commit()

    def save_attendance(self, student_id: int, attendance_data: List[Dict[str, Any]], db: Session):
        from app.models.scraped_data import ScrapedAttendance

        db.query(ScrapedAttendance).filter(ScrapedAttendance.student_id == student_id).delete()
        for attendance in attendance_data:
            db.add(
                ScrapedAttendance(
                    student_id=student_id,
                    disciplina=clean_subject_name(attendance.get("disciplina", "")),
                    total_faltas=attendance.get("total_faltas", 0),
                    total_aulas=attendance.get("total_aulas", 60),
                    percentual_presenca=attendance.get("percentual_presenca", 100.0),
                )
            )
        db.commit()

    def save_subjects(self, student_id: int, subjects_data: List[Dict[str, Any]], db: Session):
        from app.models.course import Course
        from app.models.scraped_data import ScrapedSubject
        from app.models.student import Student
        import hashlib

        student = db.query(Student).filter(Student.id == student_id).first()
        department = student.course_name if student and student.course_name else "Geral"

        db.query(ScrapedSubject).filter(ScrapedSubject.student_id == student_id).delete()
        catalog_courses = db.query(Course).all()
        course_by_key = {
            normalize_subject_key(course.name): course
            for course in catalog_courses
            if course.name and normalize_subject_key(course.name)
        }
        seen_subject_keys = set()

        for subject in subjects_data:
            name = clean_subject_name(subject.get("disciplina", ""))
            subject_key = normalize_subject_key(name)
            if not name or not subject_key or subject_key in seen_subject_keys:
                continue

            seen_subject_keys.add(subject_key)
            db.add(
                ScrapedSubject(
                    student_id=student_id,
                    disciplina=name,
                    situacao=subject.get("situacao", "Matriculado"),
                    periodo=subject.get("periodo"),
                    docente=subject.get("docente"),
                    data_inicial=subject.get("data_inicial"),
                )
            )

            existing_course = course_by_key.get(subject_key)
            if existing_course:
                if existing_course.name != name:
                    existing_course.name = name
                continue

            name_hash = hashlib.md5(name.encode()).hexdigest()[:6].upper()
            code = f"SUBJ-{name_hash}"
            new_course = Course(
                name=name,
                code=code,
                credits=4,
                semester="2026.1",
                department=department,
            )
            db.add(new_course)
            course_by_key[subject_key] = new_course

        db.commit()

    def save_schedule(self, student_id: int, schedule_data: List[Dict[str, Any]], db: Session):
        from app.models.scraped_data import ScrapedSchedule

        db.query(ScrapedSchedule).filter(ScrapedSchedule.student_id == student_id).delete()
        for item in schedule_data:
            db.add(
                ScrapedSchedule(
                    student_id=student_id,
                    dia_semana=item.get("dia_semana", 0),
                    dia_nome=item.get("dia_nome"),
                    disciplina=clean_subject_name(item.get("disciplina", "")),
                    horario_inicio=item.get("horario_inicio"),
                    horario_fim=item.get("horario_fim"),
                    local=item.get("local"),
                    professor=item.get("professor"),
                )
            )
        db.commit()

    def run_full_scrape(
        self,
        student_id: int,
        registration_number: str,
        cpf: str,
        custom_password: Optional[str],
        db: Session,
    ) -> Dict[str, Any]:
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
            password_attempts = self._get_password_attempts(cpf, custom_password)
            logged_in = False

            for index, password in enumerate(password_attempts, 1):
                logger.info("Tentativa de login %s/%s para matricula=%s", index, len(password_attempts), registration_number)
                if self._login(registration_number, password):
                    logged_in = True
                    break
                if index < len(password_attempts):
                    logger.info("Tentativa %s falhou, tentando proxima senha", index)

            if not logged_in:
                result["errors"].append(
                    "Falha no login. Se a senha do portal Lyceum foi alterada, informe a senha atual no perfil do aluno."
                )
                return result

            try:
                grades = self._scrape_grades()
                if grades:
                    self.save_grades(student_id, grades, db)
                    result["grades_count"] = len(grades)
            except Exception as exc:
                result["errors"].append(f"Erro nas notas: {exc}")

            try:
                attendance = self._scrape_attendance()
                if attendance:
                    self.save_attendance(student_id, attendance, db)
                    result["attendance_count"] = len(attendance)
            except Exception as exc:
                result["errors"].append(f"Erro na frequencia: {exc}")

            try:
                subjects = self._scrape_subjects()
                if subjects:
                    self.save_subjects(student_id, subjects, db)
                    result["subjects_count"] = len(subjects)
            except Exception as exc:
                result["errors"].append(f"Erro nas disciplinas: {exc}")

            try:
                schedule = self._scrape_schedule()
                if schedule:
                    self.save_schedule(student_id, schedule, db)
                    result["schedule_count"] = len(schedule)
            except Exception as exc:
                result["errors"].append(f"Erro nos horarios: {exc}")

            result["success"] = True
            return result
        except Exception as exc:
            result["errors"].append(f"Erro geral no scraping: {exc}")
            return result
        finally:
            self._close_driver()

    @staticmethod
    def _parse_float(text: str) -> float:
        try:
            return float(text.strip().replace(",", "."))
        except (ValueError, AttributeError):
            return 0.0

    @staticmethod
    def _parse_int(text: str) -> int:
        try:
            return int(text.strip())
        except (ValueError, AttributeError):
            return 0


scraper_service = LyceumScraperService()

