"""baseline schema

Revision ID: 20260521_0001
Revises:
Create Date: 2026-05-21 02:30:00
"""

from __future__ import annotations

from alembic import op

from app.models.base import Base
from app.models import attendance, coordinator, course, enrollment, grade, historical_data, professor, scraped_data, staff_code, student, user, login_attempt, historical_spreadsheet, coordinator_course, user_session  # noqa: F401


# revision identifiers, used by Alembic.
revision = "20260521_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
