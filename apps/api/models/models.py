from sqlalchemy import Column, String, JSON, Integer, DateTime, Boolean, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
from core.database import Base


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    products = relationship("Product", back_populates="organization", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    name = Column(String, nullable=False)
    brand_name = Column(String, nullable=False)
    category = Column(String, default="Skincare")
    description = Column(Text, nullable=True)
    image_urls = Column(JSON, default=list)
    ingredients = Column(JSON, default=list)
    key_benefits = Column(JSON, default=list)
    target_demographics = Column(JSON, default=dict)
    pricing_tier = Column(String, nullable=True)
    personas = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    organization = relationship("Organization", back_populates="products")
    simulation_runs = relationship("SimulationRun", back_populates="product", cascade="all, delete-orphan")


class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    status = Column(String, default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    target_llms = Column(JSON, default=list)
    progress = Column(Integer, default=0)
    total_queries = Column(Integer, default=0)
    completed_queries = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    product = relationship("Product", back_populates="simulation_runs")
    results = relationship("SimulationResult", back_populates="simulation_run", cascade="all, delete-orphan")


class SimulationResult(Base):
    __tablename__ = "simulation_results"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    simulation_run_id = Column(String, ForeignKey("simulation_runs.id"), nullable=False)
    query_text = Column(Text)
    persona_name = Column(String)
    intent_category = Column(String)
    llm_model = Column(String)
    llm_display_name = Column(String)
    raw_response = Column(Text)
    is_product_surfaced = Column(Boolean, default=False)
    surfaced_position = Column(Integer, nullable=True)
    competitors_surfaced = Column(JSON, default=list)
    recommendation_reason = Column(Text, nullable=True)
    cited_domains = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    simulation_run = relationship("SimulationRun", back_populates="results")
