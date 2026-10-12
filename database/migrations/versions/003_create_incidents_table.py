"""Create security_incidents and incident_audits tables

Revision ID: 003_create_incidents_table
Revises: 002_create_security_alerts_table
Create Date: 2026-10-09 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '003_create_incidents_table'
down_revision: Union[str, None] = '002_create_security_alerts_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. security_incidents
    op.create_table(
        'security_incidents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('incident_id', sa.String(length=128), nullable=False),
        sa.Column('title', sa.String(length=256), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(length=32), nullable=False),
        sa.Column('risk_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='OPEN'),
        sa.Column('correlation_fingerprint', sa.String(length=256), nullable=False),
        sa.Column('related_alert_ids', sa.JSON(), nullable=False),
        sa.Column('related_event_ids', sa.JSON(), nullable=False),
        sa.Column('correlation_reasons', sa.JSON(), nullable=False),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('assigned_analyst', sa.String(length=128), nullable=True),
        sa.Column('resolution_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_security_incidents_incident_id', 'security_incidents', ['incident_id'], unique=True)
    op.create_index('ix_security_incidents_severity', 'security_incidents', ['severity'], unique=False)
    op.create_index('ix_security_incidents_status', 'security_incidents', ['status'], unique=False)
    op.create_index('ix_security_incidents_correlation_fingerprint', 'security_incidents', ['correlation_fingerprint'], unique=False)
    op.create_index('ix_security_incidents_assigned_analyst', 'security_incidents', ['assigned_analyst'], unique=False)
    op.create_index('ix_security_incidents_first_seen', 'security_incidents', ['first_seen'], unique=False)
    op.create_index('ix_security_incidents_last_seen', 'security_incidents', ['last_seen'], unique=False)
    op.create_index('ix_security_incidents_created_at', 'security_incidents', ['created_at'], unique=False)
    op.create_index('ix_security_incidents_fingerprint_status', 'security_incidents', ['correlation_fingerprint', 'status'], unique=False)
    op.create_index('ix_security_incidents_severity_created_at', 'security_incidents', ['severity', 'created_at'], unique=False)

    # 2. incident_audits
    op.create_table(
        'incident_audits',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('incident_id', sa.String(length=128), nullable=False),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('previous_state', sa.JSON(), nullable=True),
        sa.Column('new_state', sa.JSON(), nullable=True),
        sa.Column('actor', sa.String(length=128), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_incident_audits_incident_id', 'incident_audits', ['incident_id'], unique=False)
    op.create_index('ix_incident_audits_action', 'incident_audits', ['action'], unique=False)
    op.create_index('ix_incident_audits_created_at', 'incident_audits', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_incident_audits_created_at', table_name='incident_audits')
    op.drop_index('ix_incident_audits_action', table_name='incident_audits')
    op.drop_index('ix_incident_audits_incident_id', table_name='incident_audits')
    op.drop_table('incident_audits')

    op.drop_index('ix_security_incidents_severity_created_at', table_name='security_incidents')
    op.drop_index('ix_security_incidents_fingerprint_status', table_name='security_incidents')
    op.drop_index('ix_security_incidents_created_at', table_name='security_incidents')
    op.drop_index('ix_security_incidents_last_seen', table_name='security_incidents')
    op.drop_index('ix_security_incidents_first_seen', table_name='security_incidents')
    op.drop_index('ix_security_incidents_assigned_analyst', table_name='security_incidents')
    op.drop_index('ix_security_incidents_correlation_fingerprint', table_name='security_incidents')
    op.drop_index('ix_security_incidents_status', table_name='security_incidents')
    op.drop_index('ix_security_incidents_severity', table_name='security_incidents')
    op.drop_index('ix_security_incidents_incident_id', table_name='security_incidents')
    op.drop_table('security_incidents')
