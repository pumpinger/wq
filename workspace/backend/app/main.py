from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routes import (
    field_definitions_router,
    customer_templates_router,
    customers_router,
    auth_router,
    tenants_router,
    users_router,
    roles_router,
    customer_pool_router,
    regions_router
)

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="外勤管理系统 - SaaS平台API",
    description="多租户SaaS客户管理系统，支持多模板、多字段的客户信息录入",
    version="2.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router, prefix="/api")
app.include_router(tenants_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(field_definitions_router, prefix="/api")
app.include_router(customer_templates_router, prefix="/api")
app.include_router(customers_router, prefix="/api")
app.include_router(roles_router, prefix="/api")
app.include_router(customer_pool_router, prefix="/api")
app.include_router(regions_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "外勤管理系统 - SaaS平台API", "version": "2.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
