from rest_framework.test import APITestCase

from .models import Branch, Restaurant, Role, User


class PinAuthTests(APITestCase):
    def setUp(self):
        self.r = Restaurant.objects.create(name="Testaurant")
        self.b = Branch.objects.create(restaurant=self.r, name="Main")
        self.manager = self._staff("mgr", Role.MANAGER, "1111")
        self.cashier = self._staff("cash", Role.CASHIER, "3333")
        self.kitchen = self._staff("cook", Role.KITCHEN, "2222")

    def _staff(self, username, role, pin):
        u = User(username=username, role=role, restaurant=self.r, branch=self.b)
        u.set_unusable_password()
        u.set_login_pin(pin)
        u.save()
        return u

    def _pin(self, username, pin, service):
        return self.client.post(
            "/api/auth/pin/",
            {"username": username, "pin": pin, "service": service},
            format="json",
        )

    def test_pin_login_success_returns_jwt_and_services(self):
        res = self._pin("mgr", "1111", "admin")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertEqual(set(res.data["services"]), {"pos", "kds", "admin"})

    def test_wrong_pin_is_401(self):
        self.assertEqual(self._pin("cash", "0000", "pos").status_code, 401)

    def test_role_not_allowed_for_service_is_403(self):
        # Cashier can use POS but not KDS/Admin.
        self.assertEqual(self._pin("cash", "3333", "pos").status_code, 200)
        self.assertEqual(self._pin("cash", "3333", "kds").status_code, 403)
        self.assertEqual(self._pin("cash", "3333", "admin").status_code, 403)
        # Kitchen can use KDS but not POS/Admin.
        self.assertEqual(self._pin("cook", "2222", "kds").status_code, 200)
        self.assertEqual(self._pin("cook", "2222", "admin").status_code, 403)

    def test_inactive_user_cannot_login(self):
        self.cashier.is_active = False
        self.cashier.save()
        self.assertEqual(self._pin("cash", "3333", "pos").status_code, 401)


class UserManagementTests(APITestCase):
    def setUp(self):
        self.r = Restaurant.objects.create(name="Testaurant")
        self.b = Branch.objects.create(restaurant=self.r, name="Main")
        self.admin = User(
            username="boss", role=Role.ADMIN, restaurant=self.r, branch=self.b
        )
        self.admin.set_unusable_password()
        self.admin.set_login_pin("9999")
        self.admin.save()

    def _auth(self, user, pin, service="admin"):
        res = self.client.post(
            "/api/auth/pin/",
            {"username": user.username, "pin": pin, "service": service},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")

    def test_create_autogenerates_pin_and_new_user_can_login(self):
        self._auth(self.admin, "9999")
        res = self.client.post(
            "/api/accounts/users/",
            {"username": "newcash", "role": Role.CASHIER},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        pin = res.data["pin"]
        self.assertRegex(pin, r"^\d{4}$")
        # The freshly minted login works.
        self.client.credentials()  # drop admin token
        login = self.client.post(
            "/api/auth/pin/",
            {"username": "newcash", "pin": pin, "service": "pos"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)

    def test_reset_pin_changes_the_pin(self):
        self._auth(self.admin, "9999")
        created = self.client.post(
            "/api/accounts/users/",
            {"username": "w1", "role": Role.WAITER, "pin": "1234"},
            format="json",
        )
        uid = created.data["id"]
        reset = self.client.post(f"/api/accounts/users/{uid}/reset_pin/", {}, format="json")
        self.assertEqual(reset.status_code, 200)
        new_pin = reset.data["pin"]
        self.client.credentials()
        # Old PIN no longer works; new one does.
        self.assertEqual(
            self.client.post(
                "/api/auth/pin/",
                {"username": "w1", "pin": "1234", "service": "pos"},
                format="json",
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                "/api/auth/pin/",
                {"username": "w1", "pin": new_pin, "service": "pos"},
                format="json",
            ).status_code,
            200,
        )

    def test_non_admin_cannot_manage_users(self):
        cashier = User(
            username="cash", role=Role.CASHIER, restaurant=self.r, branch=self.b
        )
        cashier.set_unusable_password()
        cashier.set_login_pin("3333")
        cashier.save()
        self._auth(cashier, "3333", service="pos")
        self.assertEqual(self.client.get("/api/accounts/users/").status_code, 403)
