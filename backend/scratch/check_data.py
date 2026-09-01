import sys
import os
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from teachers.models import Teacher
from services.models import GlobalCounter
from users.models import Organization

print("Checking Teachers with empty teacher_id...")
empty_id_teachers = Teacher.objects.with_deleted().filter(teacher_id="")
for t in empty_id_teachers:
    print(f"Teacher PK: {t.pk}, Name: {t.full_name}, ID: '{t.teacher_id}'")

print("\nChecking GlobalCounters...")
counters = GlobalCounter._base_manager.all()
for c in counters:
    org_name = c.organization.name if c.organization else "No Org"
    print(f"Key: {c.key}, Value: {c.value}, Org: {org_name}")

if empty_id_teachers.exists():
    print("\nFixing empty teacher_ids by deleting them (assuming they are junk from failed attempts)...")
    count, _ = empty_id_teachers.delete()
    print(f"Deleted {count} records.")
