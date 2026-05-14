from __future__ import annotations

from io import BytesIO, StringIO
import csv
import json
from typing import Any

from fastapi import HTTPException


ANALYSIS_TITLES = {
    "overview": "Visao geral",
    "by_class": "Analise por turma",
    "between_classes": "Comparativo entre turmas",
    "by_semester": "Analise por semestre",
    "risk_topics": "Assuntos em risco",
    "high_risk_classes": "Turmas com maior risco",
    "discipline_bottlenecks": "Gargalos por disciplina",
    "intervention_priorities": "Prioridades de intervencao",
}


class HistoricalExportService:
    def get_analysis_rows(self, workspace: dict[str, Any], analysis_id: str) -> list[dict[str, Any]]:
        analysis_data = workspace.get("analysis_data", {})

        if analysis_id == "overview":
            overview = workspace.get("overview", {})
            return [
                {"indicador": "Registros analisados", "valor": overview.get("total_records", 0)},
                {"indicador": "Alunos mapeados", "valor": overview.get("total_students", 0)},
                {"indicador": "Alunos que trabalham", "valor": overview.get("working_students", 0)},
                {"indicador": "Turmas mapeadas", "valor": overview.get("total_classes", 0)},
                {"indicador": "Semestres mapeados", "valor": overview.get("total_semesters", 0)},
                {"indicador": "Media de notas", "valor": overview.get("avg_grade", 0.0)},
                {"indicador": "Presenca media", "valor": overview.get("avg_attendance", 0.0)},
                {"indicador": "Atividade media", "valor": overview.get("avg_activity", 0.0)},
                {"indicador": "Risco medio", "valor": overview.get("avg_risk", 0.0)},
                {"indicador": "Turmas criticas", "valor": overview.get("critical_classes", 0)},
            ]

        rows = analysis_data.get(analysis_id)
        if rows is None:
            raise HTTPException(status_code=404, detail="Analise solicitada nao encontrada para exportacao.")

        normalized_rows = []
        for row in rows:
            normalized = {}
            for key, value in row.items():
                if isinstance(value, list):
                    normalized[key] = " | ".join(str(item) for item in value)
                else:
                    normalized[key] = value
            normalized_rows.append(normalized)
        return normalized_rows

    def build_filename(self, analysis_id: str, export_format: str) -> str:
        return f"nexora-{analysis_id}.{export_format}"

    def export_json(self, payload: dict[str, Any]) -> bytes:
        return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")

    def export_csv(self, rows: list[dict[str, Any]]) -> bytes:
        output = StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        else:
            output.write("sem_dados\n")
        return output.getvalue().encode("utf-8")

    def export_xlsx(self, rows: list[dict[str, Any]], title: str) -> bytes:
        from openpyxl import Workbook

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = title[:31] or "Analise"

        if rows:
            headers = list(rows[0].keys())
            sheet.append(headers)
            for row in rows:
                sheet.append([row.get(header) for header in headers])
        else:
            sheet.append(["sem_dados"])

        stream = BytesIO()
        workbook.save(stream)
        return stream.getvalue()

    def export_pdf(
        self,
        workspace: dict[str, Any],
        analysis_id: str,
        title: str,
        rows: list[dict[str, Any]],
    ) -> bytes:
        try:
            from reportlab.lib import colors
            from reportlab.lib.enums import TA_LEFT
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import mm
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="A exportacao em PDF esta indisponivel porque a dependencia reportlab nao esta instalada.",
            ) from exc

        buffer = BytesIO()
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
        )

        styles = getSampleStyleSheet()
        heading = ParagraphStyle(
            name="Heading",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0F172A"),
            alignment=TA_LEFT,
        )
        body = ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#475569"),
        )

        elements = [
            Paragraph("NEXORA - Exportacao analitica", heading),
            Spacer(1, 5 * mm),
            Paragraph(f"Analise: {title}", body),
            Paragraph(f"Perfil: {workspace.get('scope', {}).get('label', 'Nao informado')}", body),
            Paragraph(f"Descricao: {workspace.get('scope', {}).get('description', '')}", body),
            Spacer(1, 4 * mm),
        ]

        if analysis_id == "overview":
            overview = workspace.get("overview", {})
            for key, value in overview.items():
                label = key.replace("_", " ").title()
                elements.append(Paragraph(f"{label}: {value}", body))
            document.build(elements)
            return buffer.getvalue()

        table_rows = []
        if rows:
            headers = list(rows[0].keys())[:8]
            table_rows.append([str(header).replace("_", " ").title() for header in headers])
            for row in rows[:20]:
                table_rows.append([self._truncate(row.get(header)) for header in headers])
        else:
            table_rows.append(["Sem dados disponiveis"])

        table = Table(table_rows, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003B8F")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("LEADING", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        elements.append(table)
        document.build(elements)
        return buffer.getvalue()

    def _truncate(self, value: Any, limit: int = 38) -> str:
        text = str(value if value is not None else "")
        if len(text) <= limit:
            return text
        return f"{text[:limit - 3]}..."
