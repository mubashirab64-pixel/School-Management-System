from django.apps import AppConfig

class PrincipalsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'principals'
    
    def ready(self):
        import principals.signals  # Import signals