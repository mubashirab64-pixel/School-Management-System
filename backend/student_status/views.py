# student_exit/views.py
from django.shortcuts import get_object_or_404, redirect
from django.contrib.auth.decorators import login_required, user_passes_test
from .models import ExitRecord

def is_principal(user):
    return getattr(user, "is_principal", False) or user.is_superuser

@login_required
@user_passes_test(is_principal)
def approve_exit(request, pk):
    rec = get_object_or_404(ExitRecord, pk=pk, approved=False)
    # date_of_effect can be taken from POST or use today
    date_of_effect = request.POST.get("date_of_effect") or None
    rec.mark_approved(request.user, date_of_effect=date_of_effect)
    return redirect("admin:student_exit_exitrecord_changelist")  # or any success page
