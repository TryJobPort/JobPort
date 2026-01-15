// api/utils/fetchPageHtml.js

async function fetchPageHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const contentType = res.headers.get("content-type") || "";
    const html = await res.text();

    return {
      ok: res.ok,
      status: res.status,
      contentType,
      html,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchPageHtml };
