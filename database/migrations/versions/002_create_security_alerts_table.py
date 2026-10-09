"""Create security_alerts table

Revision ID: 002_create_security_alerts_table
Revises: 001_create_security_events_table
Create Date: 2026-10-09 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '002_create_security_alerts_table'
down_revision: Union[str, None] = '001_create_security_events_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'security_alerts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('alert_id', sa.String(length=128), nullable=False),
        sa.Column('fingerprint', sa.String(length=256), nullable=False),
        sa.Column('rule_id', sa.String(length=64), nullable=False),
        sa.Column('rule_name', sa.String(length=128), nullable=False),
        sa.Column('severity', sa.String(length=32), nullable=False),
        sa.Column('risk_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('title', sa.String(length=256), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='OPEN'),
        sa.Column('related_event_ids', sa.JSON(), nullable=False),
        sa.Column('evidence', sa.JSON(), nullable=False),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('occurrence_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_security_alerts_alert_id', 'security_alerts', ['alert_id'], unique=True)
    op.create_index('ix_security_alerts_fingerprint', 'security_alerts', ['fingerprint'], unique=False)
    op.create_index('ix_security_alerts_rule_id', 'security_alerts', ['rule_id'], unique=False)
    op.create_index('ix_security_alerts_severity', 'security_alerts', ['severity'], unique=False)
    op.create_index('ix_security_alerts_status', 'security_alerts', ['status'], unique=False)
    op.create_index('ix_security_alerts_first_seen', 'security_alerts', ['first_seen'], unique=False)
    op.create_index('ix_security_alerts_last_seen', 'security_alerts', ['last_seen'], unique=False)
    op.create_index('ix_security_alerts_created_at', 'security_alerts', ['created_at'], unique=False)
    op.create_index('ix_security_alerts_fingerprint_status', 'security_alerts', ['fingerprint', 'status'], unique=False)
    op.create_index('ix_security_alerts_severity_created_at', 'security_alerts', ['severity', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_security_alerts_severity_created_at', table_name='security_alerts')
    op.drop_index('ix_security_alerts_fingerprint_status', table_name='security_alerts')
    op.drop_index('ix_security_alerts_created_at', table_name='security_alerts')
    op.drop_index('ix_security_alerts_last_seen', table_name='security_alerts')
    op.drop_index('ix_security_alerts_first_seen', table_name='security_alerts')
    op.drop_index('ix_security_alerts_status', table_name='security_alerts')
    op.drop_index('ix_security_alerts_severity', table_name='security_alerts')
    op.drop_index('ix_security_alerts_rule_id', table_name='security_alerts')
    op.drop_index('ix_security_alerts_fingerprint', table_name='security_alerts')
    op.drop_index('ix_security_alerts_alert_id', table_name='security_alerts')
    op.drop_table('security_alerts')
