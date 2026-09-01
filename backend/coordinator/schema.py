import graphene
from graphene_django import DjangoObjectType
from .models import Coordinator

class CoordinatorType(DjangoObjectType):
    class Meta:
        model = Coordinator
        fields = "__all__"

class Query(graphene.ObjectType):
    all_coordinators = graphene.List(CoordinatorType)
    
    def resolve_all_coordinators(self, info):
        return Coordinator.objects.all()

class Mutation(graphene.ObjectType):
    pass