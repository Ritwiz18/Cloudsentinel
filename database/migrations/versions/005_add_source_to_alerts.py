"""Add source column to security_alerts

Revision ID: 005_add_source_to_alerts
Revises: 004_create_investigations_table
Create Date: 2026-11-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '005_add_source_to_alerts'
down_revision: Union[str, None] = '004_create_investigations_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'security_alerts',
        sa.Column('source', sa.String(length=64), nullable=True),
    )
    op.create_index(
        'ix_security_alerts_source',
        'security_alerts',
        ['source'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_security_alerts_source', table_name='security_alerts')
    op.drop_column('security_alerts', 'source')