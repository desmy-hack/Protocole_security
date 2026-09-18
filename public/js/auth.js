const Auth = {
  async login(email, password) {
    const data = await API.post("/api/login", {email, password});
    sessionStorage.setItem("accessToken", data.token);
    return data;
  },
  async register(email, password) {
    return API.post("/api/register", {email, password});
  },
  async me() {
    return API.get("/api/me");
  },
  logout() {
    sessionStorage.removeItem("accessToken");
  }
};
