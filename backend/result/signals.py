from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import Result
from notifications.models import Notification
from users.models import User
from coordinator.models import Coordinator
import logging

logger = logging.getLogger(__name__)

@receiver(pre_save, sender=Result)
def track_result_status_change(sender, instance, **kwargs):
    """
    Track status changes to trigger notifications.
    Stores the old status on the instance temporarily.
    """
    if instance.pk:
        try:
            old_instance = Result.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
        except Result.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None

@receiver(post_save, sender=Result)
def result_notifications(sender, instance, created, **kwargs):
    """
    Handle notifications for Result status changes.
    1. Teacher -> Coordinator (Submitted)
    2. Coordinator -> Teacher (Approved/Rejected)
    """
    old_status = getattr(instance, '_old_status', None)
    new_status = instance.status

    # If just created and status is submitted, or status changed to submitted
    is_submitted = new_status == 'submitted' and (created or old_status != 'submitted')
    
    # If status changed to approved
    is_approved = new_status == 'approved' and old_status != 'approved'
    
    # If status changed to rejected (optional, but professional to have)
    is_rejected = new_status == 'rejected' and old_status != 'rejected'

    if is_submitted:
        handle_submission_notification(instance)
    
    if is_approved:
        handle_approval_notification(instance)
        
    if is_rejected:
        handle_rejection_notification(instance)

def handle_submission_notification(instance):
    """
    Notify relevant Coordinator(s) when a result is submitted by a Teacher.
    """
    try:
        # Identify the Teacher (Actor)
        actor_user = instance.teacher.user if instance.teacher else None
        
        # Identify Recipients (Coordinators)
        recipients = set()
        
        # 1. If a specific coordinator is already assigned to the result
        if instance.coordinator:
            # Resolve User from Coordinator (by employee_code or email)
            # Coordinator model doesn't have direct FK to user usually, usually keyed by employee_code
            coord_user = User.objects.filter(username=instance.coordinator.employee_code).first()
            if not coord_user and instance.coordinator.email:
                coord_user = User.objects.filter(email=instance.coordinator.email).first()
            
            if coord_user:
                recipients.add(coord_user)
        
        # 2. If no coordinator found (or fallback), find by Student's Level/Campus
        if not recipients:
            student = instance.student
            if student and student.current_grade and student.current_grade.level:
                level = student.current_grade.level
                campus = student.campus # Assuming student has campus or grade->level->campus
                
                # Find active coordinators for this level and campus
                # Filter by shift if applicable? Usually coordinators handle specific levels
                relevant_coordinators = Coordinator.objects.filter(
                    campus=campus,
                    is_currently_active=True
                ).filter(
                    # Direct assignment or 'both' shift/multi-assignment logic
                    # Simplified: Check if level matches
                    level=level
                ) | Coordinator.objects.filter(
                    campus=campus,
                    is_currently_active=True,
                    assigned_levels=level # For 'both' shift coordinators dealing with multiple levels
                )
                
                for coord in relevant_coordinators.distinct():
                    u = User.objects.filter(username=coord.employee_code).first()
                    if u:
                        recipients.add(u)
        
        # Send Notifications
        for recipient in recipients:
            # Don't notify the actor if they are somehow the coordinator (unlikely but possible in testing)
            if recipient == actor_user:
                continue
                
            Notification.objects.create(
                recipient=recipient,
                actor=actor_user,
                verb='result_submitted',
                target_text=f"Result Submission: {instance.student.name} ({instance.get_exam_type_display()})",
                data={
                    'result_id': instance.id,
                    'student_name': instance.student.name,
                    'exam_type': instance.exam_type,
                    'status': 'submitted',
                    'message': f"{instance.teacher.full_name} has submitted result for {instance.student.name}."
                }
            )
            logger.info(f"Notification sent to coordinator {recipient} for result {instance.id}")

    except Exception as e:
        logger.error(f"Error sending submission notification: {e}")

def handle_approval_notification(instance):
    """
    Notify Teacher when result is Approved by Coordinator.
    """
    try:
        # Recipient: The Teacher
        recipient_user = instance.teacher.user if instance.teacher else None
        if not recipient_user:
            return

        # Actor: The Coordinator (whoever is assigned or current user context - strictly we only know instance.coordinator)
        actor_user = None
        if instance.coordinator:
            actor_user = User.objects.filter(username=instance.coordinator.employee_code).first()
        
        Notification.objects.create(
            recipient=recipient_user,
            actor=actor_user,
            verb='result_approved',
            target_text=f"Result Approved: {instance.student.name}",
            data={
                'result_id': instance.id,
                'student_name': instance.student.name,
                'exam_type': instance.exam_type,
                'status': 'approved',
                'message': f"Result for {instance.student.name} has been approved."
            }
        )
        logger.info(f"Notification sent to teacher {recipient_user} for result approval {instance.id}")

    except Exception as e:
        logger.error(f"Error sending approval notification: {e}")

def handle_rejection_notification(instance):
    """
    Notify Teacher when result is Rejected.
    """
    try:
        recipient_user = instance.teacher.user if instance.teacher else None
        if not recipient_user:
            return

        actor_user = None
        if instance.coordinator:
            actor_user = User.objects.filter(username=instance.coordinator.employee_code).first()

        Notification.objects.create(
            recipient=recipient_user,
            actor=actor_user,
            verb='result_rejected',
            target_text=f"Result Returned/Rejected: {instance.student.name}",
            data={
                'result_id': instance.id,
                'student_name': instance.student.name,
                'exam_type': instance.exam_type,
                'status': 'rejected',
                'message': f"Result for {instance.student.name} was returned/rejected. Please review remarks.",
                'remarks': instance.coordinator_comments
            }
        )
    except Exception as e:
        logger.error(f"Error sending rejection notification: {e}")
