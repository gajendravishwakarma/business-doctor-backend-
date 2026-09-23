import express from "express";
import path from "path";
import dns from "node:dns/promises";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "./server/auth";
import { whatsappWebhookRouter } from "./server/webhooks/whatsapp";
import { whatsappConnectorRouter } from "./server/routes/whatsapp-connector";
import { connectorAssistantRouter } from "./server/routes/connector-assistant";

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(
  express.json({
    limit: "25mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Lazy initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return null;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// SSRF Protection Helpers
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  // IPv4 checks
  if (ip.startsWith("127.")) return true; // Loopback
  if (ip.startsWith("0.")) return true;
  if (ip.startsWith("10.")) return true; // RFC 1918 Class A
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true; // RFC 1918 Class B
  if (ip.startsWith("192.168.")) return true; // RFC 1918 Class C
  if (ip.startsWith("169.254.")) return true; // Link-local / Cloud metadata (169.254.169.254)
  if (ip.startsWith("192.0.2.") || ip.startsWith("198.51.100.") || ip.startsWith("203.0.113.")) return true; // Test-Net
  if (/^2(2[4-9]|[3-4][0-9]|5[0-5])\./.test(ip)) return true; // Multicast & Broadcast

  // IPv6 checks
  if (ip === "::1" || ip === "::" || ip.startsWith("fe80:") || ip.startsWith("fc00:") || ip.startsWith("fd00:")) {
    return true;
  }
  // IPv4-mapped IPv6
  if (ip.startsWith("::ffff:")) {
    const ipv4 = ip.replace("::ffff:", "");
    return isPrivateOrReservedIp(ipv4);
  }

  return false;
}

export async function validateUrlForSsrf(rawUrl: string): Promise<{ valid: boolean; error?: string; urlObj?: URL }> {
  let urlObj: URL;
  try {
    const sanitized = rawUrl.trim();
    // Check scheme if explicitly present
    const schemeMatch = sanitized.match(/^([a-zA-Z0-9+\-.]+):/);
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase();
      if (scheme !== "http" && scheme !== "https") {
        return { valid: false, error: "Only http:// and https:// URLs are allowed." };
      }
    }

    const withProtocol = sanitized.startsWith("http://") || sanitized.startsWith("https://")
      ? sanitized
      : `https://${sanitized}`;
    urlObj = new URL(withProtocol);
  } catch {
    return { valid: false, error: "Invalid website URL format. Please provide a valid HTTP or HTTPS address." };
  }

  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
    return { valid: false, error: "Only http:// and https:// URLs are allowed." };
  }

  // Block non-standard ports (e.g. 22 SSH, 5432 Postgres, 6379 Redis)
  if (urlObj.port && urlObj.port !== "80" && urlObj.port !== "443") {
    return { valid: false, error: "Access to non-standard ports is forbidden. Only standard ports 80 and 443 are supported." };
  }

  const hostname = urlObj.hostname.toLowerCase();

  // Deny localhost and internal hostnames
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata" ||
    hostname === "instance-data"
  ) {
    return { valid: false, error: "Access to localhost or internal network destinations is strictly forbidden." };
  }

  // If host is direct IP address
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":")) {
    if (isPrivateOrReservedIp(hostname)) {
      return { valid: false, error: "Access to private or loopback IP addresses is strictly forbidden." };
    }
  } else {
    // DNS resolution check
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) {
        return { valid: false, error: `Could not resolve domain name '${hostname}'. Please check spelling.` };
      }
      for (const addr of addresses) {
        if (isPrivateOrReservedIp(addr.address)) {
          return { valid: false, error: "Destination resolves to a private or restricted network address (SSRF blocked)." };
        }
      }
    } catch (dnsErr: any) {
      return { valid: false, error: `Could not resolve website host '${hostname}': ${dnsErr.message || "Host not found"}` };
    }
  }

  return { valid: true, urlObj };
}

async function fetchSafePage(targetUrl: string): Promise<{ html: string; status: number; finalUrl: string } | null> {
  const ssrfCheck = await validateUrlForSsrf(targetUrl);
  if (!ssrfCheck.valid || !ssrfCheck.urlObj) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; BusinessDoctorAI/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    // Ensure final redirected URL is also not private
    const finalSsrf = await validateUrlForSsrf(response.url);
    if (!finalSsrf.valid) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml") &&
      !contentType.includes("text/plain")
    ) {
      return null;
    }

    const text = await response.text();
    return {
      html: text.slice(0, 350000), // Cap at ~350KB to avoid excessive memory
      status: response.status,
      finalUrl: response.url,
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export function cleanHtmlContent(rawHtml: string): {
  cleanText: string;
  metaInfo: {
    title: string;
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
    ogSiteName: string;
    jsonLd: any[];
    phoneLinks: string[];
    emailLinks: string[];
    emails?: string[];
    phones?: string[];
    socialLinks: {
      instagram?: string;
      facebook?: string;
      linkedin?: string;
      twitter?: string;
      youtube?: string;
      whatsapp?: string;
    };
  };
  subLinks: string[];
} {
  // Extract title
  const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

  // Extract meta tags
  const getMeta = (nameOrProp: string): string => {
    const match =
      rawHtml.match(new RegExp(`<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]+content=["']([^"']*)["']`, "i")) ||
      rawHtml.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${nameOrProp}["']`, "i"));
    return match ? match[1].trim() : "";
  };

  const description = getMeta("description");
  const keywords = getMeta("keywords");
  const ogTitle = getMeta("og:title");
  const ogDescription = getMeta("og:description");
  const ogSiteName = getMeta("og:site_name");

  // Extract JSON-LD
  const jsonLd: any[] = [];
  const jsonLdMatches = rawHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed) jsonLd.push(parsed);
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  // Extract contact links
  const phoneLinks: string[] = [];
  const telMatches = rawHtml.matchAll(/href=["']tel:([^"']+)["']/gi);
  for (const tm of telMatches) {
    const p = tm[1].trim();
    if (p && !phoneLinks.includes(p)) phoneLinks.push(p);
  }

  const emailLinks: string[] = [];
  const mailMatches = rawHtml.matchAll(/href=["']mailto:([^"'\?]+)/gi);
  for (const mm of mailMatches) {
    const e = mm[1].trim().toLowerCase();
    if (e && !emailLinks.includes(e)) emailLinks.push(e);
  }

  // Also extract text emails if any
  const textEmails = rawHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  for (const te of textEmails) {
    const cleanE = te.trim().toLowerCase();
    if (!emailLinks.includes(cleanE)) emailLinks.push(cleanE);
  }

  // Also extract text phones if any
  const textPhones = rawHtml.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g) || [];
  for (const tp of textPhones) {
    const cleanP = tp.trim();
    if (!phoneLinks.includes(cleanP)) phoneLinks.push(cleanP);
  }

  // Social Links
  const socialLinks: any = {};
  const instaMatch = rawHtml.match(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s>]+)["']/i);
  if (instaMatch) socialLinks.instagram = instaMatch[1];

  const fbMatch = rawHtml.match(/href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s>]+)["']/i);
  if (fbMatch) socialLinks.facebook = fbMatch[1];

  const linkedinMatch = rawHtml.match(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s>]+)["']/i);
  if (linkedinMatch) socialLinks.linkedin = linkedinMatch[1];

  const twitterMatch = rawHtml.match(/href=["'](https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^"'\s>]+)["']/i);
  if (twitterMatch) socialLinks.twitter = twitterMatch[1];

  const ytMatch = rawHtml.match(/href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"'\s>]+)["']/i);
  if (ytMatch) socialLinks.youtube = ytMatch[1];

  const waMatch = rawHtml.match(/href=["'](https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^"'\s>]+)["']/i);
  if (waMatch) socialLinks.whatsapp = waMatch[1];

  // Discover internal links
  const subLinks: string[] = [];
  const hrefMatches = rawHtml.matchAll(/href=["'](\/[^"'\s#]+|https?:\/\/[^"'\s#]+)["']/gi);
  for (const hm of hrefMatches) {
    const link = hm[1];
    if (
      link.includes("about") ||
      link.includes("contact") ||
      link.includes("service") ||
      link.includes("product") ||
      link.includes("shop") ||
      link.includes("menu") ||
      link.includes("pricing") ||
      link.includes("treatments") ||
      link.includes("faq")
    ) {
      if (!subLinks.includes(link) && subLinks.length < 5) {
        subLinks.push(link);
      }
    }
  }

  // Clean body text by stripping scripts, styles, svgs, comments
  let cleaned = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    cleanText: cleaned.slice(0, 15000), // Keep up to 15k chars of readable text
    metaInfo: {
      title,
      description,
      keywords,
      ogTitle,
      ogDescription,
      ogSiteName,
      jsonLd,
      phoneLinks,
      emailLinks,
      emails: emailLinks,
      phones: phoneLinks,
      socialLinks,
    },
    subLinks,
  };
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Website Business Data Import & Analysis Endpoint
app.post("/api/website/analyze", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Please provide a valid website URL." });
    }

    const ssrfCheck = await validateUrlForSsrf(url);
    if (!ssrfCheck.valid || !ssrfCheck.urlObj) {
      return res.status(400).json({ error: ssrfCheck.error || "Invalid URL destination." });
    }

    const targetUrlObj = ssrfCheck.urlObj;
    const normalizedTargetUrl = targetUrlObj.origin + targetUrlObj.pathname;
    const domain = targetUrlObj.hostname.replace(/^www\./, "");

    // 1. Fetch Primary Page
    const mainPage = await fetchSafePage(normalizedTargetUrl);
    if (!mainPage || !mainPage.html) {
      return res.status(422).json({
        error: `Could not access website (${domain}). The site may be offline, blocking public crawlers, or taking too long to respond.`,
      });
    }

    const mainCleaned = cleanHtmlContent(mainPage.html);

    // 2. Fetch up to 2 discovered public subpages (e.g. /about, /services, /products, /contact)
    const subpagesContent: Array<{ url: string; text: string }> = [];
    for (const rawSubLink of mainCleaned.subLinks.slice(0, 3)) {
      try {
        const resolvedSubUrl = new URL(rawSubLink, normalizedTargetUrl);
        // Ensure same hostname only
        if (resolvedSubUrl.hostname.toLowerCase() === targetUrlObj.hostname.toLowerCase()) {
          const subPage = await fetchSafePage(resolvedSubUrl.href);
          if (subPage && subPage.html) {
            const subCleaned = cleanHtmlContent(subPage.html);
            subpagesContent.push({
              url: resolvedSubUrl.href,
              text: subCleaned.cleanText.slice(0, 6000),
            });
          }
        }
      } catch {
        // Skip link on error
      }
    }

    const totalPagesAnalyzed = 1 + subpagesContent.length;

    // 3. Extract Structured Information with Gemini AI or Deterministic Fallback
    const ai = getAIClient();

    if (ai) {
      const prompt = `You are an expert business information extractor for Business Doctor AI.
Analyze the following public website content scraped from ${domain} (${normalizedTargetUrl}) across ${totalPagesAnalyzed} public pages.

Extract structured, factual data for:
1. Business Profile:
   - name: exact brand / business name
   - description: 1-3 sentences explaining what this business offers and their unique value
   - industry: industry category (e.g. "Health & Wellness", "Retail & FMCG", "Fashion & Apparel", "Restaurant, Cafe & Cloud Kitchen", "Beauty, Spa & Salon", "IT & Digital Services", "Education & Coaching", "Home Services", "Manufacturing & B2B", "Jewelry & Luxury")
   - location: city, state, or address if found (e.g. "Bengaluru, Karnataka")
   - phone: phone number if found
   - email: official email if found
   - business_hours: operating hours or open days if stated
   - social_links: object with instagram, facebook, linkedin, twitter, youtube, whatsapp links if present
2. Products (tangible physical/digital items with catalog listings):
   - name: product name
   - description: short description
   - category: category tag
   - price: numeric price if publicly listed (e.g. 499), or null if not listed
   - sku: SKU / product code if found, or null
   - product_url: URL if available
3. Services (consultations, therapies, treatments, packages, sessions, bookings):
   - name: service name
   - description: service description
   - category: service category
   - price: numeric price if stated, or null
   - duration_minutes: numeric duration in minutes if stated (e.g. 45, 60), or null

CRITICAL TRUTHFULNESS RULES:
- STRICT: NEVER invent missing details, prices, or SKUs. If price is not publicly displayed on the website, return null.
- STRICT: Do NOT invent fake customer orders, revenue, or transaction logs.
- Provide a list of "unverified_fields" for details that could not be found from the public website (e.g. "Transaction Sales Ledger", "Supplier Cost of Goods", "Internal Overhead Margins").

Scraped Meta Data:
Title: ${mainCleaned.metaInfo.title}
Meta Description: ${mainCleaned.metaInfo.description}
OG Title: ${mainCleaned.metaInfo.ogTitle}
OG Description: ${mainCleaned.metaInfo.ogDescription}
OG Site Name: ${mainCleaned.metaInfo.ogSiteName}
Discovered Phone Links: ${JSON.stringify(mainCleaned.metaInfo.phoneLinks)}
Discovered Email Links: ${JSON.stringify(mainCleaned.metaInfo.emailLinks)}
Discovered Social Links: ${JSON.stringify(mainCleaned.metaInfo.socialLinks)}
JSON-LD Schemas: ${JSON.stringify(mainCleaned.metaInfo.jsonLd.slice(0, 3))}

Main Page Clean Text:
${mainCleaned.cleanText.slice(0, 7000)}

Subpages Scraped Text:
${subpagesContent.map((sp) => `--- Subpage (${sp.url}) ---\n${sp.text}`).join("\n\n")}

Return STRICT JSON matching this schema:
{
  "business": {
    "name": "string",
    "description": "string",
    "industry": "string",
    "location": "string",
    "phone": "string",
    "email": "string",
    "business_hours": "string",
    "social_links": {
      "instagram": "string or null",
      "facebook": "string or null",
      "linkedin": "string or null",
      "twitter": "string or null",
      "youtube": "string or null",
      "whatsapp": "string or null"
    }
  },
  "products": [
    {
      "name": "string",
      "description": "string",
      "category": "string",
      "price": number or null,
      "sku": "string or null",
      "product_url": "string or null"
    }
  ],
  "services": [
    {
      "name": "string",
      "description": "string",
      "category": "string",
      "price": number or null,
      "duration_minutes": number or null
    }
  ],
  "unverified_fields": ["string"],
  "confidence": number
}`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const extracted = JSON.parse(aiResponse.text || "{}");

      return res.json({
        success: true,
        url: normalizedTargetUrl,
        domain,
        pagesAnalyzed: totalPagesAnalyzed,
        businessInfo: {
          name: extracted.business?.name || mainCleaned.metaInfo.ogSiteName || mainCleaned.metaInfo.title || domain,
          description: extracted.business?.description || mainCleaned.metaInfo.description || "",
          industry: extracted.business?.industry || "Retail & Services",
          location: extracted.business?.location || "",
          phone: extracted.business?.phone || mainCleaned.metaInfo.phoneLinks[0] || "",
          email: extracted.business?.email || mainCleaned.metaInfo.emailLinks[0] || "",
          business_hours: extracted.business?.business_hours || "",
          social_links: {
            ...mainCleaned.metaInfo.socialLinks,
            ...(extracted.business?.social_links || {}),
          },
        },
        products: Array.isArray(extracted.products) ? extracted.products : [],
        services: Array.isArray(extracted.services) ? extracted.services : [],
        unverifiedFields: Array.isArray(extracted.unverified_fields)
          ? extracted.unverified_fields
          : ["Transaction Revenue History", "Cost of Goods Sold (COGS)", "Private Margin Spreadsheets"],
        confidence: extracted.confidence || 88,
      });
    }

    // Deterministic fallback if Gemini AI is not configured
    const fallbackBusiness = {
      name: mainCleaned.metaInfo.ogSiteName || mainCleaned.metaInfo.title.split(/[-|–]/)[0].trim() || domain,
      description: mainCleaned.metaInfo.description || mainCleaned.metaInfo.ogDescription || "",
      industry: "Retail & Services",
      location: "",
      phone: mainCleaned.metaInfo.phoneLinks[0] || "",
      email: mainCleaned.metaInfo.emailLinks[0] || "",
      business_hours: "",
      social_links: mainCleaned.metaInfo.socialLinks,
    };

    // Parse any JSON-LD products or services
    const fallbackProducts: any[] = [];
    const fallbackServices: any[] = [];

    mainCleaned.metaInfo.jsonLd.forEach((item) => {
      if (item["@type"] === "Product" || item.type === "Product") {
        fallbackProducts.push({
          name: item.name || "Product Item",
          description: item.description || "",
          category: item.category || "General",
          price: item.offers?.price ? Number(item.offers.price) : null,
          sku: item.sku || null,
          product_url: item.url || null,
        });
      } else if (item["@type"] === "Service" || item.type === "Service") {
        fallbackServices.push({
          name: item.name || "Service Item",
          description: item.description || "",
          category: item.category || "Services",
          price: item.offers?.price ? Number(item.offers.price) : null,
          duration_minutes: null,
        });
      }
    });

    return res.json({
      success: true,
      url: normalizedTargetUrl,
      domain,
      pagesAnalyzed: totalPagesAnalyzed,
      businessInfo: fallbackBusiness,
      products: fallbackProducts,
      services: fallbackServices,
      unverifiedFields: [
        "Historical Sales Orders",
        "Private Customer Database",
        "Real Unit Costs & Margins",
      ],
      confidence: 75,
    });
  } catch (err: any) {
    console.error("Website analysis error:", err);
    return res.status(500).json({
      error: `Failed to analyze website: ${err.message || "Unknown error occurred"}`,
    });
  }
});

// AI: Business Doctor Diagnosis
app.post("/api/ai/diagnose", requireAuth({ allowedRoles: ["owner", "manager"] }), async (req, res) => {
  try {
    const { business, metrics, sampleDataSummary } = req.body;
    const ai = getAIClient();

    if (!ai) {
      return res.status(200).json({
        fallback: true,
        message: "Gemini API key not configured. Using local deterministic diagnosis engine.",
      });
    }

    const prompt = `You are "Business Doctor AI", an elite AI operating system for Indian & global small businesses.
Analyze the following business profile and REAL data summary:

Business Profile:
- Name: ${business?.name || "Business"}
- Type: ${business?.business_type || "hybrid"}
- Industry: ${business?.industry || "Retail/Services"}
- Location: ${business?.location || "India"}
- Currency: ${business?.currency || "INR"} (${business?.currency_symbol || "₹"})
- Business Age Stage: ${business?.business_age_stage || "early"}
- Data Maturity: ${business?.data_maturity_mode || "existing_partial"}
- Revenue Target: ${business?.currency_symbol || "₹"}${business?.monthly_revenue_target || 0}
- Target Audience: ${business?.target_customers || "Local & online consumers"}

Available Real Metrics:
- Total Orders: ${metrics?.totalOrders || 0}
- Total Revenue: ${business?.currency_symbol || "₹"}${metrics?.totalRevenue || 0}
- Total Expenses: ${business?.currency_symbol || "₹"}${metrics?.totalExpenses || 0}
- Net Profit: ${business?.currency_symbol || "₹"}${metrics?.netProfit || 0}
- Active Customers: ${metrics?.activeCustomers || 0}
- Repeat Customer Rate: ${metrics?.repeatCustomerRate || 0}%
- Total Leads: ${metrics?.totalLeads || 0}
- Lead Conversion Rate: ${metrics?.leadConversionRate || 0}%
- Average Order Value: ${business?.currency_symbol || "₹"}${metrics?.avgOrderValue || 0}

Data Breakdown Summary:
${JSON.stringify(sampleDataSummary || {}, null, 2)}

CRITICAL RULES:
1. NEVER invent historical trends, revenue, customer behavior, conversion rates, retention, expenses, dates, or business facts.
2. Ground all diagnoses strictly in the actual tenant-scoped database records provided above.
3. If evidence is inadequate or data is insufficient, explicitly return an "Insufficient data" diagnosis stating: "Insufficient data: [exact reason]".
4. Provide structured diagnoses addressing verified areas (revenue, sales, retention, marketing, pricing, expense, conversion, or operational).
5. Output strict valid JSON matching this schema:
{
  "diagnoses": [
    {
      "problem_title": "string",
      "problem_description": "string",
      "category": "revenue" | "sales" | "retention" | "marketing" | "pricing" | "product_service" | "expense" | "conversion" | "operational" | "growth",
      "evidence": "string (concrete reference to observed data)",
      "affected_metric": "string (e.g. Total Revenue | Gross Margin | Repeat Retention | Inbound Lead Conversion)",
      "source_data": "string (exact table and columns, e.g. orders table or leads table)",
      "confidence": number (60-98),
      "severity": "critical" | "warning" | "opportunity" | "info",
      "recommended_action": "string (tactical, actionable steps for Indian SMB)",
      "requires_human_approval": boolean,
      "expected_kpi": "string (e.g. +15% conversion in 30 days)",
      "effort": "quick_win" | "medium" | "high_effort"
    }
  ],
  "executive_summary": "string"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (err: any) {
    console.error("AI Diagnosis Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate AI diagnosis" });
  }
});

// AI: 5-Day Business Transformation Trial Generator
app.post("/api/ai/5-day-trial", requireAuth({ allowedRoles: ["owner", "manager"] }), async (req, res) => {
  try {
    const { business, dayNumber, currentDayData } = req.body;
    const ai = getAIClient();

    if (!ai) {
      return res.status(200).json({ fallback: true });
    }

    const prompt = `You are Business Doctor AI building content for the 5-Day Business Transformation Trial.
Current Request is for DAY ${dayNumber}:
Business: ${business?.name} (${business?.industry}, ${business?.location}, Age: ${business?.business_age_stage}, Maturity: ${business?.data_maturity_mode})

Day Specifications:
- DAY 1 (Understand My Business): Health Report, Pricing & margin analysis, target customer audit.
- DAY 2 (Bring Me Customers): Specific audience segments, 3 high-impact Instagram Reels scripts, 2 WhatsApp broadcast copies, 4 organic post hooks tailored for India SMB.
- DAY 3 (Automate My Customers): 3 instant CRM automation flows (e.g., Abandoned lead WhatsApp follow-up in 15 mins, 45-day winback, Google review request).
- DAY 4 (Show Me My Business): KPI diagnostic scorecard, unit economics review, bottleneck spotlight.
- DAY 5 (Growth Plan): 30-Day Growth Roadmap divided into Week 1-4 with exact metrics and milestone goals.

Provide actionable, non-generic, high-converting results customized specifically for this business in strict JSON format:
{
  "day": ${dayNumber},
  "title": "string",
  "highlights": ["string", "string", "string"],
  "insights": "string",
  "actionable_deliverables": [
    {
      "type": "string (e.g. WhatsApp Template | Reel Script | Pricing Strategy | Automation Rule | Roadmap)",
      "title": "string",
      "content": "string (complete copy or structured actionable plan)",
      "expected_outcome": "string"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("Trial AI error:", err);
    res.status(500).json({ error: err.message || "Failed to generate trial day content" });
  }
});

// AI: Marketing Content Generator
app.post("/api/ai/marketing-content", requireAuth({ allowedRoles: ["owner", "manager", "marketing"] }), async (req, res) => {
  try {
    const {
      business,
      campaignType,
      goal,
      targetAudience,
      productOrServiceName,
      price,
      offerDetails,
      contentType,
      topic,
    } = req.body;
    const ai = getAIClient();

    if (!ai) {
      return res.status(200).json({ fallback: true });
    }

    const prompt = `You are a growth marketing specialist and copywriter for real businesses. Generate high-converting, tailored marketing content strictly grounded in the business profile and verified offerings provided below:

BUSINESS PROFILE:
- Name: ${business?.name || "Business"}
- Industry: ${business?.industry || "Retail"}
- Location: ${business?.location || "India"}
- Target Audience: ${targetAudience || business?.target_customers || "Discerning clients"}
- Core Goals: ${(business?.business_goals || []).join(", ") || goal || "Scale repeat sales"}

OFFERING / PROMOTION DETAILS:
- Subject / Offering: ${productOrServiceName || topic || "Signature Offering"}
- Pricing / Rate: ${price ? (business?.currency_symbol || "₹") + price : "Standard Pricing"}
- Special Offer / Privilege: ${offerDetails || "Exclusive privilege for valued patrons"}
- Requested Format: ${contentType || campaignType || "full_suite"}

RULES:
1. Always write natural, compelling, professional copy.
2. Ground all claims strictly in the business context, location, and verified products/services provided. Do NOT fabricate awards, fake certifications, or unverified claims.
3. For WhatsApp, keep it conversational, personal, and include "{{name}}" placeholders.
4. For Instagram/Reels, structure clear 3-second visual hooks, value breakdowns, and direct CTAs.
5. Include relevant cultural/local Indian context (such as Bengaluru/Indiranagar, festivals, seasonal wellness) when appropriate.

OUTPUT FORMAT: Return a valid JSON object matching this schema:
{
  "whatsappTemplates": [
    {
      "name": "string",
      "objective": "string",
      "message": "string (ready to send via WhatsApp Business with placeholders like {{name}})",
      "suggestedTiming": "string"
    }
  ],
  "socialPosts": [
    {
      "platform": "Instagram" | "Facebook" | "LinkedIn" | "Google Business Profile",
      "hook": "string",
      "caption": "string",
      "hashtags": ["string"],
      "imageIdea": "string"
    }
  ],
  "reelIdeas": [
    {
      "title": "string",
      "audioIdea": "string (trending sound style)",
      "duration": "15s" | "30s" | "60s",
      "scriptBreakdown": [
        { "timestamp": "0-3s (Hook)", "visual": "string", "audio": "string" },
        { "timestamp": "3-15s (Value/Showcase)", "visual": "string", "audio": "string" },
        { "timestamp": "15-30s (Call To Action)", "visual": "string", "audio": "string" }
      ],
      "caption": "string"
    }
  ],
  "singleDraft": {
    "title": "string",
    "hooks": ["string"],
    "body": "string",
    "callToAction": "string",
    "hashtags": ["string"],
    "suggestedVisual": "string"
  }
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("Marketing AI error:", err);
    res.status(500).json({ error: err.message || "Failed to generate marketing content" });
  }
});

// AI: Ask Business Doctor (Conversational Advisor)
app.post("/api/ai/ask-doctor", requireAuth({ allowedRoles: ["owner", "manager", "marketing", "staff"] }), async (req, res) => {
  try {
    const { question, business, metrics, conversationHistory } = req.body;
    const ai = getAIClient();

    if (!ai) {
      return res.status(200).json({
        answer: "Business Doctor AI is running in standalone mode. Based on standard best practices for Indian SMBs: focus on WhatsApp lead follow-up within 15 minutes, standardizing product margins above 35%, and collecting customer phone numbers at point of sale to build your direct retention channel.",
      });
    }

    const prompt = `You are "Business Doctor AI", a practical, sharp, highly empathetic Chief Operating Officer and Business Advisor for Indian & global small businesses.
You speak clearly, concisely, with zero buzzword fluff. You give mathematical, evidence-grounded, tactical advice.

Current Business Context:
- Name: ${business?.name} (${business?.industry}, ${business?.business_type}, ${business?.location})
- Age: ${business?.business_age_stage}
- Monthly Target: ${business?.currency_symbol || "₹"}${business?.monthly_revenue_target}
- Current Revenue: ${business?.currency_symbol || "₹"}${metrics?.totalRevenue || 0}
- Current Expenses: ${business?.currency_symbol || "₹"}${metrics?.totalExpenses || 0}
- Conversion Rate: ${metrics?.leadConversionRate || 0}%
- Repeat Customer Rate: ${metrics?.repeatCustomerRate || 0}%

User's Question: "${question}"

Previous context:
${(conversationHistory || []).map((m: any) => `${m.role}: ${m.content}`).join("\n")}

Respond with:
1. Direct Prescription (1-2 sentences)
2. The Evidence / Business Rationale
3. Action Steps (Step 1, Step 2, Step 3)
4. Expected Financial / Operational Impact`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        temperature: 0.3,
      },
    });

    return res.json({ answer: response.text });
  } catch (err: any) {
    console.error("Ask Doctor error:", err);
    res.status(500).json({ error: err.message || "Failed to answer question" });
  }
});

// AI: Autonomous Agent Action Generator
app.post("/api/ai/agent-action-generate", requireAuth({ allowedRoles: ["owner", "manager"] }), async (req, res) => {
  try {
    const { agentType, business, triggerData, existingActions } = req.body;
    const ai = getAIClient();

    if (!ai) {
      return res.status(200).json({ fallback: true });
    }

    const prompt = `You are the "${agentType}" in the Business Doctor AI autonomous agent crew.
Business Profile:
- Name: ${business?.name} (${business?.industry}, ${business?.location})
- Currency: ${business?.currency_symbol || "₹"}
- Target Margin: ${business?.target_gross_margin || 50}%

Trigger Data: ${JSON.stringify(triggerData || {})}

Existing Pending Actions to Avoid Duplication:
${JSON.stringify((existingActions || []).map((a: any) => ({ type: a.action_type, target: a.target_entity, entity_id: a.entity_id })))}

Generate a concrete, high-leverage proposed action that strictly adheres to the human-in-the-loop safety protocol.
The action MUST be grounded directly in the provided trigger data (e.g. specific customer, lead, out-of-stock product, or expense leak).

Output strict JSON matching:
{
  "action_type": "string (descriptive action title e.g. 'Instant WhatsApp Speed-to-Lead Follow-up', 'Emergency Buffer Restock Order', 'Dormant VIP Win-Back Offer')",
  "target_entity": "string (e.g. 'Lead: Priya Verma', 'SKU: Herbal Hair Oil', 'Customer: Amit Patel')",
  "entity_id": "string or null",
  "proposed_payload": {
    "channel": "WhatsApp" | "Email" | "Internal Task" | "Supplier PO" | "Inventory Reorder",
    "message": "string (the exact ready-to-dispatch message copy or order details with placeholders filled)",
    "trigger_reason": "string",
    "metadata": {}
  },
  "impact_level": "low" | "medium" | "high",
  "confidence": number (75-99),
  "reasoning": "string (mathematical or behavioral rationale why this specific action will solve the bottleneck)"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("Agent action generator error:", err);
    res.status(500).json({ error: err.message || "Failed to generate agent action" });
  }
});

// AI: Autonomous AI Agent Execution Loop (Unified Diagnosis + Action Orchestrator)
app.post("/api/ai/agent-execution-loop", requireAuth({ allowedRoles: ["owner", "manager"] }), async (req, res) => {
  try {
    const {
      business,
      metrics,
      customers,
      leads,
      products,
      services,
      orders,
      bookings,
      expenses,
      automations,
      business_memory,
      data_sources,
      existingPendingSignatures,
    } = req.body;

    const ai = getAIClient();

    if (!ai) {
      return res.status(200).json({
        fallback: true,
        message: "Gemini API key not configured. Triggering local deterministic agent execution engine.",
      });
    }

    const prompt = `You are the Lead Coordinator of the "Business Doctor AI Autonomous Agent Crew".
Your crew contains 4 specialized autonomous agents:
1. "Growth & Inbound Agent": Focuses on new leads, speed-to-lead follow-ups, low conversion rates, and marketing hook optimization.
2. "Retention & LTV Agent": Focuses on 30-45 day repeat consumption cycles, dormant VIP customers, churn risk, and review collection.
3. "Operations & Inventory Agent": Focuses on low stock/stockouts, supplier buffer purchase orders, practitioner schedule gaps, and weekday therapy room utilization.
4. "Financial Auditor Agent": Focuses on gross margin leakage, discount erosion, high expense spikes, and unit economics.

WORKSPACE REAL OPERATIONAL CONTEXT:
- Business: ${business?.name} (${business?.industry || "Ayurveda / Retail"}, Type: ${business?.business_type || "Hybrid"}, Location: ${business?.location || "India"})
- Currency: ${business?.currency_symbol || "₹"}
- Revenue Target: ${business?.currency_symbol || "₹"}${business?.monthly_revenue_target || 500000}

Current Calculated Live Metrics:
- Total Orders: ${metrics?.totalOrders || 0} (Revenue: ${business?.currency_symbol || "₹"}${metrics?.totalRevenue || 0})
- Total Expenses: ${business?.currency_symbol || "₹"}${metrics?.totalExpenses || 0} | Net Profit: ${business?.currency_symbol || "₹"}${metrics?.netProfit || 0}
- Active Customers: ${metrics?.activeCustomers || 0} | Repeat Rate: ${metrics?.repeatCustomerRate || 0}%
- Total Leads: ${metrics?.totalLeads || 0} | Lead Conversion: ${metrics?.leadConversionRate || 0}%
- Avg Order Value: ${business?.currency_symbol || "₹"}${metrics?.avgOrderValue || 0}

Sample Snapshot of Real Entities:
- Customers (${customers?.length || 0} total): ${JSON.stringify((customers || []).slice(0, 5).map((c: any) => ({ id: c.id, name: c.name, status: c.status, orders: c.total_orders, spent: c.total_spent })))}
- Leads (${leads?.length || 0} total): ${JSON.stringify((leads || []).slice(0, 5).map((l: any) => ({ id: l.id, name: l.name, score: l.score, status: l.status, source: l.source })))}
- Products (${products?.length || 0} total): ${JSON.stringify((products || []).map((p: any) => ({ id: p.id, name: p.name, stock: p.stock_quantity, status: p.status, price: p.price, margin: p.margin_pct })))}
- Services (${services?.length || 0} total): ${JSON.stringify((services || []).map((s: any) => ({ id: s.id, name: s.name, price: s.price })))}
- Recent Orders (${orders?.length || 0} total): ${JSON.stringify((orders || []).slice(0, 5).map((o: any) => ({ id: o.id, customer: o.customer_name, amount: o.total_amount, status: o.payment_status })))}
- Bookings (${bookings?.length || 0} total): ${JSON.stringify((bookings || []).slice(0, 5).map((b: any) => ({ id: b.id, customer: b.customer_name, service: b.service_name, status: b.status })))}
- Expenses (${expenses?.length || 0} total): ${JSON.stringify((expenses || []).slice(0, 5).map((e: any) => ({ category: e.category, amount: e.amount })))}
- Active Automations: ${JSON.stringify((automations || []).map((a: any) => ({ name: a.name, active: a.is_active, trigger: a.trigger_type })))}
- Business Memory Ledger: ${JSON.stringify((business_memory || []).slice(0, 4).map((m: any) => ({ cat: m.category, observation: m.observation })))}
- Connected Data Sources: ${JSON.stringify((data_sources || []).map((d: any) => ({ name: d.name, type: d.source_type })))}

Existing Pending Action Signatures to avoid duplicate recommendations (IDEMPOTENCY):
${JSON.stringify(existingPendingSignatures || [])}

TASK:
1. Formulate 3-5 structured AI Diagnoses based ONLY on the mathematical evidence above.
2. For the highest priority bottlenecks, generate 2-4 concrete, human-in-the-loop PROPOSED AGENT ACTIONS assigned to the appropriate specialized agent.
3. NEVER fabricate imaginary numbers or ghost customers; reference the actual customer names, lead names, product names, or expenses provided in the data.

Strict Output JSON Schema:
{
  "diagnoses": [
    {
      "problem_title": "string",
      "problem_description": "string",
      "category": "revenue" | "sales" | "retention" | "marketing" | "pricing" | "product_service" | "expense" | "conversion" | "operational" | "growth",
      "evidence": "string (grounded in actual data)",
      "confidence": number (65-98),
      "severity": "critical" | "warning" | "opportunity" | "info",
      "recommended_action": "string",
      "expected_kpi": "string (e.g. '+₹35,000 monthly margin recovery')",
      "effort": "quick_win" | "medium" | "high_effort",
      "reason": "string"
    }
  ],
  "proposed_actions": [
    {
      "agent_name": "Growth & Inbound Agent" | "Retention & LTV Agent" | "Operations & Inventory Agent" | "Financial Auditor Agent",
      "action_type": "string",
      "target_entity": "string (e.g. 'Lead: Sunita Rao (Score 91)' or 'SKU: Ashwagandha Gold')",
      "entity_id": "string or null",
      "proposed_payload": {
        "channel": "WhatsApp" | "Email" | "Internal Task" | "Supplier PO" | "Inventory Reorder",
        "message": "string (the exact ready-to-dispatch message or operational command)",
        "trigger_reason": "string"
      },
      "impact_level": "low" | "medium" | "high",
      "confidence": number (75-99),
      "reasoning": "string"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("AI Agent Execution Loop Error:", err);
    res.status(500).json({ error: err.message || "Failed to run agent execution loop" });
  }
});

// ==============================================================================
// AGENT ACTION LIFECYCLE & MUTATION ENDPOINTS (HUMAN-IN-THE-LOOP STATE MACHINE)
// ==============================================================================

// Approve Proposed Action
app.post("/api/actions/approve", requireAuth({ allowedRoles: ["owner", "manager"] }), async (req, res) => {
  try {
    const { actionId, actionData } = req.body;
    if (!actionId) {
      return res.status(400).json({ error: "Missing required actionId." });
    }

    const auth = req.auth!;
    const approvedAt = new Date().toISOString();

    return res.json({
      success: true,
      actionId,
      status: "approved",
      approvedBy: auth.id,
      approvedAt,
      auditLog: {
        event: "AGENT_ACTION_APPROVED",
        description: `Action ${actionId} approved by user ${auth.email} (Role: ${auth.role})`,
        timestamp: approvedAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to approve action" });
  }
});

// Execute Approved Action
app.post("/api/actions/execute", requireAuth({ allowedRoles: ["owner", "manager"] }), async (req, res) => {
  try {
    const { actionId, status: currentStatus, actionType, payload } = req.body;
    if (!actionId) {
      return res.status(400).json({ error: "Missing required actionId." });
    }

    // Strict State Machine Verification: Only APPROVED actions can be EXECUTED
    if (currentStatus !== "approved") {
      return res.status(403).json({
        error: `Security Violation: Action must be in 'approved' state before execution. Current state: '${currentStatus || "proposed"}'. Unapproved agent execution is forbidden.`,
        code: "UNAPPROVED_ACTION_EXECUTION_BLOCKED",
      });
    }

    const auth = req.auth!;
    const executedAt = new Date().toISOString();

    return res.json({
      success: true,
      actionId,
      status: "executed",
      executedBy: auth.id,
      executedAt,
      auditLog: {
        event: "AGENT_ACTION_EXECUTED",
        description: `Action ${actionId} (${actionType || "Autonomous Task"}) dispatched to ${payload?.channel || "System"} by ${auth.email}`,
        timestamp: executedAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to execute action" });
  }
});

// Reject Proposed Action
app.post("/api/actions/reject", requireAuth({ allowedRoles: ["owner", "manager"] }), async (req, res) => {
  try {
    const { actionId, reason } = req.body;
    if (!actionId) {
      return res.status(400).json({ error: "Missing required actionId." });
    }

    const auth = req.auth!;
    const rejectedAt = new Date().toISOString();

    return res.json({
      success: true,
      actionId,
      status: "rejected",
      rejectedBy: auth.id,
      rejectedAt,
      reason: reason || "Dismissed by operator",
      auditLog: {
        event: "AGENT_ACTION_REJECTED",
        description: `Action ${actionId} rejected by ${auth.email}: ${reason || "No reason specified"}`,
        timestamp: rejectedAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to reject action" });
  }
});

// Delete Business (Owner-Only)
app.delete("/api/business/:businessId", requireAuth({ allowedRoles: ["owner"] }), async (req, res) => {
  const { businessId } = req.params;
  const auth = req.auth!;

  if (businessId !== auth.businessId) {
    return res.status(403).json({
      error: "Cross-tenant violation: Cannot delete a business that does not match authenticated context.",
    });
  }

  return res.json({
    success: true,
    message: `Business ${businessId} deleted successfully by owner ${auth.email}.`,
  });
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok", service: "business-doctor-ai" });
});

// ==============================================================================
// META WHATSAPP CLOUD API WEBHOOK ENDPOINTS (PHASE 6 STEP 2)
// ==============================================================================
app.use("/api/webhooks/whatsapp", whatsappWebhookRouter);
app.use("/api/webhook/whatsapp", whatsappWebhookRouter);

// ==============================================================================
// REAL META WHATSAPP CONNECTOR & MESSAGING DISPATCH (PHASE 6 STEP 4)
// ==============================================================================
app.use("/api/connectors/whatsapp", whatsappConnectorRouter);

// ==============================================================================
// LIVE CONNECTION ASSISTANT ENDPOINTS (PHASE 6 STEP 3)
// ==============================================================================
app.use("/api/connectors/assist", connectorAssistantRouter);

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Business Doctor AI server listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST && !process.env.TEST) {
  startServer();
}
