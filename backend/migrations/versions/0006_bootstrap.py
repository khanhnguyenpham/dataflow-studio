"""Remember first-admin bootstrap without retaining its secret."""
from alembic import op
import sqlalchemy as sa

revision = "0006_bootstrap"
down_revision = "0005_administration"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("site_config", sa.Column("bootstrap_completed", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade():
    op.drop_column("site_config", "bootstrap_completed")
