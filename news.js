const FEEDS = [
  {
    name: "KrebsOnSecurity",
    url: "https://krebsonsecurity.com/feed/"
  },
  {
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/"
  },
  {
    name: "Schneier on Security",
    url: "https://www.schneier.com/feed/"
  },
  {
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews"
  }
];

const CACHE_SECONDS = 900;
const MAX_ITEMS_PER_FEED = 12;
const MAX_TOTAL_ITEMS = 40;

function decodeHtml(input = "") {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(block, tagNames) {
  for (const tag of tagNames) {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }

    const selfClosing = block.match(new RegExp(`<${tag}[^>]*href=\"([^\"]+)\"[^>]*/?>`, "i"));
    if (selfClosing?.[1]) {
      return selfClosing[1].trim();
    }
  }

  return "";
}

function parseFeed(xml, sourceName) {
  const blocks = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [])
  ];

  const seenLinks = new Set();
  const items = [];

  for (const block of blocks) {
    const title = pick(block, ["title"]);
    const link = pick(block, ["link"]);
    const publishedAt = pick(block, ["pubDate", "published", "updated"]);
    const summary = pick(block, ["description", "summary", "content"]);

    if (!title || !link || seenLinks.has(link)) {
      continue;
    }

    seenLinks.add(link);

    items.push({
      title,
      link,
      publishedAt,
      summary: summary.slice(0, 220),
      source: sourceName
    });

    if (items.length >= MAX_ITEMS_PER_FEED) {
      break;
    }
  }

  return items;
}

async function fetchFeed(feed) {
  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "CyberPulseTerminal/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    const xml = await response.text();
    return parseFeed(xml, feed.name);
  } catch {
    return [];
  }
}

export async function onRequestGet({ request }) {
  try {
    const cache = caches?.default;
    const cacheKey = new Request(request.url);

    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const chunks = await Promise.all(FEEDS.map(fetchFeed));
    const items = chunks
      .flat()
      .sort((a, b) => {
        const aTs = Date.parse(a.publishedAt || "") || 0;
        const bTs = Date.parse(b.publishedAt || "") || 0;
        return bTs - aTs;
      })
      .slice(0, MAX_TOTAL_ITEMS);

    const body = JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        items
      },
      null,
      2
    );

    const response = new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=${CACHE_SECONDS}`
      }
    });

    response.headers.set("x-sources", String(FEEDS.length));

    if (cache) {
      await cache.put(cacheKey, response.clone());
    }

    return response;
  } catch (error) {
    return new Response(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          items: [],
          error: "news_api_failure",
          message: String(error?.message || error)
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
}
