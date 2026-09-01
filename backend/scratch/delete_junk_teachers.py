import sys
import os
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from teachers.models import Teacher
from django.db.models import Q

print("Deleting teachers with empty or null teacher_id/employee_code...")
junk = Teacher.objects.with_deleted().filter(
    Q(teacher_id="") | Q(teacher_id__isnull=True) | 
    Q(employee_code="") | Q(employee_code__isnull=True)
)
print(f"Found {junk.count()} junk teachers.")
for t in junk:
    print(f"Deleting PK: {t.pk}, Name: {t.full_name}")
    t.hard_delete() # Using the method defined in model
