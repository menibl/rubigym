export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetRequest = url.pathname === "/"
      ? new Request(new URL("/index.html", url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    if (response.status !== 404) {
      return response;
    }

    if (url.pathname.includes(".")) {
      return response;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  }
};
