from django.db import models, transaction
from campus.models import Campus
from teachers.models import Teacher
from coordinator.models import Coordinator
from principals.models import Principal


class IDGenerator:
    @staticmethod
    def get_shift_code(shift):
        """Convert shift to code"""
        shift_map = {
            'morning': 'M',
            'afternoon': 'A', 
            'both': 'B',       
            'all': 'ALL'        
        }
        return shift_map.get(shift.lower(), 'M')

    @staticmethod
    def get_role_code(role):
        """Convert role to code"""
        role_map = {
            'teacher': 'T',
            'coordinator': 'C',
            'principal': 'P',
            'superadmin': 'S',
            'admin': 'AD',
            'org_admin': 'OA',
            'accounts_officer': 'AO',
            'admissions_counselor': 'AC',
            'compliance_officer': 'CO'
        }
        return role_map.get(role.lower(), 'T')
    
    @staticmethod
    def get_campus_code_from_id(campus_id):
        """Convert campus ID to campus code format"""
        try:
            campus = Campus._base_manager.get(id=campus_id)
            return campus.campus_code
        except Campus.DoesNotExist:
            return f"C{campus_id:02d}"  
    
    @staticmethod
    def generate_employee_code(campus_code_or_id, shift, year, role, entity_id):
        """Generate employee code: C06-M-25-P-0001
        
        campus_code_or_id can be either a campus_code string (e.g. 'C06')
        or a campus integer ID (legacy, will do DB lookup).
        """
        if isinstance(campus_code_or_id, str):
            campus_code = campus_code_or_id
        else:
            campus_code = IDGenerator.get_campus_code_from_id(campus_code_or_id)
        shift_code = IDGenerator.get_shift_code(shift)
        role_code = IDGenerator.get_role_code(role)
        year_short = str(year)[-2:]  # Last 2 digits of year
        
        return f"{campus_code}-{shift_code}-{year_short}-{role_code}-{entity_id:04d}"
    
    @staticmethod
    def _extract_suffix_numbers(codes):
        """
        Helper: extract numeric suffix from codes like C01-M-25-P-0001 -> 1.
        Returns a list of integers (may be empty).
        """
        numbers = []
        for code in codes:
            if code and "-" in code:
                try:
                    number_part = code.split("-")[-1]
                    if number_part.isdigit():
                        numbers.append(int(number_part))
                except (ValueError, IndexError):
                    continue
        return numbers

    @staticmethod
    def get_next_employee_number(role, organization=None):
        """
        Get next available employee number for a given ROLE (global, not per campus).

        Requirements:
        - Each role has its own continuous global series:
          * All teachers:    ...T-0001, T-0002, T-0003, ...
          * All coordinators:...C-0001, C-0002, ...
          * All principals:  ...P-0001, P-0002, ...
        - Existing data is respected: on first run we seed the counter from
          the current max suffix for that role, then continue from there.
        """
        from services.models import GlobalCounter

        role = (role or "").lower()
        key = f"employee_{role}"  # e.g. employee_teacher, employee_principal

        with transaction.atomic():
            # Use _base_manager to avoid OrganizationManager which filters by current user's org.
            # If user is superadmin, it returns all orgs' counters, causing get() to return multiple.
            filter_kwargs = {"key": key}
            if organization:
                filter_kwargs["organization"] = organization
            
            counter, created = GlobalCounter._base_manager.select_for_update().get_or_create(
                **filter_kwargs,
                defaults={"value": 0},
            )

            # If this counter is brand new (or still zero), seed it from existing data
            if counter.value == 0:
                if role == "teacher":
                    existing_codes = Teacher.objects.filter(
                        employee_code__isnull=False
                    ).values_list("employee_code", flat=True)
                elif role == "coordinator":
                    existing_codes = Coordinator.objects.filter(
                        employee_code__isnull=False
                    ).values_list("employee_code", flat=True)
                elif role == "principal":
                    existing_codes = Principal.objects.filter(
                        employee_code__isnull=False
                    ).values_list("employee_code", flat=True)
                else:
                    existing_codes = []

                numbers = IDGenerator._extract_suffix_numbers(existing_codes)
                # Seed with current max so next number continues the series
                counter.value = max(numbers) if numbers else 0

            # Increment and return the new value
            counter.value = counter.value + 1
            counter.save(update_fields=["value"])
            return counter.value

    @staticmethod
    def generate_unique_employee_code(campus, shift, year, role):
        """Generate unique employee code with validation"""
        try:
            # Use campus_code directly from the campus object — avoids re-lookup via
            # OrganizationManager which returns empty queryset in management commands
            # (no HTTP request context → get_current_user() returns None).
            campus_code = campus.campus_code
            if not campus_code:
                raise ValueError("Campus code is required")
            
            # Get next available number for this ROLE (global series)
            next_number = IDGenerator.get_next_employee_number(role, organization=campus.organization)
            
            # Generate code — pass campus_code string directly (no DB re-lookup)
            employee_code = IDGenerator.generate_employee_code(campus_code, shift, year, role, next_number)
            
            # Double check uniqueness against all role tables
            if (Teacher.objects.filter(employee_code=employee_code).exists() or
                Coordinator.objects.filter(employee_code=employee_code).exists() or
                Principal.objects.filter(employee_code=employee_code).exists()):
                # If somehow still exists, try next number
                next_number += 1
                employee_code = IDGenerator.generate_employee_code(campus_code, shift, year, role, next_number)
            
            return employee_code
            
        except Exception as e:
            raise ValueError(f"Failed to generate employee code: {str(e)}")

    @staticmethod
    def generate_superadmin_code():
        """Generate super admin employee code without campus dependency"""
        try:
            # Get next super admin number
            next_number = IDGenerator.get_next_superadmin_number()
            
            # Generate code: S-25-0001 (Super Admin - Year - Number)
            year_short = str(2025)[-2:]  # Current year
            employee_code = f"S-{year_short}-{next_number:04d}"
            
            return employee_code
            
        except Exception as e:
            raise ValueError(f"Failed to generate super admin code: {str(e)}")
    
    @staticmethod
    def get_next_superadmin_number():
        """Get next available super admin number"""
        try:
            from users.models import User
            
            # Get all existing super admin codes
            super_admins = User.objects.filter(
                role='superadmin',
                username__startswith='S-'
            ).values_list('username', flat=True)
            
            # Extract numbers from existing codes
            numbers = []
            for code in super_admins:
                if code and '-' in code:
                    try:
                        # Extract last part (number) from code like S-25-0001
                        number_part = code.split('-')[-1]
                        if number_part.isdigit():
                            numbers.append(int(number_part))
                    except (ValueError, IndexError):
                        continue
            
            # Return next available number
            if not numbers:
                return 1
            
            return max(numbers) + 1
            
        except Exception as e:
            print(f"Error getting next super admin number: {str(e)}")
            return 1

    @staticmethod
    def generate_orgadmin_code():
        """Generate organization admin employee code without campus dependency"""
        try:
            # Get next org admin number
            next_number = IDGenerator.get_next_orgadmin_number()
            
            # Generate code: OA-25-0001 (Org Admin - Year - Number)
            year_short = str(2025)[-2:]  # Current year (matching superadmin format)
            employee_code = f"OA-{year_short}-{next_number:04d}"
            
            return employee_code
            
        except Exception as e:
            raise ValueError(f"Failed to generate org admin code: {str(e)}")
    
    @staticmethod
    def get_next_orgadmin_number():
        """Get next available org admin number"""
        try:
            from users.models import User
            
            # Get all existing org admin codes
            org_admins = User.objects.filter(
                role='org_admin',
                username__startswith='OA-'
            ).values_list('username', flat=True)
            
            # Extract numbers from existing codes
            numbers = []
            for code in org_admins:
                if code and '-' in code:
                    try:
                        # Extract last part (number) from code like OA-25-0001
                        number_part = code.split('-')[-1]
                        if number_part.isdigit():
                            numbers.append(int(number_part))
                    except (ValueError, IndexError):
                        continue
            
            # Return next available number
            if not numbers:
                return 1
            
            return max(numbers) + 1
            
        except Exception as e:
            print(f"Error getting next org admin number: {str(e)}")
            return 1

    @staticmethod
    def update_employee_code_role(employee_code: str, new_role: str, new_campus=None, new_shift: str = None) -> str:
        """
        Replace the role segment (and optionally campus/shift) in an existing employee code.

        Examples:
          C01-M-25-T-0012  + 'coordinator'              -> C01-M-25-C-0012
          C01-M-25-C-0012  + 'principal' + campus(C03)  -> C03-M-25-P-0012
          C01-M-25-T-0012  + 'accounts_officer'         -> C01-M-25-AO-0012

        Codes with 5 dash-separated parts (campus-shift-year-role-serial) are
        updated in place.  Codes that don't match the expected format are
        returned unchanged so callers can handle the fallback.
        """
        if not employee_code or not new_role:
            return employee_code

        parts = employee_code.split('-')

        # Standard format: C01-M-25-T-0012  (5 parts)
        # Extended serial:  C01-M-25-AO-0012 (5 parts because AO is one token)
        # We always keep: parts[0]=campus, parts[1]=shift, parts[2]=year,
        #                 parts[-1]=serial, parts[3:-1]=old role code
        if len(parts) < 5:
            return employee_code

        new_role_code = IDGenerator.get_role_code(new_role)

        # Use new campus code if provided, otherwise keep existing
        if new_campus is not None:
            campus = getattr(new_campus, 'campus_code', None) or parts[0]
        else:
            campus = parts[0]

        shift  = new_shift or parts[1]
        year   = parts[2]
        serial = parts[-1]

        return f"{campus}-{shift}-{year}-{new_role_code}-{serial}"

    @staticmethod
    def generate_admin_code():
        """Generate admin employee code"""
        try:
            next_number = IDGenerator.get_next_admin_number()
            year_short = str(2026)[-2:]  # Sync with current system year
            employee_code = f"AD-{year_short}-{next_number:04d}"
            return employee_code
        except Exception as e:
            raise ValueError(f"Failed to generate admin code: {str(e)}")

    @staticmethod
    def get_next_admin_number():
        """Get next available admin number"""
        try:
            from users.models import User
            admin_usernames = User._base_manager.filter(
                role='admin',
                username__startswith='AD-'
            ).values_list('username', flat=True)
            
            numbers = []
            for code in admin_usernames:
                if code and '-' in code:
                    try:
                        number_part = code.split('-')[-1]
                        if number_part.isdigit():
                            numbers.append(int(number_part))
                    except (ValueError, IndexError):
                        continue
            
            return max(numbers) + 1 if numbers else 1
        except Exception as e:
            return 1

    @staticmethod
    def generate_unique_student_code(classroom, year):
        """Generate unique student code for classroom"""
        pass