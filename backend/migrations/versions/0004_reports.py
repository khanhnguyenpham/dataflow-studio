from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_reports"
down_revision = "0003_workflows"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_version", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("specification", sa.JSON().with_variant(postgresql.JSONB(), "postgresql"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reports_owner_id", "reports", ["owner_id"])
    op.create_index("ix_reports_dataset_id", "reports", ["dataset_id"])


def downgrade():
    op.drop_table("reports")
