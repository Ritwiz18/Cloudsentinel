"""Create security_investigations table for AI-assisted investigations

Revision ID: 004_create_investigations_table
Revises: 003_create_incidents_table
Create Date: 2026-10-12 23:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '004_create_investigations_table'
down_revision: Union[str, None] = '003_create_incidents_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'security_investigations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('investigation_id', sa.String(length=128), nullable=False),
        sa.Column('incident_id', sa.String(length=128), nullable=True),
        sa.Column('alert_id', sa.String(length=128), nullable=True),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('observed_evidence', sa.JSON(), nullable=False),
        sa.Column('detection_explanation', sa.Text(), nullable=False),
        sa.Column('potential_impact', sa.Text(), nullable=False),
        sa.Column('confidence_level', sa.String(length=32), nullable=False, server_default='MEDIUM'),
        sa.Column('confidence_limitations', sa.Text(), nullable=False),
        sa.Column('recommended_steps', sa.JSON(), nullable=False),
        sa.Column('hypotheses', sa.JSON(), nullable=False),
        sa.Column('evidence_references', sa.JSON(), nullable=False),
        sa.Column('provider', sa.String(length=64), nullable=False, server_default='offline-rule-engine'),
        sa.Column('model', sa.String(length=64), nullable=False, server_default='deterministic-heuristics'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_security_investigations_investigation_id',
        'security_investigations',
        ['investigation_id'],
        unique=True,
    )
    op.create_index(
        'ix_security_investigations_incident_id',
        'security_investigations',
        ['incident_id'],
        unique=False,
    )
    op.create_index(
        'ix_security_investigations_alert_id',
        'security_investigations',
        ['alert_id'],
        unique=False,
    )
    op.create_index(
        'ix_security_investigations_created_at',
        'security_investigations',
        ['created_at'],
        unique=False,
    )
    op.create_index(
        'ix_security_investigations_incident_created',
        'security_investigations',
        ['incident_id', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_security_investigations_incident_created', table_name='security_investigations')
    op.drop_index('ix_security_investigations_created_at', table_name='security_investigations')
    op.drop_index('ix_security_investigations_alert_id', table_name='security_investigations')
    op.drop_index('ix_security_investigations_incident_id', table_name='security_investigations')
    op.drop_index('ix_security_investigations_investigation_id', table_name='security_investigations')
    op.drop_table('security_investigations')
