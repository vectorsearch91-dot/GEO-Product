import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import engine, Base
from api.v1 import products, simulations, analytics, seeding

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting GEO Platform API...")
    try:
        # Recreate tables to apply schema upgrades (new columns like queries_per_persona, and log tables)
        Base.metadata.drop_all(bind=engine)
        logger.info("🗑️ Dropped old tables for schema sync")
    except Exception as e:
        logger.warning(f"Could not drop tables: {e}")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created/verified")
    yield
    logger.info("GEO Platform API shutting down")


app = FastAPI(
    title="GEO Platform API",
    description="Generative Engine Optimization — AI Search Visibility for Enterprise Brands",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION, "app": settings.APP_NAME}


@app.get("/")
def root():
    return {"message": "GEO Platform API is running", "docs": "/docs", "version": settings.APP_VERSION}


app.include_router(products.router, prefix="/api/v1")
app.include_router(simulations.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(seeding.router, prefix="/api/v1")
