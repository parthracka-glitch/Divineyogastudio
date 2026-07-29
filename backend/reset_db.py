import asyncio
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

from core.database import db, create_indexes
from services.seed import seed_data


async def reset_database():
    print("Resetting database...")
    collections = await db.list_collection_names()
    for name in collections:
        if not name.startswith("system."):
            await db.drop_collection(name)
            print(f"Dropped collection: {name}")

    print("Re-creating indexes...")
    await create_indexes()

    print("Seeding fresh data...")
    await seed_data()

    print("Database successfully reset and seeded!")


if __name__ == "__main__":
    asyncio.run(reset_database())
