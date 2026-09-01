import graphene
from graphene_django import DjangoObjectType
from .models import ClassRoom, Grade, Level
from students.models import Student

class StudentBasicType(graphene.ObjectType):
    """Basic student information for classroom"""
    id = graphene.Int()
    name = graphene.String()
    student_code = graphene.String()
    gr_no = graphene.String()
    photo = graphene.String()
    gender = graphene.String()

class ClassRoomType(DjangoObjectType):
    students = graphene.List(StudentBasicType)
    
    class Meta:
        model = ClassRoom
        fields = "__all__"
    
    def resolve_students(self, info):
        """Get all students in this classroom"""
        students = Student.objects.filter(classroom=self, is_deleted=False)
        return [
            {
                'id': s.id,
                'name': s.name,
                'student_code': s.student_code,
                'gr_no': s.gr_no,
                'photo': info.context.build_absolute_uri(s.photo.url) if s.photo else None,
                'gender': s.gender
            }
            for s in students
        ]

class GradeType(DjangoObjectType):
    class Meta:
        model = Grade
        fields = "__all__"

class LevelType(DjangoObjectType):
    class Meta:
        model = Level
        fields = "__all__"

class Query(graphene.ObjectType):
    all_classrooms = graphene.List(ClassRoomType)
    all_grades = graphene.List(GradeType)
    all_levels = graphene.List(LevelType)
    
    def resolve_all_classrooms(self, info):
        return ClassRoom.objects.all()
    
    def resolve_all_grades(self, info):
        return Grade.objects.all()
    
    def resolve_all_levels(self, info):
        return Level.objects.all()

class Mutation(graphene.ObjectType):
    pass

