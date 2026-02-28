# """
# Run this file to start the backend locally without Docker.
# Usage: python run.py
# """
# import sys
# import os

# # Add backend/ to Python path so all imports resolve correctly
# sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# # Load .env file
# from dotenv import load_dotenv
# load_dotenv()

# import uvicorn

# if __name__ == "__main__":
#     uvicorn.run(
#         "api.main:app",
#         host="0.0.0.0",
#         port=8000,
#         reload=True,
#         reload_dirs=["."]
#     )