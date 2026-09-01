import graphene
from graphene_django import DjangoObjectType
from .models import Student

class StudentType(DjangoObjectType):
    class Meta:
        model = Student
        fields = "__all__"

class Query(graphene.ObjectType):
    all_students = graphene.List(StudentType)
    
    def resolve_all_students(self, info):
        return Student.objects.all()

class Mutation(graphene.ObjectType):
    pass


