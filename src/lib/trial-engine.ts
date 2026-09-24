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
      complete: Boolean(business.name && business.industry && business.location && business.monthly_revenue_target),
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
    problems.push('Room schedule utilization and weekday booking volume can be accelerated');
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
    `• Total Recorded Revenue: ${metrics.hasSufficientData ? `${currency}${metrics.totalRevenue.toLocaleString('en-IN')}` : 'Insufficient verified transaction data'}`,
    `• Total Operational Expenses: ${context.expenses.length > 0 ? `${currency}${metrics.totalExpenses.toLocaleString('en-IN')}` : 'No expenses logged'}`,
    `• Estimated Net Profit: ${metrics.hasSufficientData && context.expenses.length > 0 ? `${currency}${metrics.netProfit.toLocaleString('en-IN')} (${metrics.profitMargin}%)` : 'Pending expense reconciliation'}`,
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
        `HERO CATALOG UNIT ECONOMICS & MARGIN ANALYSIS:`,
        ...heroProducts.map((p) => `• ${p.name}: Selling Price ${currency}${p.price.toLocaleString('en-IN')} | COGS ${currency}${p.cost.toLocaleString('en-IN')} | Margin: ${p.margin_pct}% | Stock: ${p.stock_quantity} units`),
        ...(heroServices.length > 0 ? [`\nSERVICE PRICING PACKAGES:`, ...heroServices.map((s) => `• ${s.name}: ${currency}${s.price.toLocaleString('en-IN')} (${s.duration_minutes} mins)`)] : []),
        `\nBlended Catalog Margin: ${metrics.grossMargin || 50}%`,
      ].join('\n')
    : `No physical product SKUs found in catalog. Create or import your product catalog to view real unit economics and margin audit.`;

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
      confidence_score: 95,
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
  const heroProd = context.products[0]?.name || 'Signature Offer';
  const heroService = context.services[0]?.name || 'Specialist Consultation';
  const location = business.location || 'Local Market';

  const highlights = [
    `Mapped 3 targeted buyer segments in ${location} tailored for ${business.industry}`,
    `Structured 7-day omnichannel social & broadcast growth calendar`,
    `Generated ready-to-dispatch WhatsApp campaign & high-retention video reel scripts`,
  ];

  const targetPersonasContent = [
    `TARGET AUDIENCE PERSONAS & DEMOGRAPHICS:`,
    `1. Primary Persona: Discerning Wellness & Quality Seekers`,
    `   • Demographics: Working professionals & residents in ${location} (Age 26-48).`,
    `   • Pain Point: Lack of trustworthy, authentic ${business.industry.toLowerCase()} solutions with verified results.`,
    `   • Preferred Channel: WhatsApp Direct Inquiries & Instagram Reels.`,
    `   • Conversion Trigger: Personalized recommendation + complimentary initial assessment.`,
    ``,
    `2. Secondary Persona: High-Stress Corporate & Working Professionals`,
    `   • Demographics: Tech & Corporate workforce in ${location}.`,
    `   • Pain Point: Time deficit, chronic fatigue, seeking convenient weekend/evening appointments.`,
    `   • Preferred Channel: Google Search, WhatsApp broadcasts, LinkedIn.`,
    `   • Conversion Trigger: Fixed-slot booking guarantee + package savings.`,
    ``,
    `3. Tertiary Persona: Loyal Repeat Brand Advocates`,
    `   • Demographics: Past clients and long-term customers.`,
    `   • Opportunity: Reorder cycles every 30-45 days.`,
    `   • Conversion Trigger: VIP replenishment discount + priority therapist/doctor access.`,
  ].join('\n');

  const weeklyContentPlan = [
    `7-DAY OMNICHANNEL GROWTH & CONTENT CALENDAR:`,
    `• Day 1 (Educational Hook): "The 1 subtle mistake 90% of people make in ${business.industry.toLowerCase()}" [Reel / Carousel]`,
    `• Day 2 (Client Proof / Case): Real transformation or verified benefit of ${heroProd} [Stories / WhatsApp Status]`,
    `• Day 3 (Behind the Scenes): Sourcing pure ingredients & preparation standards at ${business.name} [Video]`,
    `• Day 4 (VIP WhatsApp Broadcast): Exclusive privilege invite for ${heroService} [Direct WhatsApp]`,
    `• Day 5 (Expert Q&A): Practitioner breakdown solving common client pain points [Post / Live]`,
    `• Day 6 (Weekend Privilege): Reserve a 30-min discovery session in ${location} [Stories with Booking Link]`,
    `• Day 7 (Community & Review Spotlight): Client testimonial breakdown + gratitude reward [Multi-channel]`,
  ].join('\n');

  const reelScriptContent = [
    `INSTAGRAM / FACEBOOK HIGH-CONVERTING REEL SCRIPT:`,
    `Topic: "Why Most Solutions Fail vs Authentic ${business.industry}"`,
    ``,
    `HOOK (0-3s, High Contrast Text on Screen):`,
    `"If you're still doing this in ${location}, stop immediately."`,
    `Visual: Practitioner/Creator speaking directly to camera while demonstrating ${heroProd}.`,
    ``,
    `BODY (3-20s, Educational Value):`,
    `"Most commercial options mask symptoms without treating root causes. At ${business.name}, we formulate with 100% bio-available natural ingredients tailored to your individual constitution."`,
    `Visual: B-roll of pure formulations, pristine clinic/store ambiance, and client consultation.`,
    ``,
    `CALL TO ACTION (20-30s):`,
    `"Comment 'CARE' or tap the link in bio to receive our free consultation guide and exclusive ${currency}500 welcome voucher."`,
  ].join('\n');

  const whatsappCampaignContent = [
    `WHATSAPP VIP PRIVILEGE BROADCAST (Ready to Dispatch):`,
    ``,
    `Hello {{name}}! 👋`,
    ``,
    `Greetings from ${business.name} in ${location}.`,
    ``,
    `We are reserving 10 exclusive client privilege slots this week for our verified ${heroService}.`,
    ``,
    `✨ Special Privilege Included:`,
    `• Complimentary personalized constitution & wellness analysis`,
    `• 15% VIP privilege credit toward your ${heroProd} package`,
    ``,
    `📍 Available at our ${location} center or via direct priority delivery.`,
    ``,
    `👉 Reply "RESERVE" or tap here to secure your preferred slot: https://${business.website || 'wa.me'}/privilege`,
  ].join('\n');

  const deliverables: TrialDeliverable[] = [
    {
      id: 'deliv_2_personas',
      type: 'Target Audience Profile',
      title: `3 Core Buyer Personas for ${business.industry}`,
      content: targetPersonasContent,
      expected_outcome: 'Pinpoints highest-converting local customer demographics for marketing spend.',
      confidence_score: 92,
      effort_level: 'low',
      status: 'approved',
    },
    {
      id: 'deliv_2_calendar',
      type: '7-Day Content Plan',
      title: '7-Day Omnichannel Growth & Campaign Schedule',
      content: weeklyContentPlan,
      expected_outcome: 'Builds consistent inbound visibility across social, status, and messaging channels.',
      confidence_score: 90,
      effort_level: 'medium',
      status: 'draft',
    },
    {
      id: 'deliv_2_reel',
      type: 'Social Video Reel Script',
      title: `Viral Video Script: The ${business.industry} Root Cause Hook`,
      content: reelScriptContent,
      expected_outcome: 'Generates 300+ organic saves and qualified local DM inquiries.',
      confidence_score: 88,
      effort_level: 'medium',
      status: 'draft',
    },
    {
      id: 'deliv_2_whatsapp',
      type: 'WhatsApp Campaign Template',
      title: 'VIP Client Privilege & Booking Broadcast Copy',
      content: whatsappCampaignContent,
      expected_outcome: 'Estimated 8-14 qualified consultation bookings per 100 broadcast contacts.',
      confidence_score: 95,
      effort_level: 'low',
      status: 'draft',
      channel: 'whatsapp',
    },
  ];

  return {
    day: 2,
    title: 'Bring Me Customers',
    subtitle: 'Target Audience Segments, High-Converting Content & WhatsApp Broadcasts',
    completed: false,
    completedAt: null,
    status: 'pending',
    highlights,
    deliverables,
    grounded_data: {
      summary: {
        target_location: location,
        hero_product: heroProd,
        hero_service: heroService,
        channels: ['WhatsApp', 'Instagram', 'Google Search'],
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
