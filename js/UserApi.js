import { showToast} from "./fortecho.js";
// ------------------------
// UserApi.js
// ------------------------
export const UserApi = {
  // =========================
  // GET /api/user
  // =========================
  async getUser() {
    try {
      const res = await fetch("/api/user");
      if (!res.ok) {
        console.error("Error fetching user:", res.status);
        return null;
      }
      const data = await res.json();
      //console.log("User fetched:", data);
      return data;
    } catch (err) {
      //console.error("Fetch error:", err);
      return null;
    }
  },

  // =========================
  // POST /api/user
  // =========================
  async createUser(newUser) {
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (res.status === 201) {
        const data = await res.json();
        //console.log("User created:", data);
        return data;
      } else if (res.status === 409) {
        ///console.warn("User already exists");
        return null;
      } else {
        //console.error("Error creating user:", res.status);
        return null;
      }
    } catch (err) {
      //console.error("Fetch error:", err);
      return null;
    }
  },

  // =========================
  // PUT /api/user
  // =========================
  async replaceUser(updatedUser) {
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedUser),
      });

      if (!res.ok) {
        console.error("Error replacing user:", res.status);
        return null;
      }

      const data = await res.json();
      //console.log("User replaced:", data);
      return data;
    } catch (err) {
      //console.error("Fetch error:", err);
      return null;
    }
  },

  // =========================
  // PATCH /api/user
  // =========================
  async patchUser(patchData, showSuccessToast = true) {
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });

      if (res.ok) {
        if (showSuccessToast) {
          showToast("User patched successfully", "success", 3000, "top-right");
        }
        return true;
      } else {
        showToast("Error patching user: " + res.status, "error", 3000, "top-right");
        return false;
      }
    } catch (err) {
      showToast("Fetch error: " + err, "error", 3000, "top-right");
      return false;
    }
  },
};