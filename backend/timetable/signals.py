import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import ClassTimeTable, TeacherTimeTable

logger = logging.getLogger(__name__)


@receiver(post_save, sender=ClassTimeTable)
def sync_teacher_timetable_on_class_save(sender, instance, **kwargs):
    """When a ClassTimeTable period is saved, mirror it to TeacherTimeTable."""
    if instance.is_break or not instance.teacher_id:
        return

    try:
        TeacherTimeTable._base_manager.update_or_create(
            teacher=instance.teacher,
            day=instance.day,
            start_time=instance.start_time,
            defaults={
                'subject': instance.subject,
                'classroom': instance.classroom,
                'end_time': instance.end_time,
                'is_break': False,
                'organization': instance.organization,
                'created_by': instance.created_by,
            }
        )
    except Exception as e:
        logger.warning(
            "Could not sync TeacherTimeTable for ClassTimeTable %s: %s",
            instance.id, e
        )


@receiver(post_delete, sender=ClassTimeTable)
def sync_teacher_timetable_on_class_delete(sender, instance, **kwargs):
    """When a ClassTimeTable period is deleted, remove the matching TeacherTimeTable entry."""
    if instance.is_break or not instance.teacher_id:
        return

    TeacherTimeTable._base_manager.filter(
        teacher=instance.teacher,
        day=instance.day,
        start_time=instance.start_time,
    ).delete()
