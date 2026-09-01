from django.db.models.signals import post_save, pre_save, post_delete, m2m_changed
from django.dispatch import receiver
from .models import Teacher
from users.models import User
from services.user_creation_service import UserCreationService
from notifications.services import create_notification

@receiver(pre_save, sender=Teacher)
def _capture_previous_teacher_state(sender, instance, **kwargs):
    """Attach previous user id to instance for use in post_save."""
    if not instance.pk:
        instance._previous_user_id = None
        return
    try:
        old = Teacher.objects.filter(pk=instance.pk).only('user').first()
        instance._previous_user_id = old.user_id if old and old.user_id else None
    except Exception:
        instance._previous_user_id = None

@receiver(post_save, sender=Teacher)
def create_teacher_user(sender, instance, created, **kwargs):
    """Auto-create user when teacher is created"""
    try:
        # Get actor from instance (set by viewset/serializer before save)
        actor = getattr(instance, '_actor', None)
        
        if created:
            # Check if user already exists
            if User.objects.filter(email=instance.email).exists():
                existing_user = User.objects.filter(email=instance.email).first()
                # Link user to teacher
                Teacher.objects.filter(pk=instance.pk).update(user=existing_user)
                
                # Send notification
                campus_name = instance.current_campus.campus_name if instance.current_campus else ''
                verb = "You have been added as a Teacher"
                target_text = f"at {campus_name}" if campus_name else ""
                create_notification(recipient=existing_user, actor=actor, verb=verb, target_text=target_text, data={"teacher_id": instance.id})
            else:
                # Create new user
                user, message = UserCreationService.create_user_from_entity(instance, 'teacher')
                if not user:
                    print(f"[ERROR] Failed to create user for teacher {instance.id}: {message}")
                else:
                    # Link user to teacher
                    Teacher.objects.filter(pk=instance.pk).update(user=user)
                    
                    # Send notification
                    campus_name = instance.current_campus.campus_name if instance.current_campus else ''
                    verb = "You have been added as a Teacher"
                    target_text = f"at {campus_name}" if campus_name else ""
                    create_notification(recipient=user, actor=actor, verb=verb, target_text=target_text, data={"teacher_id": instance.id})
            return

        # Handle update notification for user assignment
        prev_user_id = getattr(instance, '_previous_user_id', None)
        current_user = instance.user
        current_user_id = current_user.id if current_user else None

        if current_user_id and current_user_id != prev_user_id:
            campus_name = instance.current_campus.campus_name if instance.current_campus else ''
            verb = "You have been assigned as a Teacher"
            target_text = f"at {campus_name}" if campus_name else ""
            create_notification(recipient=current_user, actor=actor, verb=verb, target_text=target_text, data={"teacher_id": instance.id})

    except Exception as e:
        print(f"[ERROR] Error in create_teacher_user signal: {str(e)}")

@receiver(post_save, sender=Teacher)
def sync_teacher_to_user(sender, instance, created, **kwargs):
    """Sync Teacher profile changes back to the associated User account."""
    if created:
        return

    try:
        user = instance.user
        if not user and instance.employee_code:
            user = User.objects.filter(username=instance.employee_code).first()
        if not user and instance.email:
            user = User.objects.filter(email=instance.email).first()

        if user:
            changed = False
            # 1. Sync Email
            if user.email != instance.email:
                if not User.objects.exclude(pk=user.pk).filter(email=instance.email).exists():
                    user.email = instance.email
                    changed = True

            # 2. Sync Name
            if instance.full_name:
                name_parts = instance.full_name.strip().split(' ', 1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else ""
                
                if user.first_name != first_name or user.last_name != last_name:
                    user.first_name = first_name
                    user.last_name = last_name
                    changed = True

            # 3. Sync Campus
            if instance.current_campus and user.campus_id != instance.current_campus.id:
                user.campus = instance.current_campus
                changed = True

            if changed:
                user.save(update_fields=['email', 'first_name', 'last_name', 'campus'])
                
            # Ensure link exists
            if not instance.user:
                Teacher.objects.filter(pk=instance.pk).update(user=user)
    except Exception as e:
        print(f"[ERROR] Failed to sync teacher to user: {str(e)}")

@receiver(post_delete, sender=Teacher)
def delete_user_when_teacher_deleted(sender, instance, **kwargs):
    """Cleanup user when teacher is deleted"""
    try:
        if instance.user:
            instance.user.delete()
        elif instance.email:
            User.objects.filter(email__iexact=instance.email).delete()
    except Exception as e:
        print(f"[ERROR] Error deleting teacher user: {str(e)}")

@receiver(m2m_changed, sender=Teacher.assigned_classrooms.through)
def teacher_assigned_classrooms_changed(sender, instance, action, **kwargs):
    """Recalculate is_class_teacher when assigned classrooms change"""
    if action in ['post_add', 'post_remove', 'post_clear']:
        has_classes = instance.assigned_classroom_id is not None or instance.assigned_classrooms.exists() or (hasattr(instance, 'classroom_set') and instance.classroom_set.exists())
        if bool(instance.is_class_teacher) != has_classes:
            Teacher.objects.filter(pk=instance.pk).update(is_class_teacher=has_classes)
            instance.is_class_teacher = has_classes
