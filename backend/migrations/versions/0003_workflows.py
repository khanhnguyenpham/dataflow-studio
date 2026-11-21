"""Versioned recipes and persisted, idempotent execution state."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_workflows"
down_revision = "0002_versions"
branch_labels = None
depends_on = None


def upgrade():
    payload = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    op.create_table(
        "workflows",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(1000), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_workflows_owner_id", "workflows", ["owner_id"])
    op.create_table(
        "workflow_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workflow_id", sa.String(36), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("definition", payload, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workflow_id", "number"),
    )
    op.create_index("ix_workflow_versions_workflow_id", "workflow_versions", ["workflow_id"])
    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workflow_id", sa.String(36), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workflow_version", sa.Integer(), nullable=False),
        sa.Column("source_dataset_id", sa.String(36), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_version", sa.Integer(), nullable=False),
        sa.Column("right_dataset_id", sa.String(36), sa.ForeignKey("datasets.id", ondelete="CASCADE")),
        sa.Column("right_version", sa.Integer()),
        sa.Column("idempotency_key", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("result_preview", sa.String(36)),
        sa.Column("result_summary", payload),
        sa.Column("error_code", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("workflow_id", "idempotency_key"),
    )
    op.create_index("ix_workflow_runs_workflow_id", "workflow_runs", ["workflow_id"])


def downgrade():
    op.drop_table("workflow_runs")
    op.drop_table("workflow_versions")
    op.drop_table("workflows")
