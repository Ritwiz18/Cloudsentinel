"""Create security_events table

Revision ID: 001_create_security_events_table
Revises: 
Create Date: 2026-10-09 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_create_security_events_table'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'security_events',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('event_id', sa.String(length=128), nullable=False),
        sa.Column('source', sa.String(length=64), nullable=False),
        sa.Column('event_type', sa.String(length=64), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('account_id', sa.String(length=64), nullable=True),
        sa.Column('region', sa.String(length=32), nullable=True),
        sa.Column('actor', sa.String(length=128), nullable=True),
        sa.Column('source_ip', sa.String(length=64), nullable=True),
        sa.Column('resource', sa.String(length=256), nullable=True),
        sa.Column('outcome', sa.String(length=32), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=False),
        sa.Column('ingested_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_security_events_event_id', 'security_events', ['event_id'], unique=True)
    op.create_index('ix_security_events_source', 'security_events', ['source'], unique=False)
    op.create_index('ix_security_events_event_type', 'security_events', ['event_type'], unique=False)
    op.create_index('ix_security_events_timestamp', 'security_events', ['timestamp'], unique=False)
    op.create_index('ix_security_events_account_id', 'security_events', ['account_id'], unique=False)
    op.create_index('ix_security_events_actor', 'security_events', ['actor'], unique=False)
    op.create_index('ix_security_events_source_ip', 'security_events', ['source_ip'], unique=False)
    op.create_index('ix_security_events_outcome', 'security_events', ['outcome'], unique=False)
    op.create_index('ix_security_events_ingested_at', 'security_events', ['ingested_at'], unique=False)
    op.create_index('ix_security_events_type_outcome', 'security_events', ['event_type', 'outcome'], unique=False)
    op.create_index('ix_security_events_ingested_at_desc', 'security_events', ['ingested_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_security_events_ingested_at_desc', table_name='security_events')
    op.drop_index('ix_security_events_type_outcome', table_name='security_events')
    op.drop_index('ix_security_events_ingested_at', table_name='security_events')
    op.drop_index('ix_security_events_outcome', table_name='security_events')
    op.drop_index('ix_security_events_source_ip', table_name='security_events')
    op.drop_index('ix_security_events_actor', table_name='security_events')
    op.drop_index('ix_security_events_account_id', table_name='security_events')
    op.drop_index('ix_security_events_timestamp', table_name='security_events')
    op.drop_index('ix_security_events_event_type', table_name='security_events')
    op.drop_index('ix_security_events_source', table_name='security_events')
    op.drop_index('ix_security_events_event_id', table_name='security_events')
    op.drop_table('security_events')
