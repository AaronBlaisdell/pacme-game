# pacme-game
diff --git a/pacme/README.md b/pacme/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..8ce19870078aa6b4129dae68d990bcfd8d7817d3
--- /dev/null
+++ b/pacme/README.md
@@ -0,0 +1,24 @@
+# Pacme
+
+Pacme is a Pacman-style browser game where:
+
+- You control Pacme using arrow keys or WASD.
+- The Pacme avatar is generated from an uploaded face photo.
+- Each ghost can also use uploaded/cropped face photos (friends, family, etc.).
+
+## Run locally
+
+From the repository root:
+
+```bash
+python3 -m http.server 8000
+```
+
+Then open: <http://localhost:8000/pacme/>
+
+## Avatar flow
+
+1. Upload a photo for Pacme (or any ghost slot).
+2. Use zoom and horizontal/vertical sliders to frame the face.
+3. Click **Save avatar**.
+4. Start/restart the game to play with your custom avatars.
