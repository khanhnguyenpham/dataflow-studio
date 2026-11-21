"""Keep the uploaded source immutable; point at separately stored derived versions."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_versions"
down_revision = "0001_workspace"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("datasets", sa.Column("current_version", sa.Integer(), nullable=False, server_default="1"))
    payload = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    op.create_table(
        "dataset_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("parent_number", sa.Integer(), nullable=False),
        sa.Column("columns", payload, nullable=False),
        sa.Column("records", payload, nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("steps", payload, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("dataset_id", "number"),
    )
    op.create_index("ix_dataset_versions_dataset_id", "dataset_versions", ["dataset_id"])
    op.create_table(
        "previews",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("input_version", sa.Integer(), nullable=False),
        sa.Column("result", payload, nullable=False),
        sa.Column("steps", payload, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("applied_version", sa.Integer()),
    )
    for column in ["dataset_id", "owner_id", "expires_at"]:
        op.create_index(f"ix_previews_{column}", "previews", [column])


def downgrade():
    op.drop_table("previews")
    op.drop_table("dataset_versions")
    op.drop_column("datasets", "current_version")
