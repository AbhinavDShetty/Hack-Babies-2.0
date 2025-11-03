from django.apps import AppConfig
import os

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        from .vector_search import load_docs_from_file
        path = os.path.join(os.path.dirname(__file__), "..", "data", "rag_docs.json")
        if os.path.exists(path):
            try:
                load_docs_from_file(path)
            except Exception:
                pass