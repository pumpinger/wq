from sqlalchemy import Column, Integer, Boolean, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import relationship

from ..database import Base


class TemplateField(Base):
    __tablename__ = "tn_template_fields"

    id = Column(Integer, primary_key=True, autoincrement=True)
    template_id = Column(Integer, ForeignKey("tn_customer_templates.id", ondelete="CASCADE"), nullable=False)
    field_id = Column(Integer, ForeignKey("tn_field_definitions.id", ondelete="CASCADE"), nullable=False)
    is_required = Column(Boolean, default=False, comment="是否必填")
    sort_order = Column(Integer, default=0, comment="排序")
    options = Column(JSON, nullable=True, comment="该模板中此字段的选项值（覆盖字段定义的默认值）")

    __table_args__ = (
        UniqueConstraint("template_id", "field_id", name="uk_template_field"),
    )

    # 关联
    template = relationship("CustomerTemplate", back_populates="template_fields")
    field = relationship("FieldDefinition")
