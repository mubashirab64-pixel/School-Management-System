import graphene
from graphene_django import DjangoObjectType
from .models import Teacher

class TeacherType(DjangoObjectType):
    class Meta:
        model = Teacher
        fields = "__all__"

class Query(graphene.ObjectType):
    all_teachers = graphene.List(TeacherType)
    
    def resolve_all_teachers(self, info):
        return Teacher.objects.all()

class Mutation(graphene.ObjectType):
    pass


