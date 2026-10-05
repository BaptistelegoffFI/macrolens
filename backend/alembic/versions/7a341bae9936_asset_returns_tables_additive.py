"""asset returns tables (additive)

Revision ID: 7a341bae9936
Revises: fc77db09a6e1
Create Date: 2026-10-05 07:33:26.381166

Migration strictement additive (ADR 0024) : deux tables et un index, aucune
colonne ajoutée, modifiée ni supprimée sur une table existante. L'API déjà
déployée ne lit aucune de ces tables et continue donc de fonctionner à
l'identique sur une base migrée.

Retour arrière : `alembic downgrade fc77db09a6e1` supprime les deux tables
(la donnée qu'elles contiennent se reconstruit entièrement par
`macrolens etl run-all`, elle n'a pas d'autre source de vérité). Il doit être
lancé AVANT de redéployer un commit antérieur : le démarrage de l'API exécute
`alembic upgrade head`, qui échoue sur une base portant une révision qu'il
ne connaît pas.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7a341bae9936'
down_revision: str | None = 'fc77db09a6e1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'asset_series',
        sa.Column('id', sa.Text(), nullable=False),
        sa.Column('asset_class', sa.Text(), nullable=False),
        sa.Column('tier', sa.SmallInteger(), nullable=False),
        sa.Column('measure', sa.Text(), nullable=False),
        sa.Column('source_id', sa.Text(), nullable=False),
        sa.Column('citation', sa.Text(), nullable=False),
        sa.Column('label_fr', sa.Text(), nullable=False),
        sa.Column('label_en', sa.Text(), nullable=False),
        sa.Column('caveat_fr', sa.Text(), nullable=True),
        sa.Column('caveat_en', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['source_id'], ['sources.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'asset_observations',
        sa.Column('series_id', sa.Text(), nullable=False),
        sa.Column('country_iso3', sa.String(length=3), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('freq', sa.String(length=1), nullable=False),
        sa.Column('value', sa.Double(), nullable=False),
        sa.Column('is_interpolated', sa.Boolean(), nullable=False),
        sa.Column('is_break', sa.Boolean(), nullable=False),
        sa.Column('raw_file_id', sa.BigInteger(), nullable=True),
        sa.Column('locator', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('raw_value_text', sa.Text(), nullable=True),
        sa.Column('transform_chain', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('ingested_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['country_iso3'], ['countries.iso3']),
        sa.ForeignKeyConstraint(['raw_file_id'], ['raw_files.id']),
        sa.ForeignKeyConstraint(['series_id'], ['asset_series.id']),
        sa.PrimaryKeyConstraint('series_id', 'country_iso3', 'period_start', 'freq'),
    )
    op.create_index(
        'ix_asset_observations_country_series',
        'asset_observations',
        ['country_iso3', 'series_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_asset_observations_country_series', table_name='asset_observations')
    op.drop_table('asset_observations')
    op.drop_table('asset_series')
