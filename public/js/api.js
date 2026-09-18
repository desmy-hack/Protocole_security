const API = {
  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = sessionStorage.getItem("accessToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(path, {...options, headers});
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data.error || `Erreur HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  },
  get(path) { return this.request(path); },
  post(path, body) {
    return this.request(path, {method:"POST", body: body instanceof FormData ? body : JSON.stringify(body)});
  }
};
