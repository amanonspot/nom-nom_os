from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    AddOnViewSet,
    CategoryViewSet,
    MenuItemViewSet,
    VariationGroupViewSet,
    VariationOptionViewSet,
    menu_tree,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("items", MenuItemViewSet, basename="menuitem")
router.register("addons", AddOnViewSet, basename="addon")
router.register("variation-groups", VariationGroupViewSet, basename="variationgroup")
router.register("variation-options", VariationOptionViewSet, basename="variationoption")

urlpatterns = [
    path("menu/", menu_tree, name="menu-tree"),
    *router.urls,
]
