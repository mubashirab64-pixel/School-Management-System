from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from users.models import User, Organization
from campus.models import Campus
from utils.id_generator import IDGenerator
from services.models import GlobalCounter
import getpass

class Command(BaseCommand):
    help = 'Interactively create a new user (Teacher, Coordinator, Principal, Superadmin, Org Admin, Donor)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("=== Interactive User Creation ==="))
        
        # 1. Get First Name
        first_name = input("Enter First Name: ").strip()
        while not first_name:
            self.stdout.write(self.style.ERROR("First name is required."))
            first_name = input("Enter First Name: ").strip()

        # 2. Get Last Name
        last_name = input("Enter Last Name (optional): ").strip()

        # 3. Choose Role
        roles = {
            '1': 'superadmin',
            '2': 'admin',
            '3': 'org_admin',
            '4': 'principal',
            '5': 'coordinator',
            '6': 'teacher',
            '7': 'donor',
            '8': 'accounts_officer',
            '9': 'admissions_counselor',
            '10': 'compliance_officer'
        }
        self.stdout.write("\nSelect Role:")
        self.stdout.write("1: Super Admin")
        self.stdout.write("2: Admin")
        self.stdout.write("3: Organization Admin")
        self.stdout.write("4: Principal")
        self.stdout.write("5: Teacher Coordinator")
        self.stdout.write("6: Teacher")
        self.stdout.write("7: Donor")
        self.stdout.write("8: Accounts Officer")
        self.stdout.write("9: Admissions Counselor")
        self.stdout.write("10: Compliance Officer")
        
        role_choice = input("Enter choice (1-10): ").strip()
        while role_choice not in roles:
            self.stdout.write(self.style.ERROR("Invalid choice. Please enter 1-10."))
            role_choice = input("Enter choice (1-10): ").strip()
            
        role = roles[role_choice]

        # 4. Get Email
        email = input("Enter Email: ").strip()
        while not email or User.objects.filter(email=email).exists():
            if not email:
                self.stdout.write(self.style.ERROR("Email is required."))
            else:
                self.stdout.write(self.style.ERROR("Email already exists. Try another."))
            email = input("Enter Email: ").strip()

        # 5. Choose Organization (mandatory for role-specific users, skipped for system-level roles)
        # NOTE: We must use `all_objects` (the unfiltered manager). `Organization.objects`
        # is the tenant-aware OrganizationManager which filters by the *currently logged-in
        # user*. In a management command there is no request/user context, so `.objects`
        # returns an EMPTY queryset even when organizations exist — which previously caused
        # this command to wrongly believe "no organizations found" and create a throwaway
        # "Default Organization", attaching every user (e.g. donors) to empty data.
        organization = None
        if role not in ['superadmin', 'admin']:
            orgs = list(Organization.all_objects.all().order_by('name'))
            if not orgs:
                self.stdout.write(self.style.ERROR(
                    "No organizations exist in the database. "
                    "Create an organization first (via the SuperAdmin → Organizations page) "
                    "and then re-run this command so the user can be linked to it."
                ))
                return
            self.stdout.write("\nSelect Organization:")
            for i, org in enumerate(orgs, 1):
                subdomain = f" [{org.subdomain}]" if org.subdomain else ""
                self.stdout.write(f"{i}: {org.name}{subdomain}")

            org_choice = input(f"Enter choice (1-{len(orgs)}): ").strip()
            while not org_choice.isdigit() or not (1 <= int(org_choice) <= len(orgs)):
                self.stdout.write(self.style.ERROR(f"Invalid choice. Enter 1-{len(orgs)}."))
                org_choice = input(f"Enter choice (1-{len(orgs)}): ").strip()
            organization = orgs[int(org_choice) - 1]

        # 6. Choose Campus (if needed)
        campus = None
        if role in ['principal', 'coordinator', 'teacher', 'accounts_officer', 'admissions_counselor', 'compliance_officer']:
            # Using _base_manager because the default manager filters by current user context (which is None here)
            campuses = list(Campus._base_manager.all())
            if organization:
                campuses = [c for c in campuses if c.organization_id == organization.id]

            if not campuses:
                self.stdout.write(self.style.WARNING("No campuses found for this organization."))
                return
                
            self.stdout.write("\nSelect Campus:")
            for i, c in enumerate(campuses, 1):
                self.stdout.write(f"{i}: {c.campus_name} ({c.campus_code})")
                
            campus_choice = input(f"Enter choice (1-{len(campuses)}): ").strip()
            while not campus_choice.isdigit() or not (1 <= int(campus_choice) <= len(campuses)):
                self.stdout.write(self.style.ERROR(f"Invalid choice. Enter 1-{len(campuses)}."))
                campus_choice = input(f"Enter choice (1-{len(campuses)}): ").strip()
                
            campus = campuses[int(campus_choice) - 1]

        # 7. Generate Employee/Donor Code
        self.stdout.write("\nGenerating code...")
        username = ""
        current_year_short = str(timezone.now().year)[-2:]
        
        try:
            with transaction.atomic():
                if role == 'superadmin':
                    username = IDGenerator.generate_superadmin_code()
                elif role == 'admin':
                    username = IDGenerator.generate_admin_code()
                elif role == 'org_admin':
                    username = IDGenerator.generate_orgadmin_code()
                elif role == 'donor':
                    # Custom donor code generation: D-[YEAR]-XXXX
                    key = "employee_donor"
                    counter, _ = GlobalCounter.objects.select_for_update().get_or_create(
                        key=key, defaults={"value": 0}
                    )
                    counter.value += 1
                    counter.save(update_fields=["value"])
                    username = f"D-{current_year_short}-{counter.value:04d}"
                else:
                    # Generic employee generation logic (Teacher/Coord/Principal)
                    username = IDGenerator.generate_unique_employee_code(campus, 'Morning', timezone.now().year, role)
                    
            self.stdout.write(self.style.SUCCESS(f"Generated Code: {username}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error generating code: {str(e)}"))
            return

        # 8. Get Password
        password = getpass.getpass("Enter Password: ")
        while len(password) < 6:
            self.stdout.write(self.style.ERROR("Password must be at least 6 characters."))
            password = getpass.getpass("Enter Password: ")
            
        confirm_password = getpass.getpass("Confirm Password: ")
        while password != confirm_password:
            self.stdout.write(self.style.ERROR("Passwords do not match."))
            password = getpass.getpass("Enter Password: ")
            confirm_password = getpass.getpass("Confirm Password: ")

        # 9. Create User
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    campus=campus,
                    organization=organization,
                    is_verified=True,
                    has_changed_default_password=True
                )
            
            self.stdout.write(self.style.SUCCESS("\n" + "="*40))
            self.stdout.write(self.style.SUCCESS("User created successfully!"))
            self.stdout.write(self.style.SUCCESS(f"Name:  {first_name} {last_name}"))
            self.stdout.write(self.style.SUCCESS(f"Email: {email}"))
            self.stdout.write(self.style.SUCCESS(f"Org:   {organization.name if organization else 'N/A'}"))
            self.stdout.write(self.style.SUCCESS(f"Role:  {user.get_role_display()}"))
            self.stdout.write(self.style.SUCCESS(f"Code:  {username}"))
            self.stdout.write(self.style.SUCCESS("="*40 + "\n"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to create user: {str(e)}"))
