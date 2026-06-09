"""add user sessions

Revision ID: 20260521_0002
Revises: 20260521_0001
Create Date: 2026-05-21 21:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260521_0002"
down_revision = "20260521_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "user_sessions" not in tables:
        op.create_table(
            "user_sessions",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("session_identifier", sa.String(length=64), nullable=False),
            sa.Column("refresh_token_hash", sa.String(length=128), nullable=False),
            sa.Column("previous_refresh_token_hash", sa.String(length=128), nullable=True),
            sa.Column("current_access_jti", sa.String(length=64), nullable=False),
            sa.Column("device_id", sa.String(length=128), nullable=True),
            sa.Column("device_label", sa.String(length=200), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("ip_address", sa.String(length=100), nullable=True),
            sa.Column("refresh_expires_at", sa.DateTime(), nullable=False),
            sa.Column("access_expires_at", sa.DateTime(), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(), nullable=True),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("revoked_reason", sa.String(length=120), nullable=True),
            sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_user_sessions_id"), "user_sessions", ["id"], unique=False)
        op.create_index(op.f("ix_user_sessions_user_id"), "user_sessions", ["user_id"], unique=False)
        op.create_index(op.f("ix_user_sessions_session_identifier"), "user_sessions", ["session_identifier"], unique=True)
        op.create_index(op.f("ix_user_sessions_refresh_token_hash"), "user_sessions", ["refresh_token_hash"], unique=True)
        op.create_index(op.f("ix_user_sessions_previous_refresh_token_hash"), "user_sessions", ["previous_refresh_token_hash"], unique=False)
        op.create_index(op.f("ix_user_sessions_current_access_jti"), "user_sessions", ["current_access_jti"], unique=False)
        op.create_index(op.f("ix_user_sessions_device_id"), "user_sessions", ["device_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_sessions_device_id"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_current_access_jti"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_previous_refresh_token_hash"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_refresh_token_hash"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_session_identifier"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_user_id"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_id"), table_name="user_sessions")
    op.drop_table("user_sessions")
