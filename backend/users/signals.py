from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .models import User, Organization, RolePermission


@receiver(post_delete, sender=User)
def cleanup_role_entities_on_user_delete(sender, instance: User, **kwargs):
    """When an auth user is removed, soft-delete linked role profiles (Teacher/Coordinator/Principal)."""
    from django.utils import timezone
    try:
        from coordinator.models import Coordinator
        qs = Coordinator.objects.none()
        if instance.email:
            qs = Coordinator.objects.filter(email__iexact=instance.email)
        qs |= Coordinator.objects.filter(employee_code=instance.username)
        qs.update(is_deleted=True, deleted_at=timezone.now())
    except Exception:
        pass
    try:
        from principals.models import Principal
        qs = Principal.objects.none()
        if instance.email:
            qs = Principal.objects.filter(email__iexact=instance.email)
        qs |= Principal.objects.filter(employee_code=instance.username)
        qs.update(is_deleted=True, deleted_at=timezone.now())
    except Exception:
        pass
    try:
        from teachers.models import Teacher
        from attendance.models import AuditLog
        teachers_qs = Teacher.objects.none()
        if instance.email:
            teachers_qs = Teacher.objects.filter(email__iexact=instance.email)
        teachers_qs |= Teacher.objects.filter(employee_code=instance.username)
        for teacher in teachers_qs:
            teacher_name = teacher.full_name
            teacher_id = teacher.id
            teacher_org = teacher.organization
            teacher_emp = teacher.employee_code
            Teacher.objects.filter(pk=teacher_id).update(is_deleted=True, deleted_at=timezone.now())
            try:
                AuditLog.objects.create(
                    feature='teacher', action='delete', entity_type='Teacher',
                    entity_id=teacher_id, organization=teacher_org,
                    user=None,
                    changes={'name': teacher_name, 'employee_code': teacher_emp},
                    reason=f'Teacher {teacher_name} deleted via User admin (user: {instance.username})',
                )
            except Exception:
                pass
    except Exception:
        pass


@receiver(post_save, sender=User)
def sync_user_changes_to_profile(sender, instance: User, created, **kwargs):
    """When a User is edited in admin, sync name/email changes back to Teacher/Coordinator/Principal profile."""
    if created:
        return
    try:
        from teachers.models import Teacher
        teacher = Teacher.objects.filter(user=instance).first()
        if not teacher and instance.email:
            teacher = Teacher.objects.filter(email__iexact=instance.email).first()
        if teacher:
            changed = False
            full_name = f"{instance.first_name} {instance.last_name}".strip()
            if full_name and teacher.full_name != full_name:
                teacher.full_name = full_name
                changed = True
            if instance.email and teacher.email != instance.email:
                teacher.email = instance.email
                changed = True
            if changed:
                Teacher.objects.filter(pk=teacher.pk).update(
                    full_name=teacher.full_name,
                    email=teacher.email,
                )
    except Exception:
        pass
    try:
        from coordinator.models import Coordinator
        coord = None
        if instance.email:
            coord = Coordinator.objects.filter(email__iexact=instance.email).first()
        if not coord:
            coord = Coordinator.objects.filter(employee_code=instance.username).first()
        if coord:
            changed = False
            full_name = f"{instance.first_name} {instance.last_name}".strip()
            if full_name and coord.full_name != full_name:
                coord.full_name = full_name
                changed = True
            if instance.email and coord.email != instance.email:
                coord.email = instance.email
                changed = True
            if changed:
                Coordinator.objects.filter(pk=coord.pk).update(
                    full_name=coord.full_name,
                    email=coord.email,
                )
    except Exception:
        pass
    try:
        from principals.models import Principal
        principal = Principal.objects.filter(user=instance).first()
        if not principal and instance.email:
            principal = Principal.objects.filter(email__iexact=instance.email).first()
        if principal:
            changed = False
            full_name = f"{instance.first_name} {instance.last_name}".strip()
            if full_name and principal.full_name != full_name:
                principal.full_name = full_name
                changed = True
            if instance.email and principal.email != instance.email:
                principal.email = instance.email
                changed = True
            if changed:
                Principal.objects.filter(pk=principal.pk).update(
                    full_name=principal.full_name,
                    email=principal.email,
                )
    except Exception:
        pass


@receiver(post_save, sender=Organization)
def seed_default_permissions_for_org(sender, instance, created, **kwargs):
    """
    Jab nai Organization create ho, automatically DEFAULT_PERMISSIONS se
    sab roles ki permissions seed kar do — manually command chalane ki zaroorat nahi.
    """
    if not created:
        return

    # 1. Default features set karo agar empty hain
    if not instance.enabled_features:
        instance.enabled_features = {
            "management": True,
            "students": True,
            "attendance": True,
            "academic": True,
            "analytics": True,
            "administration": True
        }
        instance.save(update_fields=['enabled_features'])

    # 2. DEFAULT_PERMISSIONS se sab roles ki permissions seed karo
    from users.management.commands.seed_permissions import DEFAULT_PERMISSIONS

    for role, permissions in DEFAULT_PERMISSIONS.items():
        for codename, is_allowed in permissions.items():
            RolePermission.objects.get_or_create(
                organization=instance,
                role=role,
                permission_codename=codename,
                defaults={'is_allowed': is_allowed}
            )
