from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Q
from classes.models import ClassRoom, Level
from coordinator.models import Coordinator
@receiver(post_save, sender=ClassRoom)
def update_teacher_coordinator_on_classroom_change(sender, instance, **kwargs):
    """
    When classroom's class_teacher changes, add coordinator to teacher's ManyToMany field
    """
    if instance.class_teacher:
        teacher = instance.class_teacher
        
        # Get coordinator for this classroom's level
        if instance.grade and instance.grade.level:
            coordinator = Coordinator.objects.filter(
                level=instance.grade.level,
                campus=instance.campus,
                is_currently_active=True
            ).first()
            
            if coordinator:
                # Add coordinator (not replace) - use ManyToMany
                if coordinator not in teacher.assigned_coordinators.all():
                    teacher.assigned_coordinators.add(coordinator)
                    print(f"Added coordinator {coordinator.full_name} for level {instance.grade.level.name}")
            else:
                print(f"No coordinator found for {instance.grade.level.name}")

@receiver(post_save, sender=ClassRoom)
def auto_assign_students_to_classroom(sender, instance, created, **kwargs):
    """
    When a classroom is created or updated, automatically pull in matching students
    who are currently unassigned or matching this classroom's criteria.
    """
    from students.models import Student
    
    campus = instance.campus
    if not campus:
        return

    grade_name = instance.grade.name if instance.grade else None
    if not grade_name:
        return
        
    section = instance.section
    shift = instance.shift

    # Normalize grade names for matching
    grade_name_variations = [
        grade_name,
        grade_name.replace('-', ' '),
        grade_name.replace(' ', '-'),
    ]
    
    grade_query = Q()
    for var in grade_name_variations:
        grade_query |= Q(current_grade__icontains=var)

    # Find students who match the criteria but are not in this classroom
    # We prioritize students who have NO classroom assigned yet.
    students_to_assign = Student.objects.filter(
        campus=campus,
        section=section,
        shift=shift,
        is_deleted=False
    ).filter(grade_query).filter(
        Q(classroom__isnull=True)
    )

    count = students_to_assign.count()
    if count > 0:
        # Use update to link them
        students_to_assign.update(classroom=instance)
        print(f"[SIGNAL] Auto-assigned {count} unassigned students to classroom {instance.code}")


@receiver(post_save, sender=Level)
def auto_assign_coordinator_to_level(sender, instance, created, **kwargs):
    """
    When a Level is created, find active coordinators with no level assigned
    in the same campus + matching shift, and assign them.
    """
    if not created:
        return
    if not instance.campus:
        return

    unassigned = Coordinator.objects.filter(
        campus=instance.campus,
        is_currently_active=True,
        is_deleted=False,
    ).filter(
        Q(shift=instance.shift) | Q(shift='both')
    )

    for coordinator in unassigned:
        if coordinator.shift == 'both':
            # Check no levels assigned yet for this campus
            already_assigned = coordinator.assigned_levels.filter(
                campus=instance.campus, shift=instance.shift
            ).exists()
            if not already_assigned:
                coordinator.assigned_levels.add(instance)
                print(f"[SIGNAL] Auto-assigned coordinator {coordinator.full_name} to level {instance.name} (M2M)")
                break
        else:
            if not coordinator.level:
                coordinator.level = instance
                coordinator.save(update_fields=['level'])
                print(f"[SIGNAL] Auto-assigned coordinator {coordinator.full_name} to level {instance.name}")
                break


@receiver(post_save, sender=ClassRoom)
def auto_assign_teacher_to_classroom(sender, instance, created, **kwargs):
    """
    When a ClassRoom is created and has no class_teacher, find a matching
    class teacher (same campus + grade + section + shift, no classroom yet)
    and assign them.
    """
    if not created:
        return
    if instance.class_teacher:
        return

    from teachers.models import Teacher

    campus = instance.campus
    grade_name = instance.grade.name if instance.grade else None
    section = instance.section
    shift = instance.shift

    if not campus or not grade_name or not section:
        return

    grade_name_variations = [
        grade_name,
        grade_name.replace('-', ' '),
        grade_name.replace(' ', '-'),
    ]
    grade_query = Q()
    for var in set(grade_name_variations):
        grade_query |= Q(class_teacher_grade__iexact=var) | Q(class_teacher_grade__icontains=var)

    teacher = Teacher.objects.filter(
        current_campus=campus,
        is_class_teacher=True,
        is_deleted=False,
        class_teacher_section=section,
    ).filter(
        Q(shift=shift) | Q(shift='both')
    ).filter(grade_query).filter(
        assigned_classroom__isnull=True,
    ).exclude(
        assigned_classrooms__isnull=False
    ).first()

    if not teacher:
        # Broader fallback: assigned_classrooms may be empty queryset
        teacher = Teacher.objects.filter(
            current_campus=campus,
            is_class_teacher=True,
            is_deleted=False,
            class_teacher_section=section,
        ).filter(
            Q(shift=shift) | Q(shift='both')
        ).filter(grade_query).filter(
            assigned_classroom__isnull=True,
        ).first()
        if teacher and teacher.assigned_classrooms.exists():
            teacher = None

    if not teacher:
        print(f"[SIGNAL] No unassigned class teacher found for {grade_name}-{section} ({shift}) at {campus}")
        return

    # Use update() to avoid re-triggering post_save signals on ClassRoom
    ClassRoom.objects.filter(pk=instance.pk).update(class_teacher=teacher)
    teacher.assigned_classrooms.add(instance)
    print(f"[SIGNAL] Auto-assigned teacher {teacher.full_name} to classroom {instance.code}")

    # Link coordinator to teacher (same logic as update_teacher_coordinator_on_classroom_change)
    if instance.grade and instance.grade.level:
        coordinator = Coordinator.objects.filter(
            level=instance.grade.level,
            campus=campus,
            is_currently_active=True,
        ).first()
        if coordinator and coordinator not in teacher.assigned_coordinators.all():
            teacher.assigned_coordinators.add(coordinator)
            print(f"[SIGNAL] Linked coordinator {coordinator.full_name} to teacher {teacher.full_name}")