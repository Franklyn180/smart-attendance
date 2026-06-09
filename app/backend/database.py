import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

base_dir = Path(__file__).resolve().parent
load_dotenv(base_dir / '.env')

db_host = os.getenv('DB_HOST')
db_user = os.getenv('DB_USER')
db_password = os.getenv('DB_PASSWORD')
db_name = os.getenv('DB_NAME')

if db_host and db_user and db_password and db_name:
    DATABASE_URL = f'mysql+pymysql://{db_user}:{db_password}@{db_host}:3306/{db_name}'
else:
    DATABASE_URL = os.getenv('DATABASE_URL') or 'sqlite:///./attendance.db'

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()
