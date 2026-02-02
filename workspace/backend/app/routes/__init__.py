from .field_definitions import router as field_definitions_router
from .customer_templates import router as customer_templates_router
from .customers import router as customers_router
from .auth import router as auth_router
from .tenants import router as tenants_router
from .users import router as users_router
from .roles import router as roles_router
from .customer_pool import router as customer_pool_router
from .regions import router as regions_router
from .visit_task_types import router as visit_task_types_router
from .visit_plans import router as visit_plans_router
from .visit_tasks import router as visit_tasks_router
from .visit_records import router as visit_records_router
from .upload import router as upload_router
from .subscription_orders import router as subscription_orders_router
from .attendance import router as attendance_router

__all__ = [
    "field_definitions_router",
    "customer_templates_router",
    "customers_router",
    "auth_router",
    "tenants_router",
    "users_router",
    "roles_router",
    "customer_pool_router",
    "regions_router",
    "visit_task_types_router",
    "visit_plans_router",
    "visit_tasks_router",
    "visit_records_router",
    "upload_router",
    "subscription_orders_router",
    "attendance_router",
]
