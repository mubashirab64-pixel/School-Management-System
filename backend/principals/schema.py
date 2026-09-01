import graphene
from graphene_django import DjangoObjectType
from .models import Principal

class PrincipalType(DjangoObjectType):
    class Meta:
        model = Principal
        fields = "__all__"

class Query(graphene.ObjectType):
    all_principals = graphene.List(PrincipalType)
    
    def resolve_all_principals(self, info):
        return Principal.objects.all()

class Mutation(graphene.ObjectType):
    pass


