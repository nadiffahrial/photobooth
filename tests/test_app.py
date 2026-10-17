import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image

import app as photobooth
import db


class PhotoboothTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        upload_dir = Path(self.temp_dir.name) / "photos"
        upload_dir.mkdir(parents=True, exist_ok=True)
        db_path = Path(self.temp_dir.name) / "test_photobooth.db"
        db.init_db(db_path, upload_dir)

        self.app = photobooth.app
        self.app.config.update(
            TESTING=True,
            UPLOAD_DIR=upload_dir,
            DATABASE_PATH=db_path,
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    def test_unauthenticated_redirects_to_login(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login", response.headers["Location"])

    def test_guest_mode_access(self):
        response = self.client.get("/guest", follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Snap Studio", response.data)

    def test_user_registration_and_login(self):
        # Registrasi
        reg_response = self.client.post(
            "/register",
            data={
                "username": "tester",
                "display_name": "Tester User",
                "password": "password123",
                "password_confirm": "password123",
            },
            follow_redirects=True,
        )
        self.assertEqual(reg_response.status_code, 200)
        self.assertIn(b"Tester User", reg_response.data)

        # Logout
        logout_resp = self.client.get("/logout", follow_redirects=True)
        self.assertEqual(logout_resp.status_code, 200)
        self.assertIn(b"Selamat Datang", logout_resp.data)

        # Login dengan password salah
        bad_login = self.client.post(
            "/login",
            data={"username": "tester", "password": "wrongpassword"},
            follow_redirects=True,
        )
        self.assertIn(b"salah", bad_login.data)

        # Login dengan password benar
        good_login = self.client.post(
            "/login",
            data={"username": "tester", "password": "password123"},
            follow_redirects=True,
        )
        self.assertEqual(good_login.status_code, 200)
        self.assertIn(b"Tester User", good_login.data)

    def test_save_and_list_photo(self):
        # Masuk sebagai tamu untuk upload
        self.client.get("/guest")

        image = io.BytesIO()
        Image.new("RGB", (80, 60), color="#e95d3f").save(image, format="PNG")
        image.seek(0)

        response = self.client.post(
            "/api/photos",
            data={"photo": (image, "capture.png")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertTrue(result["success"])
        self.assertTrue((self.app.config["UPLOAD_DIR"] / result["name"]).is_file())

        list_response = self.client.get("/api/photos")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.get_json()["photos"]), 1)

    def test_photo_isolation_between_users(self):
        # User 1
        self.client.post(
            "/register",
            data={"username": "user1", "password": "password123", "password_confirm": "password123"},
        )
        img1 = io.BytesIO()
        Image.new("RGB", (50, 50), color="#ff0000").save(img1, format="PNG")
        img1.seek(0)
        res1 = self.client.post("/api/photos", data={"photo": (img1, "p1.png")}, content_type="multipart/form-data")
        self.assertEqual(res1.status_code, 201)
        self.assertEqual(len(self.client.get("/api/photos").get_json()["photos"]), 1)

        # User 2
        self.client.get("/logout")
        self.client.post(
            "/register",
            data={"username": "user2", "password": "password123", "password_confirm": "password123"},
        )
        # User 2 harus memiliki galeri kosong
        self.assertEqual(len(self.client.get("/api/photos").get_json()["photos"]), 0)

    def test_rejects_invalid_image(self):
        self.client.get("/guest")
        response = self.client.post(
            "/api/photos",
            data={"photo": (io.BytesIO(b"not an image"), "broken.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("tidak dapat diproses", response.get_json()["error"])

    def test_delete_photo(self):
        self.client.get("/guest")
        img = io.BytesIO()
        Image.new("RGB", (20, 20), color="#ffffff").save(img, format="PNG")
        img.seek(0)
        upload_res = self.client.post("/api/photos", data={"photo": (img, "p.png")}, content_type="multipart/form-data")
        filename = upload_res.get_json()["name"]

        response = self.client.delete(f"/api/photos/{filename}")
        self.assertEqual(response.status_code, 200)
        self.assertFalse((self.app.config["UPLOAD_DIR"] / filename).exists())

    def test_rejects_path_traversal(self):
        self.client.get("/guest")
        response = self.client.delete("/api/photos/../secret.png")
        self.assertEqual(response.status_code, 404)

    def test_ai_pose_endpoint(self):
        response = self.client.get("/api/ai/pose")
        self.assertEqual(response.status_code, 200)
        self.assertIn("pose", response.get_json())
        self.assertTrue(len(response.get_json()["pose"]) > 5)

    def test_admin_access_allowed_for_admin(self):
        # Default admin otomatis terbuat: admin / admin123
        self.client.post("/login", data={"username": "admin", "password": "admin123"}, follow_redirects=True)
        response = self.client.get("/admin")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Panel Kendali Admin", response.data)

    def test_admin_access_denied_for_regular_user(self):
        self.client.post(
            "/register",
            data={"username": "regular", "password": "password123", "password_confirm": "password123"},
            follow_redirects=True,
        )
        response = self.client.get("/admin", follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Akses ditolak", response.data)

    def test_admin_can_manage_user_and_roles(self):
        # Login admin
        self.client.post("/login", data={"username": "admin", "password": "admin123"}, follow_redirects=True)

        # Buat user lain lewat db langsung
        target_user = db.create_user(self.app.config["DATABASE_PATH"], "testuser", "password123", role="user")

        # Ganti role testuser menjadi admin
        role_resp = self.client.post(
            f"/admin/users/{target_user['id']}/role",
            data={"role": "admin"},
            follow_redirects=True,
        )
        self.assertEqual(role_resp.status_code, 200)
        updated_user = db.get_user_by_id(self.app.config["DATABASE_PATH"], target_user["id"])
        self.assertEqual(updated_user["role"], "admin")

        # Hapus testuser
        del_resp = self.client.post(f"/admin/users/{target_user['id']}/delete", follow_redirects=True)
        self.assertEqual(del_resp.status_code, 200)
        self.assertIsNone(db.get_user_by_id(self.app.config["DATABASE_PATH"], target_user["id"]))

    def test_security_headers_present(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.headers.get("X-Frame-Options"), "SAMEORIGIN")
        self.assertIn("Content-Security-Policy", response.headers)

    def test_xss_sanitization_in_display_name(self):
        user = db.create_user(
            self.app.config["DATABASE_PATH"],
            username="safename",
            password="password123",
            display_name="<script>alert('xss')</script>Jessica",
        )
        self.assertNotIn("<script>", user["display_name"])
        self.assertNotIn("</script>", user["display_name"])
        self.assertIn("Jessica", user["display_name"])

    def test_password_length_limits(self):
        # Terlalu panjang (>128 chars)
        with self.assertRaises(ValueError):
            db.create_user(
                self.app.config["DATABASE_PATH"],
                username="longpass",
                password="a" * 129,
            )

    def test_change_password(self):
        self.client.post(
            "/register",
            data={"username": "changeme", "password": "password123", "password_confirm": "password123"},
        )
        # Ganti password dengan password lama yang benar
        resp = self.client.post(
            "/api/auth/change-password",
            json={"current_password": "password123", "new_password": "newpassword456"},
        )
        self.assertEqual(resp.status_code, 200)

        # Logout dan login dengan password baru
        self.client.get("/logout")
        new_login = self.client.post(
            "/login",
            data={"username": "changeme", "password": "newpassword456"},
            follow_redirects=True,
        )
        self.assertEqual(new_login.status_code, 200)

    def test_api_auth_me_login_logout(self):
        # Register via JSON
        reg = self.client.post(
            "/api/auth/register",
            json={"username": "apitester", "password": "password123", "display_name": "API Tester"},
        )
        self.assertEqual(reg.status_code, 201)
        self.assertEqual(reg.get_json()["user"]["username"], "apitester")

        # Check /api/auth/me
        me = self.client.get("/api/auth/me")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.get_json()["user"]["username"], "apitester")

        # Logout via JSON
        logout = self.client.post("/api/auth/logout")
        self.assertEqual(logout.status_code, 200)

        # Me after logout
        me_after = self.client.get("/api/auth/me")
        self.assertIsNone(me_after.get_json()["user"])

        # Login via JSON
        login = self.client.post("/api/auth/login", json={"username": "apitester", "password": "password123"})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.get_json()["user"]["username"], "apitester")

    def test_api_admin_users_and_role(self):
        # Login admin
        self.client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})

        # Get users list via JSON
        resp = self.client.get("/api/admin/users")
        self.assertEqual(resp.status_code, 200)
        users = resp.get_json()["users"]
        self.assertTrue(any(u["username"] == "admin" for u in users))

    def test_unauthorized_photo_delete_prevented(self):
        # User 1 registers and uploads photo
        self.client.post(
            "/api/auth/register",
            json={"username": "photouser", "password": "password123"},
        )
        img = io.BytesIO()
        Image.new("RGB", (20, 20), color="#123456").save(img, format="PNG")
        img.seek(0)
        upload_res = self.client.post("/api/photos", data={"photo": (img, "p.png")}, content_type="multipart/form-data")
        self.assertEqual(upload_res.status_code, 201)
        res_json = upload_res.get_json()
        self.assertIn("photo", res_json)
        self.assertEqual(res_json["photo"]["name"], res_json["name"])
        filename = res_json["name"]

        # Logout
        self.client.post("/api/auth/logout")

        # Attempt to delete without authentication (should be 403 Forbidden)
        del_attempt = self.client.delete(f"/api/photos/{filename}")
        self.assertEqual(del_attempt.status_code, 403)
        self.assertTrue((self.app.config["UPLOAD_DIR"] / filename).is_file())


if __name__ == "__main__":
    unittest.main()
