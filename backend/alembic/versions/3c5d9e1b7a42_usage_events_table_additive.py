"""usage_events table for the admin activity log (additive, ADR 0028)

Revision ID: 3c5d9e1b7a42
Revises: 7a341bae9936
Create Date: 2026-10-05 21:30:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c5d9e1b7a42'
down_revision: str | None = '7a341bae9936'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('usage_events',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('client_id', sa.Text(), nullable=False),
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('kind', sa.Text(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('detail', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_usage_events_occurred_at', 'usage_events', ['occurred_at'], unique=False)
    op.create_index('ix_usage_events_kind_name', 'usage_events', ['kind', 'name'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_usage_events_kind_name', table_name='usage_events')
    op.drop_index('ix_usage_events_occurred_at', table_name='usage_events')
    op.drop_table('usage_events')
