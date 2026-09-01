import os
from django.core.management.base import BaseCommand
from django.db import transaction
from django.apps import apps
from django.contrib.auth import get_user_model
from django.utils import timezone
from users.models import Organization, SubscriptionPlan, RolePermission

User = get_user_model()

class Command(BaseCommand):
    help = 'Migrate legacy data to a multi-tenant system by linking existing records to a default organization.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--org-name',
            type=str,
            default='Idara Al Khair',
            help='Name of the primary organization'
        )
        parser.add_argument(
            '--subdomain',
            type=str,
            default='iak',
            help='Subdomain for the primary organization'
        )
        parser.add_argument(
            '--sys-admin-email',
            type=str,
            default='sysadmin@iak.ngo',
            help='Email for the new global system administrator'
        )

    def handle(self, *args, **options):
        org_name = options['org_name']
        subdomain = options['subdomain']
        sys_admin_email = options['sys_admin_email']

        self.stdout.write(self.style.MIGRATE_HEADING(f'Starting migration to multi-tenant for organization: {org_name}'))

        with transaction.atomic():
            # 1. Ensure Subscription Plans exist
            enterprise_plan, _ = SubscriptionPlan.objects.get_or_create(
                name='Enterprise',
                defaults={
                    'max_students': 999999,
                    'max_users': 500,
                    'max_campuses': 100,
                    'description': 'Migration default enterprise plan',
                    'is_enterprise': True
                }
            )

            # 2. Create/Get the Organization
            org, created = Organization.objects.get_or_create(
                name=org_name,
                defaults={
                    'subdomain': subdomain,
                    'plan': enterprise_plan,
                    'max_users': 500,
                    'max_students': 10000,
                    'max_campuses': 100,
                    'is_active': True,
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created organization: {org_name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Using existing organization: {org_name}'))
                if not org.plan:
                    org.plan = enterprise_plan
                    org.save()

            # 3. Create a Global System Admin (SysAdmin) if not exists
            # This user is NOT linked to any organization (Global SuperAdmin)
            if not User.objects.filter(email=sys_admin_email).exists():
                sys_user = User.objects.create_superuser(
                    username='S-SYSTEM-ADMIN',
                    email=sys_admin_email,
                    password='Admin123!@#', # Should be changed immediately
                    role='superadmin',
                    organization=None # Global
                )
                self.stdout.write(self.style.SUCCESS(f'Created Global System Admin: {sys_admin_email} (User: S-SYSTEM-ADMIN)'))
            else:
                sys_user = User.objects.get(email=sys_admin_email)
                self.stdout.write(self.style.WARNING(f'Global System Admin {sys_admin_email} already exists.'))

            # 4. Identify models with "organization" field
            all_models = apps.get_models()
            models_to_migrate = []
            
            for model in all_models:
                if any(field.name == 'organization' for field in model._meta.fields):
                    models_to_migrate.append(model)

            self.stdout.write(f'Found {len(models_to_migrate)} models with organization field.')

            # 5. Bulk Link Records (Update organization__isnull=True)
            for model in models_to_migrate:
                # We exclude Organization itself from this link check to avoid circularity if it somehow had a link to itself
                if model == Organization:
                    continue
                    
                count = model.objects.filter(organization__isnull=True).update(organization=org)
                if count > 0:
                    self.stdout.write(f'  - Linked {count} records in {model._meta.app_label}.{model.__name__}')

            # 6. Special Handling for Users
            # Existing SuperAdmins (Legacy) should become Org Admins of the new organization
            # Except for the newly created system admin
            legacy_supers = User.objects.filter(
                role='superadmin', 
                is_superuser=True
            ).exclude(email=sys_admin_email)
            
            for user in legacy_supers:
                user.role = 'org_admin'
                user.organization = org
                # We can keep is_superuser=True if they were Django superusers, 
                # but role-based logic will now treat them as Org Admins of IAK.
                user.save()
                self.stdout.write(self.style.SUCCESS(f'  - Transitioned legacy superadmin {user.username} ({user.email}) to Org Admin of {org_name}'))

            # Ensure all users are linked to the organization
            user_count = User.objects.filter(organization__isnull=True).exclude(email=sys_admin_email).update(organization=org)
            if user_count > 0:
                self.stdout.write(f'  - Linked {user_count} other orphaned users to {org_name}')

            # 7. Seed Permissions for the Organization
            self.stdout.write('Seeding permissions for the organization...')
            from users.management.commands.seed_permissions import DEFAULT_PERMISSIONS
            
            perm_created = 0
            perm_skipped = 0
            
            for role, permissions in DEFAULT_PERMISSIONS.items():
                for codename, is_allowed in permissions.items():
                    obj, created = RolePermission.objects.get_or_create(
                        organization=org,
                        role=role,
                        permission_codename=codename,
                        defaults={'is_allowed': is_allowed}
                    )
                    if created:
                        perm_created += 1
                    else:
                        perm_skipped += 1
            
            self.stdout.write(f'  - Permissions: Created {perm_created}, Existing {perm_skipped}')

            # 8. Check for Campus orphaned data
            # (Already handled by step 5, but good to verify important ones)
            # Some models might need auto-id generation or cleanup if they were created in a broken state
            
        self.stdout.write(self.style.SUCCESS('\nMigration Completed Successfully!'))
        self.stdout.write(self.style.WARNING('IMPORTANT: Please verify the Global System Admin credentials and change the password.'))
        self.stdout.write(self.style.WARNING(f'All existing data is now isolated under organization: {org_name}'))
