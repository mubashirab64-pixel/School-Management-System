import sys
import os
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Organization
from services.models import GlobalCounter

print("Organizations:")
for org in Organization.objects.all():
    print(f"ID: {org.id}, Name: {org.name}")

print("\nCleaning up duplicate GlobalCounters for key 'employee_teacher' with null organization...")
# We keep the one with the highest value
counters = GlobalCounter._base_manager.filter(key='employee_teacher', organization__isnull=True).order_by('-value')
if counters.count() > 1:
    to_keep = counters[0]
    to_delete = counters[1:]
    print(f"Keeping PK: {to_keep.pk}, Value: {to_keep.value}")
    for c in to_delete:
        print(f"Deleting PK: {c.pk}, Value: {c.value}")
        c.delete()
else:
    print("No duplicates found for 'employee_teacher' with null organization.")

# Do the same for other roles
for role in ['principal', 'coordinator', 'accounts_officer', 'student']:
    key = f'employee_{role}' if role != 'student' else 'student'
    counters = GlobalCounter._base_manager.filter(key=key, organization__isnull=True).order_by('-value')
    if counters.count() > 1:
        to_keep = counters[0]
        to_delete = counters[1:]
        print(f"\nCleaning up duplicates for '{key}'...")
        for c in to_delete:
            c.delete()
