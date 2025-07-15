document.addEventListener("DOMContentLoaded", function () {
  const shortcodePattern = /^\[Style-(\d+)\/([^\]]+)\/(\d+)\]$/i;
  const cacheTTL = 5 * 60 * 1000;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];

  while (walker.nextNode()) {
    const t = walker.currentNode.nodeValue.trim();
    if (shortcodePattern.test(t)) nodes.push(walker.currentNode);
  }

  nodes.forEach(async node => {
    const [_, style, tag, limitStr] = node.nodeValue.trim().match(shortcodePattern);
    const limit = parseInt(limitStr, 10);
    const blogURL = window.location.origin;
    const label = encodeURIComponent(tag);
    const cacheKey = `sc-${style}-${label}-${limit}`;
    const now = Date.now();

    const wrapper = document.createElement("div");
    wrapper.className = `shortcode-style-${style}`;
    node.parentNode.replaceChild(wrapper, node);

    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const obj = JSON.parse(cached);
      if (now - obj.timestamp < cacheTTL) {
        wrapper.innerHTML = obj.html;
        return;
      }
      sessionStorage.removeItem(cacheKey);
    }

    const url = `${blogURL}/feeds/posts/default/-/${label}?alt=json&max-results=${limit}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const entries = data.feed.entry || [];

      const posts = entries.slice(0, limit).map((e, idx) => {
        const title = e.title?.$t || "Không có tiêu đề";
        const author = e.author?.[0]?.name?.$t || "Không rõ tác giả";
        const date = new Date(e.published?.$t || "").toLocaleDateString();
        const link = e.link.find(l => l.rel === "alternate")?.href || "#";
        const comments = e["thr$total"]?.$t || 0;

        const contentHTML = e.content?.$t || e.summary?.$t || "";
        const text = contentHTML.replace(/<[^>]+>/g, "");
        const summary = text.length > 160 ? text.substring(0, 157) + "..." : text;

        let thumb = "";
        const m1 = contentHTML.match(/<img[^>]+src="([^">]+)"/i);
        const m2 = contentHTML.match(/youtube\.com\/embed\/([A-Za-z0-9_-]+)/i);
        const m3 = contentHTML.match(/player\.vimeo\.com\/video\/(\d+)/i);
        if (m1) {
          thumb = m1[1].replace(/\/s\d+(-c)?\//, "/s1600/");
        } else if (m2) {
          thumb = `https://i.ytimg.com/vi/${m2[1]}/maxresdefault.jpg`;
        } else if (m3) {
          thumb = `https://via.placeholder.com/640x360?text=Vimeo+${m3[1]}`;
        } else {
          thumb = `https://via.placeholder.com/640x360?text=No+Image`;
        }

        let tagHTML = "";
        if (Array.isArray(e.category) && e.category.length > 0) {
          const firstTag = e.category[0].term;
          tagHTML = `<a href="${blogURL}/search/label/${encodeURIComponent(firstTag)}" class="sc-tag">${firstTag}</a>`;
        }

        return { idx, title, author, date, link, comments, summary, thumb, tagHTML };
      });

      let html = "";

      if (style === "1") {
        // Style-1: danh sách đơn giản
        html = posts.map(post => `
          <div class="sc-post" style="display:flex;gap:12px;margin-bottom:20px;">
            <img src="${post.thumb}" loading="lazy" class="sc-thumb${post.idx === 0 ? ' sc-thumb-large' : ''}" alt="thumb">
            <div class="sc-content">
              <div class="sc-tags">${post.tagHTML}</div>
              <h3><a href="${post.link}">${post.title}</a></h3>
              <small>${post.author} – ${post.date} • ${post.comments} bình luận</small>
              <p>${post.summary}</p>
            </div>
          </div>
        `).join("");
      }

      else if (style === "2") {
        const first = posts[0];
        const others = posts.slice(1, 5);

        const left = `
          <div class="sc2-left">
            <img src="${first.thumb}" class="sc-thumb sc-thumb-large" loading="lazy" alt="thumb" style="width: 300px; height: 200px; object-fit: cover;">
            <div class="sc-content">
              <div class="sc-tags">${first.tagHTML}</div>
              <h3><a href="${first.link}">${first.title}</a></h3>
              <small>${first.author} – ${first.date} • ${first.comments} bình luận</small>
              <p>${first.summary}</p>
            </div>
          </div>`;

        const right = `
          <div class="sc2-right">
            ${others.map(post => `
              <div class="sc2-item">
                <img src="${post.thumb}" class="sc-thumb" loading="lazy" alt="thumb" style="width: 300px; height: 200px; object-fit: cover;">
                <div class="sc-content">
                  <h4><a href="${post.link}">${post.title}</a></h4>
                  <small>${post.date} • ${post.comments} bình luận</small>
                  <p>${post.summary}</p>
                </div>
              </div>
            `).join("")}
          </div>`;

        html = `<div class="sc2-wrapper">${left}${right}</div>`;
      }

      wrapper.innerHTML = html;
      sessionStorage.setItem(cacheKey, JSON.stringify({ html, timestamp: now }));

    } catch (err) {
      wrapper.innerHTML = "<p>Không thể tải bài viết.</p>";
      console.error(err);
    }
  });
});
