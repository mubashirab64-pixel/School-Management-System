import graphene
from graphene_django import DjangoObjectType
from django.contrib.auth import get_user_model
from attendance.schema import Query as AttendanceQuery, Mutation as AttendanceMutation
from students.schema import Query as StudentQuery, Mutation as StudentMutation
from teachers.schema import Query as TeacherQuery, Mutation as TeacherMutation
from classes.schema import Query as ClassQuery, Mutation as ClassMutation
from campus.schema import Query as CampusQuery, Mutation as CampusMutation
from coordinator.schema import Query as CoordinatorQuery, Mutation as CoordinatorMutation
from principals.schema import Query as PrincipalQuery, Mutation as PrincipalMutation
from users.schema import Query as UserQuery, Mutation as UserMutation
# import graphql_jwt  # Commented out - not compatible with Django 5.0

User = get_user_model()


class Query(
    AttendanceQuery,
    StudentQuery,
    TeacherQuery,
    ClassQuery,
    CampusQuery,
    CoordinatorQuery,
    PrincipalQuery,
    UserQuery,
    graphene.ObjectType
):
    """Root GraphQL Query"""
    pass


class Mutation(
    AttendanceMutation,
    StudentMutation,
    TeacherMutation,
    ClassMutation,
    CampusMutation,
    CoordinatorMutation,
    PrincipalMutation,
    UserMutation,
    graphene.ObjectType
):
    """Root GraphQL Mutation"""
    
    # JWT Authentication mutations (Commented out - not compatible with Django 5.0)
    # token_auth = graphql_jwt.ObtainJSONWebToken.Field()
    # verify_token = graphql_jwt.Verify.Field()
    # refresh_token = graphql_jwt.Refresh.Field()
    # revoke_token = graphql_jwt.Revoke.Field()
    pass


schema = graphene.Schema(query=Query, mutation=Mutation)


