from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "mysql+pymysql://root:root@127.0.0.1:3306/wq"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,  # 检查连接是否有效
    pool_recycle=3600,   # 每小时回收连接
    pool_size=5,
    max_overflow=10
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
