import graphene
from graphene_django import DjangoObjectType
from .models import Campus

class CampusType(DjangoObjectType):
    class Meta:
        model = Campus
        fields = "__all__"

class Query(graphene.ObjectType):
    all_campuses = graphene.List(CampusType)
    
    def resolve_all_campuses(self, info):
        return Campus.objects.all()

class Mutation(graphene.ObjectType):
    pass


