# Phase 1 AI Chat permission matrix.
# "allowed" = set of User.role values that can call this tool.
# "scope"   = how to filter the DB query for each role.
#
# Scope types:
#   self             → sirf apna data (student)
#   assigned_classroom → teacher ke classrooms ke students/attendance
#   assigned_levels  → coordinator ke levels ke classrooms
#   campus           → user ke campus tak limited
#   all              → poori organization (no extra filter)

TOOL_PERMISSIONS: dict[str, dict] = {
    "get_students": {
        "allowed": {"teacher", "coordinator", "principal", "org_admin", "admin"},
        "scope": {
            "teacher": "assigned_classroom",
            "coordinator": "assigned_levels",
            "principal": "campus",
            "org_admin": "all",
            "admin": "all",
        },
    },
    "get_absent_students": {
        "allowed": {"teacher", "coordinator", "principal", "org_admin", "admin"},
        "scope": {
            "teacher": "assigned_classroom",
            "coordinator": "assigned_levels",
            "principal": "campus",
            "org_admin": "all",
            "admin": "all",
        },
    },
    "get_attendance_summary": {
        "allowed": {"teacher", "coordinator", "principal", "org_admin", "admin"},
        "scope": {
            "teacher": "assigned_classroom",
            "coordinator": "assigned_levels",
            "principal": "campus",
            "org_admin": "all",
            "admin": "all",
        },
    },
    "get_teachers": {
        "allowed": {"coordinator", "principal", "org_admin", "admin"},
        "scope": {
            "coordinator": "assigned_levels",
            "principal": "campus",
            "org_admin": "all",
            "admin": "all",
        },
    },
    "get_campus_list": {
        "allowed": {"coordinator", "principal", "org_admin", "admin"},
        "scope": {
            "coordinator": "campus",
            "principal": "campus",
            "org_admin": "all",
            "admin": "all",
        },
    },
    "get_coordinators": {
        "allowed": {"principal", "org_admin", "admin"},
        "scope": {
            "principal": "campus",
            "org_admin": "all",
            "admin": "all",
        },
    },
    "get_results_summary": {
        "allowed": {"coordinator", "principal", "org_admin", "admin"},
        "scope": {
            "coordinator": "assigned_levels",
            "principal": "campus",
            "org_admin": "all",
            "admin": "all",
        },
    },
    "get_transfers": {
        "allowed": {"coordinator", "principal", "org_admin", "admin"},
        "scope": {
            "coordinator": "assigned_levels",
            "principal": "campus",
            "org_admin": "all",
            "admin": "all",
        },
    },
    "get_my_results": {
        "allowed": {"student"},
        "scope": {"student": "self"},
    },
    "get_my_attendance": {
        "allowed": {"student"},
        "scope": {"student": "self"},
    },
}


ROLE_DISPLAY = {
    "superadmin": "Super Admin",
    "admin": "Admin",
    "org_admin": "Organization Admin",
    "principal": "Principal",
    "coordinator": "Coordinator",
    "teacher": "Teacher",
    "student": "Student",
    "accounts_officer": "Accountant",
    "admissions_counselor": "Receptionist",
    "compliance_officer": "Auditor",
    "donor": "Donor",
}
