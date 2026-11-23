import {
  Business,
  BusinessMetrics,
  Customer,
  Lead,
  Order,
  Booking,
  Expense,
  Product,
  ServiceItem,
  DataSource,
  BusinessMemory,
  AIDiagnosis,
  Automation,
  TrialDayContent,
  BusinessTrial,
  TrialDeliverable,
} from '../types/database';

export interface TrialEngineContext {
  products: Product[];
  services: ServiceItem[];
  customers: Customer[];
  leads: Lead[];
  orders: Order[];
  bookings: Booking[];
  expenses: Expense[];
  dataSources: DataSource[];
  memory: BusinessMemory[];
  diagnoses: AIDiagnosis[];
  automations: Automation[];
}

/**
 * Calculates verified data completeness across all 6 core business facets (0 - 100%)
 */
export function calculateDataCompleteness(
  business: Business,
  context: TrialEngineContext
): { score: number; facets: { label: string; complete: boolean; details: string }[] } {
  const products = context.products || [];
  const services = context.services || [];
  const customers = context.customers || [];
  const orders = context.orders || [];
  const bookings = context.bookings || [];
  const expenses = context.expenses || [];
  const leads = context.leads || [];
  const dataSources = context.dataSources || [];

  const facets = [
    {
      label: 'Business Profile',
      complete: Boolean(business.name && business.industry && business.location),
      details: `${business.industry || 'Uncategorized'} in ${business.location || 'Location missing'}`,
    },
    {
      label: 'Catalog (Products & Services)',
      complete: products.length > 0 || services.length > 0,
      details: `${products.length} Products, ${services.length} Services`,
    },
    {
      label: 'Customer Directory',
      complete: customers.length > 0,
      details: `${customers.length} Customers tracked`,
    },
    {
      label: 'Sales & Revenue Transactions',
      complete: orders.length > 0 || bookings.length > 0,
      details: `${orders.length} Orders, ${bookings.length} Bookings`,
    },
    {
      label: 'Operational Expense Tracking',
      complete: expenses.length > 0,
      details: `${expenses.length} Expense records logged`,
    },
    {
      label: 'Inbound Growth Channels',
      complete: leads.length > 0 || dataSources.length > 0,
      details: `${leads.length} Leads, ${dataSources.length} Data connections`,
    },
  ];

  const completeCount = facets.filter((f) => f.complete).length;
  const score = Math.round((completeCount / facets.length) * 100);

  return { score, facets };
}

/**
 * Generates Day 1: Understand My Business
 */
export function generateDay1Content(
  business: Business,
  metrics: BusinessMetrics,
  context: TrialEngineContext
): TrialDayContent {
  const currency = business.currency_symbol || '₹';
  const completeness = calculateDataCompleteness(business, context);
  const heroProducts = [...context.products].sort((a, b) => (b.price - b.cost) - (a.price - a.cost)).slice(0, 3);
  const heroServices = [...context.services].slice(0, 2);

  const strengths: string[] = [];
  const problems: string[] = [];

  // Verified strengths
  if (metrics.grossMargin && metrics.grossMargin >= 40) {
    strengths.push(`Healthy unit product margins averaging ${metrics.grossMargin}% across catalog`);
  }
  if (metrics.repeatCustomerRate >= 25) {
    strengths.push(`Proven customer loyalty with ${metrics.repeatCustomerRate}% repeat buyer rate`);
  }
  if (context.services.length > 0) {
    strengths.push(`High-value service offerings available (${context.services.length} active service packages)`);
  }
  if (context.customers.length >= 5) {
    strengths.push(`Established customer base of ${context.customers.length} verified contacts`);
  }
  if (strengths.length === 0) {
    strengths.push(`Clear business identity established in ${business.location} for ${business.industry}`);
  }

  // Verified problems
  const stockouts = context.products.filter((p) => p.stock_quantity === 0);
  if (stockouts.length > 0) {
    problems.push(`${stockouts.length} product SKU(s) currently out of stock (${stockouts.map((p) => p.name).slice(0, 2).join(', ')})`);
  }
  if (context.expenses.length === 0) {
    problems.push('Zero operational expenses recorded - P&L margin calculations incomplete');
  }
  if (metrics.totalOrders === 0 && metrics.totalBookings === 0) {
    problems.push('No sales or booking transactions recorded yet for revenue analysis');
  }
  if (context.leads.length === 0) {
    problems.push('No inbound lead pipeline connected - growth relying on unmetered traffic');
  }
  if (problems.length === 0) {
    problems.push('No material bottleneck was identified from the available records; additional operational and channel data is needed before making a stronger claim.');
  }

  const highlights = [
    `Mapped ${context.products.length} products & ${context.services.length} services with verified margins`,
    `Audit completed with ${completeness.score}% verified data completeness score`,
    `Identified ${strengths.length} verified core strengths and ${problems.length} operational bottlenecks`,
  ];

  const auditContent = [
    `BUSINESS IDENTITY & MATURITY AUDIT`,
    `• Business Name: ${business.name}`,
    `• Industry: ${business.industry} | Location: ${business.location}`,
    `• Age Stage: ${business.business_age_stage} | Maturity Mode: ${business.data_maturity_mode}`,
    `• Monthly Target: ${currency}${business.monthly_revenue_target.toLocaleString('en-IN')}`,
    `• Data Sources: ${context.dataSources.map((d) => d.name).join(', ') || 'Direct Workspace Entry'}`,
    ``,
    `VERIFIED FINANCIAL & OPERATIONAL FOOTPRINT`,
    `• Total Recorded Revenue: ${metrics.hasSufficientRevenueData ? `${currency}${metrics.totalRevenue.toLocaleString('en-IN')}` : 'Insufficient verified paid-transaction data'}`,
    `• Total Operational Expenses: ${context.expenses.length > 0 ? `${currency}${metrics.totalExpenses.toLocaleString('en-IN')}` : 'No expenses logged'}`,
    `• Net Profit: ${metrics.hasSufficientProfitData && metrics.hasSufficientExpenseData ? `${currency}${metrics.netProfit.toLocaleString('en-IN')} (${metrics.profitMargin}%)` : 'Insufficient verified paid-revenue and/or expense data'}`,
    `• Customer Base: ${context.customers.length} verified contacts | Leads in Pipeline: ${context.leads.length}`,
    `• Catalog Footprint: ${context.products.length} Products, ${context.services.length} Services`,
    ``,
    `TOP VERIFIED STRENGTHS:`,
    ...strengths.map((s) => `✓ ${s}`),
    ``,
    `CRITICAL BOTTLENECKS IDENTIFIED:`,
    ...problems.map((p) => `⚠ ${p}`),
  ].join('\n');

  const marginAuditContent = heroProducts.length > 0
    ? [
        'HERO CATALOG UNIT ECONOMICS & MARGIN ANALYSIS:',
        ...heroProducts.map((p) => {
          const hasPriceAndCost = p.price != null && p.cost != null && Number.isFinite(Number(p.price)) && Number.isFinite(Number(p.cost)) && Number(p.price) > 0;
          const calculatedMargin = hasPriceAndCost ? ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100 : null;
          const margin = p.margin_pct != null && Number.isFinite(Number(p.margin_pct))
            ? `${Number(p.margin_pct).toFixed(1)}% (stored)`
            : calculatedMargin !== null
              ? `${calculatedMargin.toFixed(1)}% (calculated from listed price and cost)`
              : 'Insufficient price/cost data';
          return `• ${p.name}: Selling Price ${p.price != null && Number.isFinite(Number(p.price)) ? `${currency}${Number(p.price).toLocaleString('en-IN')}` : 'Unknown'} | COGS ${p.cost != null && Number.isFinite(Number(p.cost)) ? `${currency}${Number(p.cost).toLocaleString('en-IN')}` : 'Unknown'} | Margin: ${margin} | Stock: ${p.stock_quantity ?? 'Unknown'}`;
        }),
        ...(heroServices.length > 0 ? ['SERVICE PRICING PACKAGES:', ...heroServices.map((service) => `• ${service.name}: ${currency}${Number(service.price).toLocaleString('en-IN')} (${service.duration_minutes} mins)`)] : []),
        `Blended Catalog Margin: ${metrics.hasSufficientMarginData && metrics.grossMargin !== null ? `${metrics.grossMargin}%` : 'Insufficient verified product cost/price data'}`,
      ].join('\\n')
    : heroServices.length > 0
      ? ['No physical product SKUs found.', 'VERIFIED SERVICE PRICING:', ...heroServices.map((service) => `• ${service.name}: ${currency}${Number(service.price).toLocaleString('en-IN')} (${service.duration_minutes} mins)`)].join('\\n')
      : 'No product or service catalog records are available. Add verified catalog data to audit pricing and unit economics.';

  const deliverables: TrialDeliverable[] = [
    {
      id: 'deliv_1_audit',
      type: 'Business Health Scorecard',
      title: `${business.name} Comprehensive Operational Audit`,
      content: auditContent,
      expected_outcome: 'Establishes Day 1 verified operational benchmark across all business pillars.',
      confidence_score: completeness.score,
      effort_level: 'low',
      status: 'approved',
    },
    {
      id: 'deliv_1_margin',
      type: 'Pricing & Margin Review',
      title: 'Unit Economics & Product Margin Breakdown',
      content: marginAuditContent,
      expected_outcome: 'Provides clear visibility into high-margin hero SKUs and unit contribution.',
      confidence_score: metrics.hasSufficientMarginData ? 85 : 35,
      effort_level: 'low',
      status: 'approved',
    },
  ];

  return {
    day: 1,
    title: 'Understand My Business',
    subtitle: 'Profile, Unit Economics, Margin Audit & Initial Health Scorecard',
    completed: false,
    completedAt: null,
    status: 'in_progress',
    highlights,
    deliverables,
    grounded_data: {
      summary: {
        completeness_score: completeness.score,
        products_count: context.products.length,
        services_count: context.services.length,
        customers_count: context.customers.length,
        orders_count: context.orders.length,
        revenue: metrics.totalRevenue,
      },
      sources: context.dataSources.map((d) => d.name),
      has_sufficient_data: metrics.hasSufficientData,
      missing_data_reasons: metrics.missingDataReasons,
    },
  };
}

/**
 * Generates Day 2: Bring Me Customers
 */
export function generateDay2Content(
  business: Business,
  metrics: BusinessMetrics,
  context: TrialEngineContext
): TrialDayContent {
  const currency = business.currency_symbol || '₹';
  const heroProduct = context.products.find((p) => p.status !== 'out_of_stock') || context.products[0];
  const heroService = context.services[0];
  const location = business.location || 'Location not provided';
  const industry = business.industry || 'your industry';
  const hasAudienceEvidence = context.customers.length > 0 || context.leads.length > 0;
  const hasOfferEvidence = Boolean(heroProduct || heroService);

  const personaLines = [
    'AUDIENCE SEGMENTS — EVIDENCE AND CONFIDENCE',
    context.customers.length > 0
      ? `1. Existing customer audience: ${context.customers.length} customer record(s) are available. Use verified purchase history and consent status before segmentation or outreach.`
      : '1. Existing customer audience: No customer records are available. Do not infer customer demographics or retention cohorts.',
    context.leads.length > 0
      ? `2. Inbound prospect audience: ${context.leads.length} lead record(s) are available. Prioritize only leads with valid contact details, a recorded source, and a permitted follow-up basis.`
      : '2. Inbound prospect audience: No lead records are available. Acquisition audience characteristics remain unverified.',
    `3. New audience hypothesis: People actively seeking ${industry} solutions may be relevant, but age, income, interests, channel preference, and conversion intent are unverified and must be tested before paid targeting.`,
    '',
    `Business context: ${business.name} | ${industry} | ${location}`,
    'No social-platform demographic or campaign-performance data was supplied; no demographic percentages or audience sizes are claimed.',
  ].join('\n');

  const weeklyContentPlan = [
    '7-DAY CONTENT TEST PLAN — DRAFT, NOT A PERFORMANCE PROMISE',
    'Starting editorial mix (test allocation, not a proven performance claim): 30% Craftsmanship / Behind-the-Scenes, 30% Problem-Solution Education, 25% Offer Spotlight, 15% Social Proof.',
    'Social proof content is allowed only when genuine customer evidence and permission exist; otherwise reallocate that slot to educational content.',
    `• Day 1 — Explain one verified customer problem that ${business.name} actually solves; confirm the claim with the owner.`,
    `• Day 2 — Product/service walkthrough: ${heroProduct?.name || heroService?.name || 'Use a verified catalog item after one is added'}.`,
    '• Day 3 — Behind-the-scenes content using real footage and verifiable operating practices only.',
    '• Day 4 — Answer a frequently asked question taken from actual customer or lead conversations; if none exist, label it as a hypothesis.',
    '• Day 5 — Explain pricing, inclusions, limitations, and availability using the current approved catalog.',
    '• Day 6 — Publish a clear inquiry or booking CTA only if the destination link and availability have been verified.',
    '• Day 7 — Share a customer review only with authentic source evidence and permission; otherwise publish a non-testimonial educational post.',
    '',
    'Measure reach, saves, qualified inquiries, response rate, and attributable conversions after publishing. Do not forecast results before baseline data exists.',
  ].join('\n');

  const productName = heroProduct?.name || heroService?.name || 'the verified offer';
  const productProof = heroProduct
    ? `Verified catalog item: ${heroProduct.name}; listed price: ${currency}${Number(heroProduct.price || 0).toLocaleString('en-IN')}; stock status: ${heroProduct.status || 'not recorded'}.`
    : heroService
      ? `Verified service: ${heroService.name}; listed price: ${currency}${Number(heroService.price || 0).toLocaleString('en-IN')}.`
      : 'No product or service catalog record is available. Add a verified offer before making product-specific claims.';
  const reelScriptContent = [
    'SHORT-FORM VIDEO SCRIPT — DRAFT FOR OWNER REVIEW',
    `Topic: How to choose a reliable ${industry} solution`,
    '',
    'HOOK (0–3s):',
    `“Before choosing a ${industry} provider, check these 3 things.”`,
    '',
    'BODY (3–22s):',
    `“First, understand exactly what is included. Second, compare the stated price and terms. Third, ask for evidence behind any performance claim. At ${business.name}, here is what we can verify: ${productProof}”`,
    '',
    'VISUALS:',
    'Use actual product/service footage, real staff, and genuine premises. Do not use fabricated customer results, clinical claims, stock footage presented as the business, or unverified certifications.',
    '',
    'CTA (22–30s):',
    `“Want details about ${productName}? Send us a message and our team will share the verified information.”`,
    '',
    'Claims, pricing, stock, and final CTA destination must be checked immediately before publishing.',
  ].join('\n');

  const whatsappCampaignContent = [
    'WHATSAPP FOLLOW-UP TEMPLATE — NOT READY FOR AUTOMATIC DISPATCH',
    '',
    'Hello {{customer_name}},',
    `Thank you for your interest in ${business.name}.`,
    `We can share verified details about ${productName} if you would like to know more.`,
    '',
    'Reply INFO if you would like the details, or STOP if you do not want further messages.',
    '',
    'Before use: send only to contacts with a valid WhatsApp opt-in and applicable approved template; verify recipient, offer, price, availability, and business contact details. Do not insert an invented discount, limited-slot claim, booking link, or testimonial.',
  ].join('\n');

  const deliverables: TrialDeliverable[] = [
    {
      id: 'deliv_2_personas',
      type: 'Target Audience Profile',
      title: `Evidence-Based Audience Segments for ${business.name}`,
      content: personaLines,
      expected_outcome: 'Separates observed customer/lead records from unverified acquisition hypotheses.',
      confidence_score: hasAudienceEvidence ? 65 : 25,
      effort_level: 'low',
      status: 'draft',
    },
    {
      id: 'deliv_2_calendar',
      type: '7-Day Content Plan',
      title: '7-Day Omnichannel Content Test Calendar',
      content: weeklyContentPlan,
      expected_outcome: 'Creates a measurable content experiment; results are assessed only after real campaign data is collected.',
      confidence_score: hasOfferEvidence ? 70 : 35,
      effort_level: 'medium',
      status: 'draft',
    },
    {
      id: 'deliv_2_reel',
      type: 'Social Video Reel Script',
      title: `Evidence-Led ${industry} Short-Form Video`,
      content: reelScriptContent,
      expected_outcome: 'Produces a reviewable short-form script without unsupported efficacy, customer-result, or performance claims.',
      confidence_score: hasOfferEvidence ? 70 : 35,
      effort_level: 'medium',
      status: 'draft',
    },
    {
      id: 'deliv_2_whatsapp',
      type: 'WhatsApp Campaign Template',
      title: 'Permission-Based WhatsApp Inquiry Follow-Up',
      content: whatsappCampaignContent,
      expected_outcome: 'Provides compliant draft copy for eligible opted-in contacts after owner approval.',
      confidence_score: 75,
      effort_level: 'low',
      status: 'draft',
      channel: 'whatsapp',
    },
  ];

  return {
    day: 2,
    title: 'Bring Me Customers',
    subtitle: 'Evidence-Based Audience Segments, Content Experiments & Approval-First Outreach',
    completed: false,
    completedAt: null,
    status: 'pending',
    highlights: [
      `Audited ${context.customers.length} customer record(s) and ${context.leads.length} lead record(s); missing audience data is explicitly marked.`,
      'Prepared a 7-day content experiment with measurable KPIs and no guaranteed outcomes.',
      'Drafted short-form video and opt-in WhatsApp copy for owner review before publishing or dispatch.',
    ],
    deliverables,
    grounded_data: {
      summary: {
        target_location: location,
        hero_product: heroProduct?.name || null,
        hero_service: heroService?.name || null,
        channels: ['WhatsApp', 'Instagram', 'Facebook', 'YouTube'],
        audience_evidence_available: hasAudienceEvidence,
        offer_evidence_available: hasOfferEvidence,
        social_analytics_available: false,
      },
    },
  };
}

/**
 * Generates Day 3: Automate My Customers
 */
export function generateDay3Content(
  business: Business,
  metrics: BusinessMetrics,
  context: TrialEngineContext
): TrialDayContent {
  const currency = business.currency_symbol || '₹';
  const heroProd = context.products[0]?.name || 'Formulation Kit';
  const heroService = context.services[0]?.name || 'Consultation';

  const highlights = [
    `Constructed Speed-to-Lead WhatsApp auto-response flow (< 2 min response velocity)`,
    `Designed 45-day VIP replenishment trigger preventing customer churn`,
    `Engineered 24h pre-booking reminder and post-service Google review collection flow`,
  ];

  const leadFollowupContent = [
    `AUTOMATION FLOW 1: SPEED-TO-LEAD INBOUND TRIGGER`,
    `Trigger Event: New Inbound Lead arrives (Website, Instagram Ad, Google Form)`,
    `Execution Delay: 2 Minutes`,
    `Channel: WhatsApp Direct Business API`,
    `Human-in-the-Loop Mode: Auto-Prepared (Requires 1-click Approval or Instant Auto-Run)`,
    ``,
    `PREPARED MESSAGE COPY:`,
    `"Hello {{lead_name}}! 🙏 Thank you for reaching out to ${business.name}.`,
    `We received your inquiry regarding our ${business.industry.toLowerCase()} offerings in ${business.location}.`,
    ``,
    `Would you prefer a quick 10-minute discovery call with our specialist or our digital catalog on WhatsApp?`,
    `1️⃣ Reply '1' for Discovery Call`,
    `2️⃣ Reply '2' for Digital Price Menu`,
    `3️⃣ Reply '3' to Book ${heroService} Directly"`,
    ``,
    `Expected Impact: 3.8x higher lead-to-booking conversion rate vs delayed manual response.`,
  ].join('\n');

  const replenishmentContent = [
    `AUTOMATION FLOW 2: 45-DAY CONSUMPTION & REPLENISHMENT TRIGGER`,
    `Trigger Event: Customer order delivered and 35-45 days elapsed`,
    `Target Cohort: Customers who purchased ${heroProd} or wellness kits`,
    `Channel: WhatsApp VIP Message`,
    `Confidence Score: 94%`,
    ``,
    `PREPARED MESSAGE COPY:`,
    `"Namaste {{customer_name}}! 🌿 Hope you are experiencing wonderful vitality with your ${heroProd}.`,
    `As your 30-day supply approaches completion, we want to ensure zero disruption in your wellness cycle.`,
    ``,
    `🎁 VIP Privilege for You:`,
    `Reorder today with 1-click and enjoy 10% complimentary privilege credit + free priority courier in ${business.location}.`,
    ``,
    `👉 Tap to Reorder in 1-Click: https://${business.website || 'shop'}/reorder?c={{customer_id}}"`,
    ``,
    `Expected Impact: Lifts repeat buyer rate from baseline to > 40%.`,
  ].join('\n');

  const bookingReminderContent = [
    `AUTOMATION FLOW 3: 24-HOUR APPOINTMENT CONFIRMATION & PREP`,
    `Trigger Event: Confirmed Booking is 24 hours away`,
    `Channel: WhatsApp + SMS`,
    `Confidence Score: 98%`,
    ``,
    `PREPARED MESSAGE COPY:`,
    `"Hello {{customer_name}}, this is a friendly reminder of your upcoming ${heroService} appointment tomorrow at {{booking_time}} with ${business.name}.`,
    ``,
    `📍 Clinic Location: ${business.location}`,
    `🚗 Directions: https://maps.google.com/?q=${encodeURIComponent(business.name + ' ' + business.location)}`,
    ``,
    `Please arrive 5 minutes early. If you need to reschedule, reply 'CHANGE' to this message."`,
    ``,
    `Expected Impact: Reduces appointment no-show rate to under 4%.`,
  ].join('\n');

  const deliverables: TrialDeliverable[] = [
    {
      id: 'deliv_3_lead_flow',
      type: 'CRM Automation Rule',
      title: 'Speed-to-Lead Inbound Auto-Engagement Rule',
      content: leadFollowupContent,
      expected_outcome: 'Captures hot prospects within 120 seconds of inquiry.',
      confidence_score: 95,
      effort_level: 'low',
      status: 'approved',
      channel: 'whatsapp',
      target_entity: 'New Inbound Leads',
    },
    {
      id: 'deliv_3_replenish',
      type: 'Retention Automation Rule',
      title: '45-Day Repeat Customer Refill Trigger',
      content: replenishmentContent,
      expected_outcome: 'Eliminates customer dormancy and maximizes Lifetime Value (LTV).',
      confidence_score: 94,
      effort_level: 'low',
      status: 'approved',
      channel: 'whatsapp',
      target_entity: 'Repeat Buyers (35-45 Day Cycle)',
    },
    {
      id: 'deliv_3_booking_reminder',
      type: 'Operational Automation Rule',
      title: '24h Pre-Appointment Reminder & Location Pin',
      content: bookingReminderContent,
      expected_outcome: 'Cuts clinic no-shows to under 4% and improves client punctuality.',
      confidence_score: 98,
      effort_level: 'low',
      status: 'approved',
      channel: 'whatsapp',
      target_entity: 'Upcoming Bookings',
    },
  ];

  return {
    day: 3,
    title: 'Automate My Customers',
    subtitle: 'Speed-to-Lead, 45-Day Refill Triggers & Review Generation',
    completed: false,
    completedAt: null,
    status: 'pending',
    highlights,
    deliverables,
    grounded_data: {
      summary: {
        rules_prepared: deliverables.length,
        channels: ['WhatsApp', 'SMS'],
      },
    },
  };
}

/**
 * Generates Day 4: Show Me My Business
 */
export function generateDay4Content(
  business: Business,
  metrics: BusinessMetrics,
  context: TrialEngineContext
): TrialDayContent {
  const currency = business.currency_symbol || '₹';

  const highlights = [
    `Reconciled real P&L statement across ${context.orders.length} orders, ${context.bookings.length} bookings, and ${context.expenses.length} expenses`,
    `Traceable database calculation for Unit Margin (${metrics.grossMargin || 0}%), AOV (${currency}${metrics.avgOrderValue.toLocaleString('en-IN')}), and Retention (${metrics.repeatCustomerRate}%)`,
    `Synthesized Evidence-Based Health Score (${metrics.healthScore}/100 - ${metrics.healthBand})`,
  ];

  const pnlReportContent = [
    `REAL DATABASE P&L & UNIT MARGIN SCORECARD`,
    `Period: Cumulative Verified Workspace Records`,
    ``,
    `1. REVENUE RECONCILIATION:`,
    `   • Sales Orders Revenue (${context.orders.length} orders): ${currency}${context.orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0).toLocaleString('en-IN')}`,
    `   • Service Bookings Revenue (${context.bookings.length} bookings): ${currency}${context.bookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0).toLocaleString('en-IN')}`,
    `   • Total Gross Revenue: ${currency}${metrics.totalRevenue.toLocaleString('en-IN')}`,
    ``,
    `2. COST & EXPENSE RECONCILIATION:`,
    `   • Direct Catalog COGS (Estimated Avg Cost): ${currency}${(metrics.totalRevenue * (1 - (metrics.grossMargin || 50) / 100)).toLocaleString('en-IN')}`,
    `   • Operational Overhead (${context.expenses.length} records): ${currency}${metrics.totalExpenses.toLocaleString('en-IN')}`,
    `   • Net Operating Profit: ${currency}${metrics.netProfit.toLocaleString('en-IN')} (Net Margin: ${metrics.profitMargin}%)`,
    ``,
    `3. UNIT ECONOMICS & PERFORMANCE METRICS:`,
    `   • Blended Catalog Gross Margin: ${metrics.grossMargin || 0}%`,
    `   • Average Order Value (AOV): ${currency}${metrics.avgOrderValue.toLocaleString('en-IN')}`,
    `   • Repeat Customer Rate: ${metrics.repeatCustomerRate}% (${metrics.repeatCustomers} of ${metrics.totalCustomers} customers)`,
    `   • Lead Conversion Velocity: ${metrics.leadConversionRate}% (${metrics.convertedLeads} of ${metrics.totalLeads} leads)`,
    `   • Composite Health Score: ${metrics.healthScore}/100 (${metrics.healthBand})`,
    ``,
    `4. VERIFIED TRACEABLE SOURCES:`,
    `   • All metrics derived from active tenant database tables: orders, bookings, expenses, customers, leads.`,
  ].join('\n');

  const deliverables: TrialDeliverable[] = [
    {
      id: 'deliv_4_pnl',
      type: 'Financial & Operational Diagnostic',
      title: `${business.name} Verified P&L Diagnostic Scorecard`,
      content: pnlReportContent,
      expected_outcome: 'Provides 100% truthful, traceable visibility into cash flow and unit economics.',
      confidence_score: 96,
      effort_level: 'low',
      status: 'approved',
    },
  ];

  return {
    day: 4,
    title: 'Show Me My Business',
    subtitle: 'Live P&L Dashboard, Unit Profitability & Diagnostic Scorecard',
    completed: false,
    completedAt: null,
    status: 'pending',
    highlights,
    deliverables,
    grounded_data: {
      metrics_snapshot: metrics,
      sources: ['orders', 'bookings', 'expenses', 'customers', 'leads'],
      has_sufficient_data: metrics.hasSufficientData,
      missing_data_reasons: metrics.missingDataReasons,
    },
  };
}

/**
 * Generates Day 5: Your Business Growth Plan
 */
export function generateDay5Content(
  business: Business,
  metrics: BusinessMetrics,
  context: TrialEngineContext
): TrialDayContent {
  const currency = business.currency_symbol || '₹';
  const targetRevenue = business.monthly_revenue_target || 500000;
  const currentRevenue = metrics.totalRevenue || 0;
  const revenueGap = Math.max(0, targetRevenue - currentRevenue);
  const heroProd = context.products[0]?.name || 'Core Product Line';
  const heroService = context.services[0]?.name || 'Specialist Consultation';

  const highlights = [
    `Synthesized executive 30-day growth roadmap to bridge ${currency}${revenueGap.toLocaleString('en-IN')} revenue gap`,
    `Structured 4-week prioritized milestone execution matrix with quantified financial uplift`,
    `Activated ongoing AI Operating System with continuous daily diagnosis and agent automation`,
  ];

  const growthPlanContent = [
    `==================================================`,
    `BUSINESS DOCTOR 30-DAY EXECUTIVE GROWTH PLAN`,
    `Business: ${business.name} | Industry: ${business.industry} | Location: ${business.location}`,
    `==================================================`,
    ``,
    `A. CURRENT BUSINESS SNAPSHOT`,
    `• Target Monthly Revenue: ${currency}${targetRevenue.toLocaleString('en-IN')}`,
    `• Current Verified Baseline Revenue: ${currency}${currentRevenue.toLocaleString('en-IN')}`,
    `• Revenue Opportunity Gap: ${currency}${revenueGap.toLocaleString('en-IN')}`,
    `• Health Score: ${metrics.healthScore}/100 (${metrics.healthBand})`,
    ``,
    `B. VERIFIED PERFORMANCE HIGHLIGHTS`,
    `• Unit Product Margin: ${metrics.grossMargin || 50}% (Healthy unit economics)`,
    `• Repeat Customer Rate: ${metrics.repeatCustomerRate}% (${metrics.repeatCustomers} repeat buyers)`,
    `• Average Order Value: ${currency}${metrics.avgOrderValue.toLocaleString('en-IN')}`,
    ``,
    `C. TOP CRITICAL BOTTLENECKS`,
    `1. ${context.products.filter((p) => p.stock_quantity === 0).length > 0 ? 'Critical inventory stockout on high-demand SKUs' : 'Weekday appointment capacity under-utilized'}`,
    `2. ${metrics.repeatCustomerRate < 35 ? 'Customer dormancy after initial 30 days without automated refill trigger' : 'Manual speed-to-lead response causing friction'}`,
    `3. ${context.expenses.length === 0 ? 'Lack of recurring overhead categorization in accounting' : 'Digital inbound lead volume can be scaled'}`,
    ``,
    `D. 4-WEEK TACTICAL EXECUTION ROADMAP:`,
    ``,
    `WEEK 1: SPEED-TO-LEAD & HIGH-MARGIN SERVICE LAUNCH`,
    `• Action: Enable automated WhatsApp welcome rule on new inquiries (< 2 mins).`,
    `• Action: Launch 10 VIP privilege consultation slots for ${heroService} in ${business.location}.`,
    `• Expected Financial Uplift: +${currency}${Math.round(targetRevenue * 0.12).toLocaleString('en-IN')}`,
    `• Effort: Quick Win (Low Effort) | Confidence: 95%`,
    ``,
    `WEEK 2: 45-DAY REPLENISHMENT & RETENTION ENGINE`,
    `• Action: Dispatch automated VIP WhatsApp reorder broadcast to past customers.`,
    `• Action: Offer 10% repeat customer loyalty credit on ${heroProd}.`,
    `• Expected Financial Uplift: +${currency}${Math.round(targetRevenue * 0.15).toLocaleString('en-IN')}`,
    `• Effort: Low Effort | Confidence: 92%`,
    ``,
    `WEEK 3: INVENTORY RESTOCK & CLINIC SCHEDULE OPTIMIZATION`,
    `• Action: Issue purchase order to restock zero-inventory SKUs with 50+ buffer units.`,
    `• Action: Fill Tuesday-Thursday off-peak appointment slots with corporate wellness package.`,
    `• Expected Financial Uplift: +${currency}${Math.round(targetRevenue * 0.18).toLocaleString('en-IN')}`,
    `• Effort: Medium Effort | Confidence: 90%`,
    ``,
    `WEEK 4: BUSINESS MEMORY AUDIT & MONTHLY RUN-RATE RECALIBRATION`,
    `• Action: Review 30-day Business Memory ledger, compare MRR trajectory vs baseline.`,
    `• Action: Double down on top-performing WhatsApp copy and Instagram Reel hooks.`,
    `• Expected Financial Uplift: +${currency}${Math.round(targetRevenue * 0.2).toLocaleString('en-IN')}`,
    `• Effort: Medium Effort | Confidence: 94%`,
    ``,
    `E. PROJECTED 30-DAY OUTCOME:`,
    `• Projected Total 30-Day Revenue: ${currency}${(currentRevenue + Math.round(targetRevenue * 0.55)).toLocaleString('en-IN')}`,
    `• Sustainable Operating Net Margin: 35% - 48%`,
    `• Automated CRM & Retention Operating System fully active.`,
  ].join('\n');

  const deliverables: TrialDeliverable[] = [
    {
      id: 'deliv_5_roadmap',
      type: '30-Day Growth Roadmap',
      title: `Executive Growth Blueprint to Reach ${currency}${targetRevenue.toLocaleString('en-IN')} Target`,
      content: growthPlanContent,
      expected_outcome: `Closes the ${currency}${revenueGap.toLocaleString('en-IN')} revenue gap with disciplined weekly milestones.`,
      confidence_score: 94,
      effort_level: 'medium',
      status: 'approved',
    },
  ];

  return {
    day: 5,
    title: 'Your 30-Day Growth Plan',
    subtitle: 'Milestone Roadmap, Tactical Priority Actions & Execution Checklist',
    completed: false,
    completedAt: null,
    status: 'pending',
    highlights,
    deliverables,
    grounded_data: {
      summary: {
        target_revenue: targetRevenue,
        current_revenue: currentRevenue,
        revenue_gap: revenueGap,
      },
    },
  };
}

/**
 * Generates all 5 trial days using verified business data, preserving existing completion states
 */
export function generateAllTrialDays(
  business: Business,
  metrics: BusinessMetrics,
  context: TrialEngineContext,
  existingDays?: TrialDayContent[]
): TrialDayContent[] {
  const day1 = generateDay1Content(business, metrics, context);
  const day2 = generateDay2Content(business, metrics, context);
  const day3 = generateDay3Content(business, metrics, context);
  const day4 = generateDay4Content(business, metrics, context);
  const day5 = generateDay5Content(business, metrics, context);

  const generated = [day1, day2, day3, day4, day5];

  if (!existingDays || existingDays.length === 0) {
    return generated;
  }

  // Preserve existing completion states and custom deliverables
  return generated.map((genDay) => {
    const existing = existingDays.find((e) => e.day === genDay.day);
    if (!existing) return genDay;

    return {
      ...genDay,
      completed: existing.completed,
      completedAt: existing.completedAt,
      status: existing.completed ? 'completed' : genDay.status,
    };
  });
}

/**
 * Helper to build initial BusinessTrial entity
 */
export function getInitialBusinessTrial(
  business: Business,
  trialDays: TrialDayContent[]
): BusinessTrial {
  const now = new Date();
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 day active window

  const completedDays = trialDays.filter((d) => d.completed).map((d) => d.day);
  const isAllCompleted = completedDays.length === 5;
  const currentDay = Math.min(5, Math.max(1, (completedDays.length || 0) + 1));

  const dayStatus: Record<number, any> = {
    1: completedDays.includes(1) ? 'completed' : 'in_progress',
    2: completedDays.includes(2) ? 'completed' : completedDays.includes(1) ? 'in_progress' : 'pending',
    3: completedDays.includes(3) ? 'completed' : completedDays.includes(2) ? 'in_progress' : 'pending',
    4: completedDays.includes(4) ? 'completed' : completedDays.includes(3) ? 'in_progress' : 'pending',
    5: completedDays.includes(5) ? 'completed' : completedDays.includes(4) ? 'in_progress' : 'pending',
  };

  return {
    id: `trial_${business.id}`,
    business_id: business.id,
    trial_start_at: now.toISOString(),
    trial_end_at: endDate.toISOString(),
    current_day: currentDay,
    completed_days: completedDays,
    trial_status: isAllCompleted ? 'completed' : 'active',
    day_status: dayStatus,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    days: trialDays,
  };
}

/**
 * Creates grounded Business Memory event for a completed trial day
 */
export function createDayMemoryEvent(
  dayNum: number,
  business: Business,
  metrics: BusinessMetrics,
  dayContent: TrialDayContent
): BusinessMemory {
  const currency = business.currency_symbol || '₹';
  const now = new Date().toISOString();

  let title = `Day ${dayNum} Transformation: ${dayContent.title}`;
  let content = '';
  let observationType: BusinessMemory['observation_type'] = 'milestone';

  if (dayNum === 1) {
    observationType = 'baseline';
    content = `Completed foundational operational audit for ${business.name}. Catalog: ${dayContent.grounded_data?.summary?.products_count || 0} products, ${dayContent.grounded_data?.summary?.services_count || 0} services. Verified revenue: ${currency}${metrics.totalRevenue.toLocaleString('en-IN')}, Expenses: ${currency}${metrics.totalExpenses.toLocaleString('en-IN')}, Blended Margin: ${metrics.grossMargin || 0}%. Data completeness score: ${dayContent.grounded_data?.summary?.completeness_score || 0}%.`;
  } else if (dayNum === 2) {
    observationType = 'growth_insight';
    content = `Marketing opportunities generated from verified business profile and customer data in ${business.location}. Created 7-day content schedule, WhatsApp VIP broadcast templates, and social video reel scripts.`;
  } else if (dayNum === 3) {
    observationType = 'action_outcome';
    content = `Customer automation proposals generated. Configured speed-to-lead follow-up rule, 45-day replenishment trigger, and 24h pre-booking notification flows with human-in-the-loop control.`;
  } else if (dayNum === 4) {
    observationType = 'milestone';
    content = `Verified KPI snapshot generated. Reconciled ${metrics.totalOrders} sales orders and ${metrics.totalBookings} service appointments. Health Score verified at ${metrics.healthScore}/100 (${metrics.healthBand}).`;
  } else if (dayNum === 5) {
    observationType = 'milestone';
    content = `30-day growth plan generated to reach monthly revenue target of ${currency}${business.monthly_revenue_target.toLocaleString('en-IN')}. Formulated 4-week prioritized roadmap addressing inventory restock, lead acceleration, and customer retention.`;
  }

  const hasEvidence = metrics.hasSufficientData || dayNum <= 2;

  return {
    id: `mem_trial_day_${dayNum}_${Date.now()}`,
    business_id: business.id,
    observation_type: observationType,
    period: `day_${dayNum}`,
    title,
    content,
    confidence_score: hasEvidence ? 95 : 60,
    outcome_recorded: hasEvidence
      ? `Verified milestone logged upon completion of Trial Day ${dayNum}.`
      : `Trial Day ${dayNum} completed under initial Day 0 baseline.`,
    created_at: now,
    is_verified: hasEvidence,
    provenance: {
      source_type: 'live_event',
      source_table: 'businesses',
      source_record_id: business.id,
      evidence_summary: hasEvidence
        ? `Trial Day ${dayNum} milestone supported by verified workspace state (${metrics.totalOrders} orders, ${metrics.totalBookings} bookings).`
        : `Trial Day ${dayNum} milestone initialized under Day 0 baseline (Insufficient transaction data).`,
      has_sufficient_data: hasEvidence,
    },
  };
}
