import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from attendance.models import Attendance, StudentAttendance
from classes.models import ClassRoom

def fix_attendance():
    # Find attendances with missing organization or 0 counts
    attendances = Attendance.objects.filter(organization__isnull=True) | Attendance.objects.filter(total_students=0)
    
    print(f"Found {attendances.count()} attendance records to check/fix.")
    
    for att in attendances:
        print(f"Checking {att.classroom} on {att.date}...")
        
        # 1. Fix organization
        if not att.organization:
            if att.classroom and att.classroom.organization:
                att.organization = att.classroom.organization
                print(f"  - Set organization to {att.organization.name}")
            else:
                print(f"  - WARNING: Could not find organization for classroom {att.classroom}")
        
        # 2. Fix StudentAttendance organization
        sas = StudentAttendance.objects.filter(attendance=att)
        updated_sas = 0
        for sa in sas:
            if not sa.organization:
                sa.organization = att.organization
                sa.save()
                updated_sas += 1
        if updated_sas > 0:
            print(f"  - Updated {updated_sas} student attendance organization fields.")
        
        # 3. Update counts
        # We need to bypass the manager if it's still filtering
        # Since this script runs as a management command (no current user), 
        # the OrganizationManager might return everything or nothing depending on its implementation.
        # Let's check the manager again.
        
        att.update_counts()
        print(f"  - Updated counts: Total={att.total_students}, Present={att.present_count}")
        
        att.save()

if __name__ == "__main__":
    fix_attendance()
