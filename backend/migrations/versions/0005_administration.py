"""Audit, shared bounded quotas and indexed-size accounting without payload scans."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_administration"
down_revision = "0004_reports"
branch_labels = None
depends_on = None

INITIAL_LIMITS = {
    "guest_datasets": 3,
    "user_datasets": 30,
    "guest_source_mb": 10,
    "user_source_mb": 50,
    "guest_storage_mb": 64,
    "user_storage_mb": 256,
    "guest_versions": 5,
    "user_versions": 20,
    "guest_workflows": 5,
    "user_workflows": 20,
    "guest_runs": 30,
    "user_runs": 200,
    "guest_reports": 10,
    "user_reports": 30,
    "active_guest_limit": 20,
    "global_storage_mb": 256,
}


def upgrade():
    payload = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    op.create_table(
        "site_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("limits", payload, nullable=False),
    )
    table = sa.table(
        "site_config", sa.column("id", sa.Integer()), sa.column("revision", sa.Integer()), sa.column("limits", payload)
    )
    op.bulk_insert(table, [{"id": 1, "revision": 1, "limits": INITIAL_LIMITS}])
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("target_id", sa.String(36)),
        sa.Column("details", payload, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    fields = {
        "datasets": ["columns", "records"],
        "dataset_versions": ["columns", "records", "steps"],
        "previews": ["result", "steps"],
        "workflow_versions": ["definition"],
        "reports": ["specification"],
    }
    for name, columns in fields.items():
        op.add_column(name, sa.Column("storage_bytes", sa.Integer(), nullable=False, server_default="0"))
        table = sa.table(
            name,
            sa.column("storage_bytes", sa.Integer()),
            *[sa.column(column, payload) for column in columns],
            sa.column("original_bytes", sa.LargeBinary()),
        )
        budget = sum(4 * sa.func.length(sa.cast(table.c[column], sa.Text())) for column in columns)
        if name == "datasets":
            budget += sa.func.length(table.c.original_bytes)
        op.execute(table.update().values(storage_bytes=budget))


def downgrade():
    for name in ["reports", "workflow_versions", "previews", "dataset_versions", "datasets"]:
        op.drop_column(name, "storage_bytes")
    op.drop_table("audit_logs")
    op.drop_table("site_config")
