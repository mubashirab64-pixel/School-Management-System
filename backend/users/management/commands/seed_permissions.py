from django.core.management.base import BaseCommand
from users.models import RolePermission


# Default permissions per role
# SuperAdmin gets all permissions ON by default, but they can be toggled via the UI
DEFAULT_PERMISSIONS = {
    'superadmin': {
        'view_dashboard': True,
        'view_students': True,
        'add_student': True,
        'edit_student': True,
        'view_teachers': True,
        'add_teacher': True,
        'view_campus': True,
        'add_campus': True,
        'view_principals': True,
        'add_principal': True,
        'view_coordinators': True,
        'add_coordinator': True,
        'view_attendance': True,
        'mark_attendance': True,
        'approve_attendance': True,
        'view_results': True,
        'approve_results': True,
        'bulk_import_results':True,
        'edit_results':True,
        'view_transfers': True,
        'view_timetable': True,
        'view_requests': True,
        'view_promotions': True,
        'view_subjects': True,
        # Chart Permissions
        'view_grade_distribution_chart': True,
        'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True,
        'view_religion_chart': True,
        'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True,
        'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': True,
        'view_house_ownership_chart': True,
        'view_network_performance_chart': True,
        # KPI Permissions
        'view_total_students_kpi': True,
        'view_total_teachers_kpi': True,
        'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True,
        # Fees/Finance
        'view_fees': True,
        'manage_fees': True,
        # Dashboard Permissions
        'view_admin_dashboard': True,
        'view_teacher_dashboard': True,
        'view_coordinator_dashboard': True,
        'view_principal_dashboard': True,
        'view_student_dashboard': True,
        'view_superadmin_dashboard': True,
        # Management
        'manage_permissions': True,
        'manage_forms': True,
    },
    'org_admin': {
        'view_dashboard': True,
        'view_students': True,
        'add_student': True,
        'edit_student': True,
        'view_teachers': True,
        'add_teacher': True,
        'view_campus': True,
        'add_campus': True,
        'view_principals': True,
        'add_principal': True,
        'view_coordinators': True,
        'add_coordinator': True,
        'view_attendance': True,
        'mark_attendance': True,
        'approve_attendance': True,
        'view_results': True,
        'approve_results': True,
        'view_transfers': True,
        'view_timetable': True,
        'view_requests': True,
        'view_promotions': True,
        'view_subjects': True,
        # Chart Permissions
        'view_grade_distribution_chart': True,
        'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True,
        'view_religion_chart': True,
        'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True,
        'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': True,
        'view_house_ownership_chart': True,
        'view_network_performance_chart': True,
        # KPI Permissions
        'view_total_students_kpi': True,
        'view_total_teachers_kpi': True,
        'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True,
        # Fees/Finance
        'view_fees': True,
        'manage_fees': True,
        # Dashboard Permissions
        'view_admin_dashboard': True,
        'view_teacher_dashboard': True,
        'view_coordinator_dashboard': True,
        'view_principal_dashboard': True,
        'view_student_dashboard': True,
        # Management
        'manage_permissions': True,
        'manage_forms': True,
    },
    'principal': {
        'view_dashboard': True,
        'view_students': True,
        'add_student': True,
        'edit_student': True,
        'view_teachers': True,
        'add_teacher': True,
        'view_campus': True,
        'add_campus': True,
        'view_principals': False,
        'add_principal': False,
        'view_coordinators': True,
        'add_coordinator': True,
        'view_attendance': True,
        'mark_attendance': False,
        'approve_attendance': True,
        'view_results': True,
        'approve_results': True,
        'bulk_import_results':True,
        'edit_results':True,
        'view_transfers': True,
        'view_timetable': True,
        'view_requests': True,
        'view_promotions': True,
        'view_subjects': True,
        # Fees/Finance
        'view_fees': True,
        'manage_fees': True,
        # Chart Permissions
        'view_grade_distribution_chart': True,
        'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True,
        'view_religion_chart': True,
        'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True,
        'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': True,
        'view_house_ownership_chart': True,
        'view_network_performance_chart': True,
        # KPI Permissions
        'view_total_students_kpi': True,
        'view_total_teachers_kpi': True,
        'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True,
        # Dashboard Permissions
        'view_principal_dashboard': True,
        # Management
        'manage_permissions': False,
        'manage_forms': False,
    },
    'coordinator': {
        'view_dashboard': True,
        'view_students': True,
        'add_student': True,
        'edit_student': True,
        'view_teachers': True,
        'add_teacher': False,
        'view_campus': False,
        'add_campus': False,
        'view_principals': False,
        'add_principal': False,
        'view_coordinators': False,
        'add_coordinator': False,
        'view_attendance': True,
        'mark_attendance': False,
        'approve_attendance': True,
        'view_results': True,
        'approve_results': True,
        'bulk_import_results':True,
        'edit_results':True,
        'view_transfers': True,
        'view_timetable': True,
        'view_requests': True,
        'view_promotions': False,
        'view_subjects': True,
        # Fees/Finance
        'view_fees': True,
        'manage_fees': False,
        # Chart Permissions
        'view_grade_distribution_chart': True,
        'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True,
        'view_religion_chart': True,
        'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True,
        'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': True,
        'view_house_ownership_chart': True,
        'view_network_performance_chart': True,
        # KPI Permissions
        'view_total_students_kpi': True,
        'view_total_teachers_kpi': True,
        'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True,
        # Dashboard Permissions
        'view_coordinator_dashboard': True,
        # Management
        'manage_permissions': False,
        'manage_forms': False,
    },
    'teacher': {
        'view_dashboard': False,
        'view_students': True,
        'add_student': False,
        'edit_student': False,
        'view_teachers': True,
        'add_teacher': False,
        'view_campus': False,
        'add_campus': False,
        'view_principals': False,
        'add_principal': False,
        'view_coordinators': False,
        'add_coordinator': False,
        'view_attendance': True,
        'mark_attendance': True,
        'approve_attendance': False,
        'view_results': True,
        'approve_results': False,
        'bulk_import_results':True,
        'edit_results': True,
        'view_transfers': True,
        'view_timetable': True,
        'view_requests': True,
        'view_promotions': False,
        'view_subjects': False,
        # Fees/Finance
        'view_fees': False,
        'manage_fees': False,
        # Chart Permissions (Default OFF for teachers)
        'view_grade_distribution_chart': False,
        'view_gender_distribution_chart': False,
        'view_mother_tongue_chart': False,
        'view_religion_chart': False,
        'view_enrollment_trend_chart': False,
        'view_age_distribution_chart': False,
        'view_weekly_attendance_chart': False,
        'view_zakat_status_chart': False,
        'view_house_ownership_chart': False,
        'view_network_performance_chart': True,
        # KPI Permissions
        'view_total_students_kpi': False,
        'view_total_teachers_kpi': False,
        'view_teacher_student_ratio_kpi': False,
        'view_avg_attendance_kpi': False,
        # Dashboard Permissions
        'view_teacher_dashboard': True,
        # Management
        'manage_permissions': False,
        'manage_forms': False,
    },
    # Donor: read-only ("view access") supporter of a single organization.
    # Sees an org-scoped dashboard plus the people lists (students, teachers,
    # coordinators, principals). NO create/edit/delete/approve anywhere.
    'donor': {
        # Dashboard (org-scoped, NOT the SaaS-owner superadmin dashboard)
        'view_dashboard': True,
        'view_superadmin_dashboard': False,
        # People lists — view only
        'view_students': True,
        'add_student': False,
        'edit_student': False,
        'view_teachers': True,
        'add_teacher': False,
        'view_coordinators': True,
        'add_coordinator': False,
        'view_principals': True,
        'add_principal': False,
        # Campus (read-only, lets the lists resolve campus filters)
        'view_campus': True,
        'add_campus': False,
        # Everything operational stays OFF
        'view_attendance': False,
        'mark_attendance': False,
        'approve_attendance': False,
        'view_results': False,
        'approve_results': False,
        'bulk_import_results': False,
        'edit_results': False,
        'view_transfers': False,
        'view_timetable': False,
        'view_requests': False,
        'view_promotions': False,
        'view_subjects': False,
        # Dashboard charts — visible so the donor sees org analytics
        'view_grade_distribution_chart': True,
        'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True,
        'view_religion_chart': True,
        'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True,
        'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': False,
        'view_house_ownership_chart': True,
        'view_network_performance_chart': True,
        # KPIs — visible
        'view_total_students_kpi': True,
        'view_total_teachers_kpi': True,
        'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True,
        # Management — never
        'manage_permissions': False,
        'manage_forms': False,
    },
    'accounts_officer': {
        'view_dashboard': True,
        'view_students': True,
        'view_fees': True,
        'manage_fees': True,
        'view_accounts_dashboard': True,
    },
    'admissions_counselor': {
        'view_dashboard': True,
        'view_students': True,
        'add_student': True,
        'edit_student': True,
        'view_campus': True,
        'view_admissions_dashboard': True,
    },
    'compliance_officer': {
        'view_dashboard': True,
        'view_students': True,
        'view_attendance': True,
        'view_results': True,
        'view_campus': True,
        'view_compliance_dashboard': True,
    },
    'student': {
        'view_dashboard': True,
        'view_student_dashboard': True,
    },
}


class Command(BaseCommand):
    help = 'Seed default RolePermission records for all roles (except superadmin)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Reset all permissions to defaults (WARNING: overwrites existing toggles)',
        )

    def handle(self, *args, **options):
        reset = options.get('reset', False)
        created_count = 0
        updated_count = 0
        skipped_count = 0

        from users.models import Organization, RolePermission
        orgs = list(Organization.all_objects.all())  # all_objects → custom manager bypass karta hai

        self.stdout.write(f"Found {len(orgs)} organization(s) in database.")

        # Agar koi org nahi hai toh org=None ke saath global permissions banao
        targets = orgs if orgs else [None]

        for org in targets:
            org_name = org.name if org else "Global (No Organization)"
            self.stdout.write(f"\nProcessing permissions for: {org_name}")

            for role, permissions in DEFAULT_PERMISSIONS.items():
                for codename, is_allowed in permissions.items():
                    obj, created = RolePermission.objects.get_or_create(
                        organization=org,
                        role=role,
                        permission_codename=codename,
                        defaults={'is_allowed': is_allowed}
                    )
                    if created:
                        created_count += 1
                    elif reset:
                        obj.is_allowed = is_allowed
                        obj.save()
                        updated_count += 1
                    else:
                        skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone! Created: {created_count}, Reset: {updated_count}, Skipped (already exists): {skipped_count}"
        ))
