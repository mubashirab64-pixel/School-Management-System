from django.core.management.base import BaseCommand
from users.models import SubscriptionPlan

class Command(BaseCommand):
    help = 'Seed initial subscription plans'

    def handle(self, *args, **kwargs):
        plans = [
            {
                'name': 'Basic',
                'max_students': 200,
                'max_users': 30,
                'max_campuses': 20,
                'description': 'Essential features for small schools'
            },
            {
                'name': 'Advance',
                'max_students': 500,
                'max_users': 50,
                'max_campuses': 20,
                'description': 'Enhanced capabilities for growing institutions'
            },
            {
                'name': 'Advance-Pro',
                'max_students': 1500,
                'max_users': 150,
                'max_campuses': 30,
                'description': 'Professional tools for large school systems'
            },
            {
                'name': 'Premium',
                'max_students': 3500,
                'max_users': 250,
                'max_campuses': 50,
                'description': 'Full-featured premium platform experience'
            },
            {
                'name': 'Enterprise',
                'max_students': 999999,  # Unlimited
                'max_users': 350,
                'max_campuses': 999,    # Unlimited
                'description': 'Maximum capacity and priority support'
            }
        ]

        for p_data in plans:
            plan, created = SubscriptionPlan.objects.get_or_create(
                name=p_data['name'],
                defaults={
                    'max_students': p_data['max_students'],
                    'max_users': p_data['max_users'],
                    'max_campuses': p_data['max_campuses'],
                    'description': p_data['description']
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created plan: {plan.name}'))
            else:
                # Update existing plans if they changed
                plan.max_students = p_data['max_students']
                plan.max_users = p_data['max_users']
                plan.max_campuses = p_data['max_campuses']
                plan.description = p_data['description']
                plan.save()
                self.stdout.write(self.style.SUCCESS(f'Updated plan: {plan.name}'))
