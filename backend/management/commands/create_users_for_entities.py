from django.core.management.base import BaseCommand
from services.user_creation_service import UserCreationService

class Command(BaseCommand):
    help = 'Create users for existing entities without users'
    
    def handle(self, *args, **options):
        self.stdout.write('Starting user creation for existing entities...')
        
        results = UserCreationService.create_users_for_existing_entities()
        
        # Print results
        for entity_type, stats in results.items():
            self.stdout.write(f"\n{entity_type.title()}:")
            self.stdout.write(f"  Created: {stats['created']}")
            self.stdout.write(f"  Failed: {stats['failed']}")
            
            if stats['errors']:
                self.stdout.write("  Errors:")
                for error in stats['errors'][:5]:  # Show first 5 errors
                    self.stdout.write(f"    - {error}")
                if len(stats['errors']) > 5:
                    self.stdout.write(f"    ... and {len(stats['errors']) - 5} more errors")
        
        self.stdout.write('\nUser creation process completed!')