"""add login_attempts, historical_spreadsheets and coordinator_courses

Revision ID: 20260609_0003
Revises: 20260521_0002
Create Date: 2026-06-09 09:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260609_0003"
down_revision = "20260521_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # ── Tabela: login_attempts ──────────────────────────────────────────────
    if "login_attempts" not in tables:
        op.create_table(
            "login_attempts",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("ip_address", sa.String(length=100), nullable=False),
            sa.Column("username", sa.String(length=100), nullable=True),
            sa.Column("timestamp", sa.DateTime(), nullable=False),
            sa.Column("is_successful", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_login_attempts_id"), "login_attempts", ["id"], unique=False)
        op.create_index(op.f("ix_login_attempts_ip_address"), "login_attempts", ["ip_address"], unique=False)
        op.create_index(op.f("ix_login_attempts_username"), "login_attempts", ["username"], unique=False)
        op.create_index(op.f("ix_login_attempts_timestamp"), "login_attempts", ["timestamp"], unique=False)

    # ── Tabela: historical_spreadsheets ─────────────────────────────────────
    if "historical_spreadsheets" not in tables:
        op.create_table(
            "historical_spreadsheets",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("filename", sa.String(length=255), nullable=False),
            sa.Column("uploaded_at", sa.DateTime(), nullable=False),
            sa.Column("semester", sa.String(length=50), nullable=True),
            sa.Column("course_name", sa.String(length=255), nullable=True),
            sa.Column("records_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("avg_grade", sa.Float(), nullable=True),
            sa.Column("avg_attendance", sa.Float(), nullable=True),
            sa.Column("professor_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["professor_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_historical_spreadsheets_id"), "historical_spreadsheets", ["id"], unique=False)
        op.create_index(op.f("ix_historical_spreadsheets_uploaded_at"), "historical_spreadsheets", ["uploaded_at"], unique=False)
        op.create_index(op.f("ix_historical_spreadsheets_semester"), "historical_spreadsheets", ["semester"], unique=False)
        op.create_index(op.f("ix_historical_spreadsheets_course_name"), "historical_spreadsheets", ["course_name"], unique=False)
        op.create_index(op.f("ix_historical_spreadsheets_professor_id"), "historical_spreadsheets", ["professor_id"], unique=False)

    # ── Coluna spreadsheet_id em historical_records ─────────────────────────
    columns = [col["name"] for col in inspector.get_columns("historical_records")]
    if "spreadsheet_id" not in columns:
        with op.batch_alter_table("historical_records") as batch_op:
            batch_op.add_column(
                sa.Column("spreadsheet_id", sa.Integer(), nullable=True)
            )
            batch_op.create_index("ix_historical_records_spreadsheet_id", ["spreadsheet_id"], unique=False)
            batch_op.create_foreign_key(
                "fk_historical_records_spreadsheet_id",
                "historical_spreadsheets",
                ["spreadsheet_id"],
                ["id"],
                ondelete="CASCADE",
            )

    # ── Tabela: coordinator_courses ─────────────────────────────────────────
    if "coordinator_courses" not in tables:
        op.create_table(
            "coordinator_courses",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("coordinator_id", sa.Integer(), nullable=False),
            sa.Column("course_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["coordinator_id"], ["coordinators.id"]),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_coordinator_courses_id"), "coordinator_courses", ["id"], unique=False)
        op.create_index(op.f("ix_coordinator_courses_coordinator_id"), "coordinator_courses", ["coordinator_id"], unique=False)
        op.create_index(op.f("ix_coordinator_courses_course_id"), "coordinator_courses", ["course_id"], unique=False)


def downgrade() -> None:
    # Reverter em ordem inversa de dependência

    op.drop_index(op.f("ix_coordinator_courses_course_id"), table_name="coordinator_courses")
    op.drop_index(op.f("ix_coordinator_courses_coordinator_id"), table_name="coordinator_courses")
    op.drop_index(op.f("ix_coordinator_courses_id"), table_name="coordinator_courses")
    op.drop_table("coordinator_courses")

    with op.batch_alter_table("historical_records") as batch_op:
        batch_op.drop_constraint("fk_historical_records_spreadsheet_id", type_="foreignkey")
        batch_op.drop_index("ix_historical_records_spreadsheet_id")
        batch_op.drop_column("spreadsheet_id")

    op.drop_index(op.f("ix_historical_spreadsheets_professor_id"), table_name="historical_spreadsheets")
    op.drop_index(op.f("ix_historical_spreadsheets_course_name"), table_name="historical_spreadsheets")
    op.drop_index(op.f("ix_historical_spreadsheets_semester"), table_name="historical_spreadsheets")
    op.drop_index(op.f("ix_historical_spreadsheets_uploaded_at"), table_name="historical_spreadsheets")
    op.drop_index(op.f("ix_historical_spreadsheets_id"), table_name="historical_spreadsheets")
    op.drop_table("historical_spreadsheets")

    op.drop_index(op.f("ix_login_attempts_timestamp"), table_name="login_attempts")
    op.drop_index(op.f("ix_login_attempts_username"), table_name="login_attempts")
    op.drop_index(op.f("ix_login_attempts_ip_address"), table_name="login_attempts")
    op.drop_index(op.f("ix_login_attempts_id"), table_name="login_attempts")
    op.drop_table("login_attempts")
