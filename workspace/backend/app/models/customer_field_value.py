from sqlalchemy import Column, Integer, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class CustomerFieldValue(Base):
    __tablename__ = "tn_customer_field_values"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("tn_customers.id", ondelete="CASCADE"), nullable=False)
    field_id = Column(Integer, ForeignKey("tn_field_definitions.id"), nullable=False)
    value = Column(JSON, nullable=True, comment="字段值")

    __table_args__ = (
        UniqueConstraint("customer_id", "field_id", name="uk_customer_field"),
    )

    # 关联
    customer = relationship("Customer", back_populates="field_values")
    field = relationship("FieldDefinition")
