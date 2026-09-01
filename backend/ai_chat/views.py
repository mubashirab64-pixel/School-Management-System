import json
import urllib.request
from datetime import date

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import TOOL_PERMISSIONS, ROLE_DISPLAY

GEMINI_MODEL = "gemini-2.5-flash"

ALL_FUNCTION_DECLARATIONS = [
    {
        "name": "get_students",
        "description": "Get list of students with optional filters. Returns total count and student names.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "campus_name": {"type": "STRING", "description": "Campus name e.g. 'Campus 3'"},
                "current_state": {"type": "STRING", "description": "active, inactive, or alumni"},
                "current_grade": {"type": "STRING", "description": "e.g. 'Grade 5', 'KG-I'"},
                "gender": {"type": "STRING", "description": "Male or Female"},
                "added_on": {"type": "STRING", "description": "Filter by admission date (YYYY-MM-DD or 'today'). Use this for 'aaj add hue / naye daakhil' queries."},
                "limit": {"type": "INTEGER", "description": "Max results, default 30"},
            },
        },
    },
    {
        "name": "get_absent_students",
        "description": "Get students who were absent on a date.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "date": {"type": "STRING", "description": "YYYY-MM-DD format, default today"},
                "campus_name": {"type": "STRING", "description": "Campus name or number"},
                "grade": {"type": "STRING", "description": "Filter by grade"},
            },
        },
    },
    {
        "name": "get_attendance_summary",
        "description": "Get attendance statistics for a date.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "date": {"type": "STRING", "description": "YYYY-MM-DD, default today"},
                "campus_name": {"type": "STRING", "description": "Campus name"},
            },
        },
    },
    {
        "name": "get_teachers",
        "description": "Get teachers list with optional filters.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "campus_name": {"type": "STRING", "description": "Campus name"},
                "is_active": {"type": "BOOLEAN", "description": "Active teachers only"},
                "limit": {"type": "INTEGER", "description": "Max results, default 30"},
            },
        },
    },
    {
        "name": "get_campus_list",
        "description": "Get all campuses with student and teacher counts.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "get_coordinators",
        "description": "Get coordinators list for the campus or organization.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "campus_name": {"type": "STRING", "description": "Campus name"},
                "limit": {"type": "INTEGER", "description": "Max results, default 30"},
            },
        },
    },
    {
        "name": "get_results_summary",
        "description": "Get exam results summary: how many students appeared, pass/fail/absent counts and average percentage. Use for 'kitne student ne exam diya', 'pass fail stats', 'results ka overview'.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "exam_type": {"type": "STRING", "description": "monthly, midterm, or final"},
                "academic_year": {"type": "STRING", "description": "e.g. '2024-25'"},
                "campus_name": {"type": "STRING", "description": "Campus name (org_admin/admin only)"},
                "current_grade": {"type": "STRING", "description": "Filter by grade e.g. 'Grade 5'"},
            },
        },
    },
    {
        "name": "get_transfers",
        "description": "Get student transfer records (class transfers, shift transfers, campus transfers). Use for 'kitne transfer hue', 'kis classroom mein transfer', 'transfers ki list'.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "transfer_type": {"type": "STRING", "description": "class, shift, or campus. Omit for all types."},
                "status": {"type": "STRING", "description": "pending, approved, declined, cancelled. Default: all."},
                "campus_name": {"type": "STRING", "description": "Campus name (org_admin/admin only)"},
                "limit": {"type": "INTEGER", "description": "Max results, default 20"},
            },
        },
    },
    {
        "name": "get_my_results",
        "description": "Get the logged-in student's own exam results.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "exam_type": {"type": "STRING", "description": "monthly, midterm, or final"},
                "academic_year": {"type": "STRING", "description": "e.g. '2024-2025'"},
            },
        },
    },
    {
        "name": "get_my_attendance",
        "description": "Get the logged-in student's own attendance summary.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
]

_BEHAVIOR_RULES = """
BEHAVIOR RULES:
- Respond in the SAME language the user writes in: Roman Urdu, Urdu, or English
- ALWAYS call a function first to get real data — never guess or make up numbers
- ONLY call tools that are in your ALLOWED TOOLS list above
- Be concise. Show total count clearly (e.g. "42 students", not "approximately forty-two students")
- "active students" = current_state=active (Alumni excluded)
- Campus by number: "Campus 3" → use campus_name="Campus 3"
- "aaj add hue / naye daakhil / today admitted" → get_students with added_on="today"
- If a tool returns an error or empty data, tell the user clearly
"""

_ROLE_PERMISSION_RULES = {
    "teacher": """
PERMISSION RULES:
- You can only show data for your assigned classroom(s)
- If someone asks about a class you are NOT assigned to, politely say: "Meri assigned class yeh hai: [your class]. Us class ka data mujhe nahi milta."
- Never show other teachers' personal data
- Never show students' parent contact or home address info
- Tone: Professional aur helpful
""",
    "coordinator": """
PERMISSION RULES:
- You can only show data within your assigned levels/campus
- If someone asks about a level or campus outside your assignment, politely decline with your scope
- Do not show data of coordinators or principals
- Tone: Concise aur analytical — numbers aur trends pe focus karo
""",
    "principal": """
PERMISSION RULES:
- You can see ALL data for your campus: students, teachers, coordinators, attendance, results, transfers
- You can see data for ALL roles below you (teachers, coordinators, students) within your campus
- Do not show data from other campuses
- Do not show salary or confidential HR data
- Tone: Executive summary style — key numbers upfront, details on request
""",
    "org_admin": """
PERMISSION RULES:
- You have full access to all campuses in your organization
- Do not expose system-level config or other organizations' data
- Tone: Analytical, data-driven
""",
    "admin": """
PERMISSION RULES:
- You have full access to all campuses in your organization
- Tone: Analytical, data-driven
""",
    "student": """
PERMISSION RULES:
- You can ONLY show THIS student's own data — marks, attendance, timetable
- If the student asks for another student's marks or attendance, firmly but politely decline: "Main sirf aap ka apna data dekh sakta hun."
- Never show class lists, teacher lists, or school-wide stats to students
- Tone: Friendly, encouraging, supportive — e.g. "Aap ne 85% hasil kiye — bohot acha!"
""",
}

_ROLE_QUICK_HINTS = {
    "teacher":    "Quick queries: 'Meri class ke students', 'Aaj absent kon hai', 'Class attendance summary'",
    "coordinator":"Quick queries: 'Mere level ke teachers', 'Aaj absent students', 'Level attendance summary'",
    "principal":  "Quick queries: 'Aaj absent students', 'Aaj add hue students', 'Teachers ki list', 'Coordinators ki list', 'Exam results summary', 'Kitne transfer hue'",
    "org_admin":  "Quick queries: 'Sab campuses ki summary', 'Aaj absent students', 'Active students count'",
    "admin":      "Quick queries: 'Sab campuses ki summary', 'Aaj absent students', 'Teachers ki list'",
    "student":    "Quick queries: 'Mere marks', 'Meri attendance', 'Final term result'",
}


def _build_system_prompt(user, scope: dict, allowed_tools: list, today_str: str) -> str:
    role = scope["role"]
    org = user.organization
    school_name = org.name if org else "School"
    full_name = user.get_full_name() or user.username
    role_display = ROLE_DISPLAY.get(role, role)

    # --- Section 1: Identity ---
    identity = (
        f"Tum AI assistant ho {school_name} ke liye.\n"
        f"Aaj ki tarikh: {today_str}.\n"
        f"Tumhara kaam users ki madad karna hai school data ke baare mein.\n"
    )

    # --- Section 2: Current User Info (role-specific) ---
    user_section = f"\nCURRENT USER:\n- Name: {full_name}\n- Role: {role_display}\n"

    if role == "teacher":
        teacher = getattr(user, "teacher_profile", None)
        if teacher:
            user_section += f"- Campus: {teacher.current_campus.campus_name if teacher.current_campus else 'N/A'}\n"
            if teacher.is_class_teacher and teacher.class_teacher_section:
                user_section += f"- Class Teacher of: {teacher.class_teacher_section}\n"
            elif scope["classroom_ids"]:
                from classes.models import ClassRoom
                classrooms = ClassRoom.objects.filter(
                    id__in=scope["classroom_ids"]
                ).select_related("grade")
                names = [f"{c.grade.name}-{c.section}" for c in classrooms if c.grade]
                if names:
                    user_section += f"- Assigned Classroom(s): {', '.join(names)}\n"
            if teacher.current_subjects:
                user_section += f"- Current Subjects: {teacher.current_subjects}\n"

    elif role == "coordinator":
        from coordinator.models import Coordinator
        coord = Coordinator.get_for_user(user)
        if coord:
            user_section += f"- Campus: {coord.campus.campus_name if coord.campus else 'N/A'}\n"
            user_section += f"- Shift: {coord.shift}\n"
            if scope["level_ids"]:
                from classes.models import Level
                level_names = list(
                    Level.objects.filter(id__in=scope["level_ids"]).values_list("name", flat=True)
                )
                user_section += f"- Managed Levels: {', '.join(level_names)}\n"

    elif role == "principal":
        from principals.models import Principal
        try:
            principal = Principal.objects.filter(user=user).first()
            if principal:
                user_section += f"- Campus: {principal.campus.campus_name if principal.campus else 'N/A'}\n"
                user_section += f"- Access Level: Full campus access\n"
        except Exception:
            if user.campus:
                user_section += f"- Campus: {user.campus.campus_name}\n"

    elif role in ("org_admin", "admin"):
        user_section += "- Access Level: Full organization access (all campuses)\n"

    elif role == "student":
        student = getattr(user, "student_profile", None)
        if student:
            user_section += f"- Grade: {student.current_grade or 'N/A'}\n"
            if student.section:
                user_section += f"- Section: {student.section}\n"
            if student.gr_no:
                user_section += f"- GR No: {student.gr_no}\n"
            if student.campus:
                user_section += f"- Campus: {student.campus.campus_name}\n"

    # --- Section 3: Allowed Tools ---
    tools_section = "\nALLOWED TOOLS:\n"
    for decl in allowed_tools:
        perm = TOOL_PERMISSIONS.get(decl["name"], {})
        scope_type = perm.get("scope", {}).get(role, "all")
        scope_note = {
            "self": "sirf aap ka apna data",
            "assigned_classroom": "sirf aap ki assigned class(es)",
            "assigned_levels": "sirf aap ke managed levels",
            "campus": "sirf aap ka campus",
            "all": "poori organization",
        }.get(scope_type, scope_type)
        tools_section += f"- {decl['name']} ({scope_note})\n"

    # --- Section 4: Role-specific permission rules ---
    permission_rules = _ROLE_PERMISSION_RULES.get(role, "\nPERMISSION RULES:\n- Only show data within your access scope.\n")

    # --- Section 5: Behavior + quick hints ---
    quick_hint = _ROLE_QUICK_HINTS.get(role, "")
    behavior = _BEHAVIOR_RULES
    if quick_hint:
        behavior += f"\n{quick_hint}\n"

    return identity + user_section + tools_section + permission_rules + behavior


def _get_user_scope(user) -> dict:
    role = user.role
    org = user.organization

    scope = {
        "role": role,
        "campus_id": getattr(user, "campus_id", None),
        "classroom_ids": [],
        "level_ids": [],
        "student_id": None,
        "scope_description": "Sab data (poori organization)",
    }

    if role == "teacher":
        teacher = getattr(user, "teacher_profile", None)
        if teacher:
            from classes.models import ClassRoom
            classroom_ids = list(
                ClassRoom.objects.filter(
                    organization=org, class_teacher=teacher
                ).values_list("id", flat=True)
            )
            scope["classroom_ids"] = classroom_ids
            scope["campus_id"] = teacher.current_campus_id
            if classroom_ids:
                classrooms = ClassRoom.objects.filter(id__in=classroom_ids).select_related("grade")
                names = [f"{c.grade.name}-{c.section}" for c in classrooms if c.grade]
                scope["scope_description"] = (
                    f"Assigned classrooms: {', '.join(names)}" if names else "Assigned classroom"
                )
            else:
                scope["scope_description"] = "Koi classroom assign nahi"

    elif role == "coordinator":
        from coordinator.models import Coordinator
        coord = Coordinator.get_for_user(user)
        if coord:
            scope["campus_id"] = coord.campus_id
            level_ids = (
                list(coord.assigned_levels.values_list("id", flat=True))
                if coord.assigned_levels.exists()
                else ([coord.level_id] if coord.level_id else [])
            )
            scope["level_ids"] = level_ids
            campus_name = coord.campus.campus_name if coord.campus else "N/A"
            scope["scope_description"] = f"Campus: {campus_name}, {len(level_ids)} level(s) managed"

    elif role == "principal":
        if user.campus:
            scope["scope_description"] = f"Campus: {user.campus.campus_name}"

    elif role in ("org_admin", "admin"):
        scope["scope_description"] = "Sab campuses (poori organization)"

    elif role == "student":
        student = getattr(user, "student_profile", None)
        if student:
            scope["student_id"] = student.id
            scope["scope_description"] = f"Sirf apna data — Grade: {student.current_grade or 'N/A'}"
        else:
            scope["scope_description"] = "Student profile nahi mila"

    return scope


def _get_allowed_declarations(role: str) -> list:
    return [
        decl for decl in ALL_FUNCTION_DECLARATIONS
        if role in TOOL_PERMISSIONS.get(decl["name"], {}).get("allowed", set())
    ]


def _gemini_call(contents: list, system: str, api_key: str, tools: list | None = None) -> dict:
    import concurrent.futures
    import urllib.error
    import time

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models"
        f"/{GEMINI_MODEL}:generateContent?key={api_key}"
    )
    payload: dict = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": contents,
    }
    if tools:
        payload["tools"] = [{"functionDeclarations": tools}]

    data = json.dumps(payload).encode("utf-8")

    def do_request():
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}, method="POST"
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def do_request_with_retry():
        try:
            return do_request()
        except urllib.error.HTTPError as e:
            if e.code == 503:
                time.sleep(2)
                return do_request()
            if e.code == 429:
                time.sleep(15)
                return do_request()
            raise

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(do_request_with_retry).result(timeout=60)


def _gemini_stream(contents: list, system: str, api_key: str):
    """Generator: yields SSE chunks from Gemini streamGenerateContent endpoint."""
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models"
        f"/{GEMINI_MODEL}:streamGenerateContent?key={api_key}&alt=sse"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": contents,
    }
    data = json.dumps(payload).encode("utf-8")

    try:
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            for raw_line in resp:
                line = raw_line.decode("utf-8").strip()
                if not line.startswith("data: "):
                    continue
                json_str = line[6:]
                try:
                    chunk = json.loads(json_str)
                    parts = (
                        chunk.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [])
                    )
                    for part in parts:
                        if "text" in part and part["text"]:
                            yield f"data: {json.dumps({'chunk': part['text']})}\n\n"
                except (json.JSONDecodeError, IndexError, KeyError):
                    pass
    except urllib.error.HTTPError as e:
        if e.code == 429:
            import time
            time.sleep(15)
            try:
                req2 = urllib.request.Request(
                    url, data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req2, timeout=60) as resp2:
                    for raw_line in resp2:
                        line = raw_line.decode("utf-8").strip()
                        if not line.startswith("data: "):
                            continue
                        try:
                            chunk = json.loads(line[6:])
                            parts = (
                                chunk.get("candidates", [{}])[0]
                                .get("content", {})
                                .get("parts", [])
                            )
                            for part in parts:
                                if "text" in part and part["text"]:
                                    yield f"data: {json.dumps({'chunk': part['text']})}\n\n"
                        except (json.JSONDecodeError, IndexError, KeyError):
                            pass
            except Exception as e2:
                yield f"data: {json.dumps({'error': str(e2)})}\n\n"
        else:
            yield f"data: {json.dumps({'error': f'AI error {e.code}'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

    yield "data: [DONE]\n\n"


def _sse_response(generator):
    """Wrap a generator in a StreamingHttpResponse with correct SSE headers."""
    res = StreamingHttpResponse(generator, content_type="text/event-stream")
    res["Cache-Control"] = "no-cache"
    res["X-Accel-Buffering"] = "no"
    return res


def _resolve_campus(org, campus_name: str | None):
    if not campus_name:
        return None
    from campus.models import Campus
    token = campus_name.replace("Campus", "").replace("campus", "").strip()
    qs = Campus._base_manager.filter(organization=org)
    campus = (
        qs.filter(campus_name__icontains=token).first()
        or qs.filter(campus_code__icontains=token).first()
    )
    return campus.id if campus else None


def _execute_tool(name: str, args: dict, user, scope: dict):
    org = user.organization
    role = scope["role"]
    today_str = str(date.today())

    perm = TOOL_PERMISSIONS.get(name, {})
    if role not in perm.get("allowed", set()):
        return {"error": f"Aap ka role '{role}' is tool ko use karne ki permission nahi deta."}

    scope_type = perm["scope"].get(role, "all")

    if name == "get_campus_list":
        from campus.models import Campus
        from students.models import Student
        from teachers.models import Teacher

        qs = Campus._base_manager.filter(organization=org)
        if scope_type == "campus" and scope["campus_id"]:
            qs = qs.filter(id=scope["campus_id"])

        result = []
        for c in qs.values("id", "campus_name", "campus_code"):
            result.append({
                "id": c["id"],
                "name": c["campus_name"],
                "code": c["campus_code"],
                "students": Student._base_manager.filter(
                    organization=org, campus_id=c["id"], is_active=True
                ).exclude(current_grade__iexact="Alumni").count(),
                "teachers": Teacher._base_manager.filter(
                    organization=org, current_campus_id=c["id"]
                ).count(),
            })
        return {"total_campuses": len(result), "campuses": result}

    if name == "get_students":
        from students.models import Student

        qs = Student._base_manager.filter(organization=org)

        if scope_type == "assigned_classroom":
            if not scope["classroom_ids"]:
                return {"total": 0, "students": [], "note": "Aap ka koi classroom assign nahi hai."}
            qs = qs.filter(classroom_id__in=scope["classroom_ids"])
        elif scope_type == "assigned_levels":
            if not scope["level_ids"]:
                return {"total": 0, "students": [], "note": "Aap ka koi level assign nahi hai."}
            qs = qs.filter(classroom__grade__level_id__in=scope["level_ids"])
        elif scope_type == "campus":
            if scope["campus_id"]:
                qs = qs.filter(campus_id=scope["campus_id"])
        else:
            campus_id = _resolve_campus(org, args.get("campus_name"))
            if campus_id:
                qs = qs.filter(campus_id=campus_id)

        state = args.get("current_state", "active")
        if state == "active":
            qs = qs.filter(is_active=True).exclude(current_grade__iexact="Alumni")
        elif state == "inactive":
            qs = qs.filter(is_active=False)
        elif state == "alumni":
            qs = qs.filter(current_grade__iexact="Alumni")

        if args.get("current_grade"):
            qs = qs.filter(current_grade__icontains=args["current_grade"])
        if args.get("gender"):
            qs = qs.filter(gender=args["gender"])
        if args.get("added_on"):
            added_on = args["added_on"]
            if added_on == "today":
                added_on = today_str
            qs = qs.filter(created_at__date=added_on)

        total = qs.count()
        limit = min(int(args.get("limit", 30)), 100)
        rows = list(
            qs.select_related("campus").values(
                "name", "gr_no", "current_grade", "gender", "campus__campus_name"
            )[:limit]
        )
        return {
            "total": total,
            "showing": len(rows),
            "students": [
                {"name": r["name"], "gr_no": r["gr_no"], "grade": r["current_grade"], "campus": r["campus__campus_name"]}
                for r in rows
            ],
        }

    if name == "get_absent_students":
        from attendance.models import StudentAttendance

        target_date = args.get("date") or today_str
        qs = StudentAttendance._base_manager.filter(
            organization=org, status="absent", attendance__date=target_date
        ).select_related("student", "student__campus")

        if scope_type == "assigned_classroom":
            if not scope["classroom_ids"]:
                return {"total_absent": 0, "students": [], "note": "Aap ka koi classroom assign nahi hai."}
            qs = qs.filter(student__classroom_id__in=scope["classroom_ids"])
        elif scope_type == "assigned_levels":
            if not scope["level_ids"]:
                return {"total_absent": 0, "students": [], "note": "Aap ka koi level assign nahi hai."}
            qs = qs.filter(student__classroom__grade__level_id__in=scope["level_ids"])
        elif scope_type == "campus":
            if scope["campus_id"]:
                qs = qs.filter(student__campus_id=scope["campus_id"])
        else:
            campus_id = _resolve_campus(org, args.get("campus_name"))
            if campus_id:
                qs = qs.filter(student__campus_id=campus_id)

        if args.get("grade"):
            qs = qs.filter(student__current_grade__icontains=args["grade"])

        total = qs.count()
        return {
            "date": target_date,
            "total_absent": total,
            "students": [
                {
                    "name": r.student.name,
                    "gr_no": r.student.gr_no,
                    "grade": r.student.current_grade,
                    "campus": r.student.campus.campus_name if r.student.campus else "—",
                }
                for r in qs[:50]
            ],
        }

    if name == "get_attendance_summary":
        from attendance.models import Attendance

        target_date = args.get("date") or today_str
        qs = Attendance._base_manager.filter(organization=org, date=target_date)

        if scope_type == "assigned_classroom":
            if not scope["classroom_ids"]:
                return {"date": target_date, "total_students": 0, "present": 0, "absent": 0, "attendance_percentage": 0}
            qs = qs.filter(classroom_id__in=scope["classroom_ids"])
        elif scope_type == "assigned_levels":
            if not scope["level_ids"]:
                return {"date": target_date, "total_students": 0, "present": 0, "absent": 0, "attendance_percentage": 0}
            qs = qs.filter(classroom__grade__level_id__in=scope["level_ids"])
        elif scope_type == "campus":
            if scope["campus_id"]:
                qs = qs.filter(classroom__campus_id=scope["campus_id"])
        else:
            campus_id = _resolve_campus(org, args.get("campus_name"))
            if campus_id:
                qs = qs.filter(classroom__campus_id=campus_id)

        total_s = sum(a.total_students for a in qs)
        total_p = sum(a.present_count for a in qs)
        total_a = sum(a.absent_count for a in qs)
        return {
            "date": target_date,
            "total_students": total_s,
            "present": total_p,
            "absent": total_a,
            "attendance_percentage": round(total_p / total_s * 100, 1) if total_s else 0,
        }

    if name == "get_teachers":
        from teachers.models import Teacher

        qs = Teacher._base_manager.filter(organization=org)

        if scope_type == "assigned_levels":
            if not scope["level_ids"]:
                return {"total": 0, "teachers": [], "note": "Aap ka koi level assign nahi hai."}
            from classes.models import ClassRoom
            teacher_ids = list(
                ClassRoom.objects.filter(
                    grade__level_id__in=scope["level_ids"]
                ).values_list("class_teacher_id", flat=True).distinct()
            )
            qs = qs.filter(id__in=teacher_ids)
        elif scope_type == "campus":
            if scope["campus_id"]:
                qs = qs.filter(current_campus_id=scope["campus_id"])
        else:
            campus_id = _resolve_campus(org, args.get("campus_name"))
            if campus_id:
                qs = qs.filter(current_campus_id=campus_id)

        if args.get("is_active") is not None:
            qs = qs.filter(is_currently_active=args["is_active"])

        total = qs.count()
        limit = min(int(args.get("limit", 30)), 100)
        rows = list(
            qs.select_related("current_campus").values(
                "full_name", "employee_code", "current_campus__campus_name", "shift"
            )[:limit]
        )
        return {
            "total": total,
            "showing": len(rows),
            "teachers": [
                {"name": r["full_name"], "code": r["employee_code"], "campus": r["current_campus__campus_name"], "shift": r["shift"]}
                for r in rows
            ],
        }

    if name == "get_coordinators":
        from coordinator.models import Coordinator

        qs = Coordinator._base_manager.filter(organization=org, is_deleted=False)

        if scope_type == "campus":
            if scope["campus_id"]:
                qs = qs.filter(campus_id=scope["campus_id"])
        else:
            campus_id = _resolve_campus(org, args.get("campus_name"))
            if campus_id:
                qs = qs.filter(campus_id=campus_id)

        total = qs.count()
        limit = min(int(args.get("limit", 30)), 100)
        rows = list(
            qs.select_related("campus").values(
                "full_name", "employee_code", "campus__campus_name", "shift", "is_currently_active"
            )[:limit]
        )
        return {
            "total": total,
            "showing": len(rows),
            "coordinators": [
                {
                    "name": r["full_name"],
                    "code": r["employee_code"],
                    "campus": r["campus__campus_name"],
                    "shift": r["shift"],
                    "active": r["is_currently_active"],
                }
                for r in rows
            ],
        }

    if name == "get_results_summary":
        from result.models import Result

        qs = Result._base_manager.filter(organization=org, is_deleted=False)

        if scope_type == "assigned_levels":
            if not scope["level_ids"]:
                return {"error": "Aap ka koi level assign nahi hai."}
            qs = qs.filter(student__classroom__grade__level_id__in=scope["level_ids"])
        elif scope_type == "campus":
            if scope["campus_id"]:
                qs = qs.filter(student__campus_id=scope["campus_id"])
        else:
            campus_id = _resolve_campus(org, args.get("campus_name"))
            if campus_id:
                qs = qs.filter(student__campus_id=campus_id)

        if args.get("exam_type"):
            qs = qs.filter(exam_type=args["exam_type"])
        if args.get("academic_year"):
            qs = qs.filter(academic_year=args["academic_year"])
        if args.get("current_grade"):
            qs = qs.filter(student__current_grade__icontains=args["current_grade"])

        total = qs.count()
        appeared = qs.filter(is_absent=False).count()
        passed = qs.filter(pass_status="pass").count()
        failed = qs.filter(pass_status="fail").count()
        absent = qs.filter(pass_status="absent").count()

        avg_pct = 0.0
        if appeared > 0:
            from django.db.models import Avg
            avg_pct = round(
                qs.filter(is_absent=False).aggregate(avg=Avg("percentage"))["avg"] or 0, 1
            )

        return {
            "total_results": total,
            "appeared": appeared,
            "passed": passed,
            "failed": failed,
            "absent_in_exam": absent,
            "average_percentage": avg_pct,
            "pass_rate": f"{round(passed / appeared * 100, 1)}%" if appeared else "N/A",
        }

    if name == "get_transfers":
        from transfers.models import ClassTransfer, ShiftTransfer, CampusTransfer

        transfer_type = (args.get("transfer_type") or "").lower()
        status_filter = (args.get("status") or "").lower()
        limit = min(int(args.get("limit", 20)), 100)

        results = []

        def apply_campus_scope(qs_model, campus_field):
            qs = qs_model._base_manager.filter(organization=org)
            if scope_type == "assigned_levels":
                qs = qs.filter(student__classroom__grade__level_id__in=scope["level_ids"])
            elif scope_type == "campus":
                if scope["campus_id"]:
                    qs = qs.filter(**{campus_field: scope["campus_id"]})
            else:
                campus_id = _resolve_campus(org, args.get("campus_name"))
                if campus_id:
                    qs = qs.filter(**{campus_field: campus_id})
            if status_filter:
                qs = qs.filter(status__icontains=status_filter)
            return qs

        if not transfer_type or transfer_type == "class":
            qs = apply_campus_scope(ClassTransfer, "student__campus_id")
            for t in qs.select_related("student", "from_classroom", "to_classroom")[:limit]:
                results.append({
                    "type": "Class Transfer",
                    "student": t.student.name if t.student else "—",
                    "from": f"{t.from_grade_name or ''}-{t.from_section or ''}".strip("-"),
                    "to": f"{t.to_grade_name or ''}-{t.to_section or ''}".strip("-"),
                    "status": t.status,
                    "date": str(t.requested_date),
                })

        if not transfer_type or transfer_type == "shift":
            qs = apply_campus_scope(ShiftTransfer, "campus_id")
            for t in qs.select_related("student")[:limit]:
                results.append({
                    "type": "Shift Transfer",
                    "student": t.student.name if t.student else "—",
                    "from": t.from_shift,
                    "to": t.to_shift,
                    "status": t.status,
                    "date": str(t.requested_date),
                })

        if not transfer_type or transfer_type == "campus":
            qs = apply_campus_scope(CampusTransfer, "from_campus_id")
            for t in qs.select_related("student", "from_campus", "to_campus")[:limit]:
                results.append({
                    "type": "Campus Transfer",
                    "student": t.student.name if t.student else "—",
                    "from": t.from_campus.campus_name if t.from_campus else "—",
                    "to": t.to_campus.campus_name if t.to_campus else "—",
                    "status": t.status,
                    "date": str(t.requested_date),
                })

        results = results[:limit]
        return {
            "total_shown": len(results),
            "transfers": results,
        }

    if name == "get_my_results":
        from result.models import Result

        student_id = scope.get("student_id")
        if not student_id:
            return {"error": "Student profile nahi mila."}

        qs = Result._base_manager.filter(student_id=student_id, organization=org)
        if args.get("exam_type"):
            qs = qs.filter(exam_type=args["exam_type"])
        if args.get("academic_year"):
            qs = qs.filter(academic_year=args["academic_year"])

        results = [
            {
                "exam_type": r.exam_type,
                "academic_year": r.academic_year,
                "percentage": round(float(r.percentage), 1),
                "grade": r.grade,
                "pass_status": r.pass_status,
                "obtained_marks": r.obtained_marks,
                "total_marks": r.total_marks,
            }
            for r in qs.order_by("-academic_year")[:10]
        ]
        return {"total": len(results), "results": results}

    if name == "get_my_attendance":
        from attendance.models import StudentAttendance

        student_id = scope.get("student_id")
        if not student_id:
            return {"error": "Student profile nahi mila."}

        qs = StudentAttendance._base_manager.filter(
            student_id=student_id, organization=org
        ).select_related("attendance")

        total = qs.count()
        present = qs.filter(status="present").count()
        absent = qs.filter(status="absent").count()
        recent = [
            {"date": str(r.attendance.date), "status": r.status}
            for r in qs.order_by("-attendance__date")[:30]
        ]
        return {
            "total_days": total,
            "present": present,
            "absent": absent,
            "attendance_percentage": round(present / total * 100, 1) if total else 0,
            "recent_records": recent,
        }

    return {"error": f"Unknown tool: {name}"}


USER_DAILY_LIMIT = 50
ORG_DAILY_LIMIT  = 500


def _check_rate_limit(user):
    """
    Returns (allowed: bool, error_message: str | None).
    Uses Django cache with a 24-hour rolling window per user and per org.
    If cache backend is unavailable, fails open (allows the request).
    """
    try:
        from django.core.cache import cache

        user_key  = f"ai_chat:user:{user.id}"
        org_key   = f"ai_chat:org:{user.organization_id}"

        user_count = cache.get(user_key, 0)
        if user_count >= USER_DAILY_LIMIT:
            return False, f"Aap ne aaj ke {USER_DAILY_LIMIT} messages use kar liye hain. Kal dobara try karein."

        org_limit = getattr(user.organization, "ai_message_limit", None) or ORG_DAILY_LIMIT
        org_count = cache.get(org_key, 0)
        if org_count >= org_limit:
            return False, "Aap ke school ka aaj ka AI quota khatam ho gaya hai."

        cache.set(user_key, user_count + 1, timeout=86400)
        cache.set(org_key,  org_count  + 1, timeout=86400)
        return True, None
    except Exception:
        # Cache unavailable (Redis down etc.) — allow request, skip rate limiting
        return True, None


class AIChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import Conversation, ConversationMessage

        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"error": "Message cannot be empty"}, status=400)

        api_key = getattr(settings, "GEMINI_API_KEY", None)
        if not api_key:
            return Response({"error": "AI service not configured"}, status=500)

        user = request.user
        role = user.role

        # Rate limit check before any Gemini call
        allowed, limit_msg = _check_rate_limit(user)
        if not allowed:
            return Response({"error": "rate_limit", "message": limit_msg}, status=429)

        if role in ("superadmin", "donor", "accounts_officer", "admissions_counselor", "compliance_officer"):
            def _blocked():
                yield f"data: {json.dumps({'chunk': 'Aap ke role ke liye AI chat available nahi hai.'})}\n\n"
                yield "data: [DONE]\n\n"
            return _sse_response(_blocked())

        scope = _get_user_scope(user)
        allowed_tools = _get_allowed_declarations(role)

        if not allowed_tools:
            def _no_tools():
                yield f"data: {json.dumps({'chunk': 'Aap ke role ke liye koi data query available nahi hai.'})}\n\n"
                yield "data: [DONE]\n\n"
            return _sse_response(_no_tools())

        # --- Conversation memory ---
        conv_id = request.data.get("conversation_id")
        if conv_id:
            conversation = Conversation.objects.filter(
                id=conv_id, user=user, organization=user.organization
            ).first()
            if not conversation:
                conversation = Conversation.objects.create(user=user, organization=user.organization)
        else:
            conversation = Conversation.objects.create(user=user, organization=user.organization)

        # Build contents from last 10 message pairs (20 rows = 10 user + 10 assistant)
        history = list(conversation.messages.order_by("-created_at")[:20])
        history.reverse()

        today_str = str(date.today())
        system = _build_system_prompt(user, scope, allowed_tools, today_str)

        contents = []
        for msg in history:
            contents.append({
                "role": "user" if msg.role == "user" else "model",
                "parts": [{"text": msg.content}],
            })
        contents.append({"role": "user", "parts": [{"text": message}]})

        # Save user message + auto-title from first message
        ConversationMessage.objects.create(
            conversation=conversation, role="user", content=message
        )
        if not conversation.title:
            conversation.title = message[:60].strip()
            conversation.save(update_fields=["title", "updated_at"])

        # Round 1: non-streaming — detect function calls
        try:
            result1 = _gemini_call(contents, system, api_key, allowed_tools)
        except Exception as e:
            err_msg = str(e)
            if "503" in err_msg:
                err_msg = "AI service abhi busy hai. Thodi der baad dobara koshish karein."
            def _err():
                yield f"data: {json.dumps({'error': err_msg})}\n\n"
                yield "data: [DONE]\n\n"
            return _sse_response(_err())

        candidate = result1.get("candidates", [{}])[0]
        parts = candidate.get("content", {}).get("parts", [])
        fn_calls = [p["functionCall"] for p in parts if "functionCall" in p]

        if fn_calls:
            contents.append({"role": "model", "parts": parts})
            fn_responses = []
            for fc in fn_calls:
                tool_result = _execute_tool(fc["name"], fc.get("args", {}), user, scope)
                fn_responses.append({
                    "functionResponse": {
                        "name": fc["name"],
                        "response": {"result": tool_result},
                    }
                })
            contents.append({"role": "user", "parts": fn_responses})
            stream_gen = _gemini_stream(contents, system, api_key)
        else:
            text = " ".join(p.get("text", "") for p in parts if "text" in p) or "Jawab nahi mila."
            def _plain():
                yield f"data: {json.dumps({'chunk': text})}\n\n"
                yield "data: [DONE]\n\n"
            stream_gen = _plain()

        conv_id_str = str(conversation.id)

        def _stream_and_save():
            reply_parts = []
            for chunk in stream_gen:
                yield chunk
                # Collect text chunks to save as assistant message
                if chunk.startswith("data: ") and not chunk.strip().endswith("[DONE]"):
                    try:
                        data = json.loads(chunk[6:])
                        if "chunk" in data:
                            reply_parts.append(data["chunk"])
                    except (json.JSONDecodeError, KeyError):
                        pass
            # Yield conversation_id so frontend can store it
            yield f"data: {json.dumps({'conversation_id': conv_id_str})}\n\n"
            # Save assistant reply to DB
            if reply_parts:
                ConversationMessage.objects.create(
                    conversation=conversation,
                    role="assistant",
                    content="".join(reply_parts),
                )

        return _sse_response(_stream_and_save())


class AIChatConversationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Conversation
        convs = Conversation.objects.filter(
            user=request.user, organization=request.user.organization
        ).order_by("-updated_at")[:30]
        return Response([
            {
                "id": str(c.id),
                "title": c.title or "New Chat",
                "updated_at": c.updated_at.isoformat(),
            }
            for c in convs
        ])


class AIChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Conversation

        conv_id = request.query_params.get("conversation_id")
        user = request.user

        if conv_id:
            conversation = Conversation.objects.filter(
                id=conv_id, user=user, organization=user.organization
            ).first()
        else:
            # Most recent conversation for this user
            conversation = Conversation.objects.filter(
                user=user, organization=user.organization
            ).first()

        if not conversation:
            return Response({"messages": [], "conversation_id": None})

        messages = [
            {"role": m.role, "content": m.content}
            for m in conversation.messages.order_by("created_at")
        ]
        return Response({
            "conversation_id": str(conversation.id),
            "messages": messages,
        })
