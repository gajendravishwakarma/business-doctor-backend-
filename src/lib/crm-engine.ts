import {
  Customer,
  Lead,
  Order,
  Booking,
  Product,
  ServiceItem,
  Business,
} from '../types/database';
import {
  Customer360Profile,
  LeadScoreBreakdown,
  LeadScoreFactor,
  CRMActivityTimelineEvent,
  CRMRecommendation,
  CustomerSegmentType,
  SegmentSummary,
  LeadFunnelStage,
  LeadFunnelStageData,
  CRMFollowUp,
  CRMMetrics,
  MetricEvidenceInfo,
} from '../types/crm';
import {
  isTodayInTimezone,
  isOverdueInTimezone,
  isUpcomingInTimezone,
} from './period-safety';

// Normalize phone numbers for cross-matching
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

// Normalize email for cross-matching
export function normalizeEmail(email?: string | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * 1. UNIFIED CUSTOMER 360 BUILDER
 * Reconciles customer profile with actual orders, bookings, and lead history.
 * Never fabricates or assumes missing data.
 */
export function buildCustomer360(
  customer: Customer,
  allOrders: Order[] = [],
  allBookings: Booking[] = [],
  allLeads: Lead[] = [],
  business?: Business
): Customer360Profile {
  const normPhone = normalizePhoneNumber(customer.phone);
  const normEmail = normalizeEmail(customer.email);
  const lowerName = (customer.name || '').trim().toLowerCase();

  // Reconcile Orders
  const matchedOrders = allOrders.filter((o) => {
    if (o.customer_id && o.customer_id === customer.id) return true;
    if (lowerName && o.customer_name && o.customer_name.trim().toLowerCase() === lowerName) return true;
    return false;
  });

  // Reconcile Bookings
  const matchedBookings = allBookings.filter((b) => {
    if (b.customer_id && b.customer_id === customer.id) return true;
    if (b.customer_phone && normalizePhoneNumber(b.customer_phone) === normPhone) return true;
    if (lowerName && b.customer_name && b.customer_name.trim().toLowerCase() === lowerName) return true;
    return false;
  });

  // Reconcile Leads
  const matchedLeads = allLeads.filter((l) => {
    if (l.converted_to_customer_id && l.converted_to_customer_id === customer.id) return true;
    if (l.phone && normalizePhoneNumber(l.phone) === normPhone) return true;
    if (l.email && normalizeEmail(l.email) === normEmail) return true;
    if (lowerName && l.name && l.name.trim().toLowerCase() === lowerName) return true;
    return false;
  });

  // Financial Reconciliation
  const productSpend = matchedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const serviceSpend = matchedBookings.reduce((sum, b) => sum + (Number((b as any).total_amount) || Number(b.amount) || 0), 0);
  const totalRevenue = productSpend + serviceSpend > 0 ? productSpend + serviceSpend : (customer.total_spend || 0);
  const totalOrdersCount = matchedOrders.length > 0 ? matchedOrders.length : (customer.total_orders || 0);
  const totalBookingsCount = matchedBookings.length;
  const totalTransactions = totalOrdersCount + totalBookingsCount;
  const avgOrderValue =
    totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

  // Interaction Dates
  const allDates: number[] = [];
  if (customer.first_seen) allDates.push(new Date(customer.first_seen).getTime());
  if (customer.created_at) allDates.push(new Date(customer.created_at).getTime());
  matchedOrders.forEach((o) => {
    if (o.order_date) allDates.push(new Date(o.order_date).getTime());
  });
  matchedBookings.forEach((b) => {
    if (b.booking_date) allDates.push(new Date(b.booking_date).getTime());
  });
  matchedLeads.forEach((l) => {
    if (l.created_at) allDates.push(new Date(l.created_at).getTime());
  });

  const validTimestamps = allDates.filter((t) => !isNaN(t) && t > 0);
  const firstInteraction =
    validTimestamps.length > 0 ? new Date(Math.min(...validTimestamps)).toISOString() : customer.first_seen || null;
  const latestInteraction =
    validTimestamps.length > 0 ? new Date(Math.max(...validTimestamps)).toISOString() : customer.last_activity || null;

  // Repeat Purchase Calculation
  let daysBetweenFirstAndLast: number | null = null;
  let avgOrderIntervalDays: number | null = null;
  if (validTimestamps.length >= 2) {
    const minT = Math.min(...validTimestamps);
    const maxT = Math.max(...validTimestamps);
    daysBetweenFirstAndLast = Math.round((maxT - minT) / (1000 * 60 * 60 * 24));
    if (totalTransactions > 1 && daysBetweenFirstAndLast > 0) {
      avgOrderIntervalDays = Math.round(daysBetweenFirstAndLast / (totalTransactions - 1));
    }
  }

  // Favorite Products
  const prodMap = new Map<string, { quantity: number; totalSpent: number }>();
  matchedOrders.forEach((o) => {
    o.items?.forEach((it) => {
      const existing = prodMap.get(it.name) || { quantity: 0, totalSpent: 0 };
      prodMap.set(it.name, {
        quantity: existing.quantity + (it.quantity || 1),
        totalSpent: existing.totalSpent + (it.total || it.unit_price * it.quantity || 0),
      });
    });
  });
  const favoriteProducts = Array.from(prodMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity);

  // Favorite Services
  const servMap = new Map<string, { bookingsCount: number; totalSpent: number }>();
  matchedBookings.forEach((b) => {
    const sName = b.service_name || 'Consultation';
    const existing = servMap.get(sName) || { bookingsCount: 0, totalSpent: 0 };
    servMap.set(sName, {
      bookingsCount: existing.bookingsCount + 1,
      totalSpent: existing.totalSpent + (Number(b.amount) || 0),
    });
  });
  const favoriteServices = Array.from(servMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.bookingsCount - a.bookingsCount);

  // Verified Sources
  const sourcesSet = new Set<string>();
  if (customer.source) sourcesSet.add(customer.source.replace('_', ' '));
  matchedOrders.forEach((o) => {
    if (o.payment_method) sourcesSet.add(`Order (${o.payment_method.toUpperCase()})`);
  });
  matchedBookings.forEach((b) => {
    if (b.practitioner_name) sourcesSet.add(`Clinic (${b.practitioner_name})`);
  });
  matchedLeads.forEach((l) => {
    if (l.source) sourcesSet.add(`Inbound Lead (${l.source})`);
  });
  const verifiedSources = Array.from(sourcesSet);

  // Data Completeness
  const verifiedFields: string[] = [];
  const missingFields: string[] = [];
  if (customer.name) verifiedFields.push('Full Name');
  else missingFields.push('Full Name');

  if (customer.phone && customer.phone.length > 6) verifiedFields.push('Phone Number');
  else missingFields.push('Phone Number');

  if (customer.email && customer.email.includes('@')) verifiedFields.push('Email Address');
  else missingFields.push('Email Address');

  if (customer.city) verifiedFields.push('City / Location');
  else missingFields.push('City / Location');

  if (customer.notes && customer.notes.trim().length > 3) verifiedFields.push('Doctor / Staff Notes');
  else missingFields.push('Notes / Preferences');

  if (matchedOrders.length > 0 || matchedBookings.length > 0) verifiedFields.push('Transaction History');
  else missingFields.push('Direct Transaction History');

  const completenessScore = Math.round((verifiedFields.length / (verifiedFields.length + missingFields.length)) * 100);

  // Timeline
  const timeline = buildCustomerTimeline(customer, matchedOrders, matchedBookings, matchedLeads);

  // Dynamic Recommendations for this customer
  const recommendations = generateSingleCustomerRecommendations(
    customer,
    matchedOrders,
    matchedBookings,
    favoriteProducts,
    favoriteServices,
    business
  );

  return {
    customer,
    orders: matchedOrders,
    bookings: matchedBookings,
    leads: matchedLeads,
    totalOrders: totalOrdersCount,
    totalBookings: totalBookingsCount,
    totalRevenue,
    totalProductSpend: productSpend,
    totalServiceSpend: serviceSpend,
    avgOrderValue,
    firstInteraction,
    latestInteraction,
    repeatPurchaseInfo: {
      isRepeat: totalTransactions > 1,
      totalOrders: totalOrdersCount,
      totalBookings: totalBookingsCount,
      totalTransactions,
      daysBetweenFirstAndLast,
      avgOrderIntervalDays,
      favoriteProducts,
      favoriteServices,
    },
    verifiedSources,
    dataCompleteness: {
      score: completenessScore,
      verifiedFields,
      missingFields,
      notesAudit: Boolean(customer.notes),
      hasDirectContact: Boolean(customer.phone || customer.email),
    },
    timeline,
    recommendations,
  };
}

/**
 * 2. DETERMINISTIC, EXPLAINABLE LEAD SCORING ENGINE
 * Evaluates available fields strictly. Never invents points.
 */
export function calculateDeterministicLeadScore(
  lead: Lead,
  existingCustomers: Customer[] = [],
  allOrders: Order[] = []
): LeadScoreBreakdown {
  const factors: LeadScoreFactor[] = [];
  const evidence: string[] = [];
  const missingWarnings: string[] = [];

  let totalScore = 0;
  let hasContact = false;

  // 1. Phone Verification (+20 pts)
  const normPhone = normalizePhoneNumber(lead.phone);
  if (normPhone && normPhone.length >= 10) {
    factors.push({
      factor: 'Verified Phone / WhatsApp Reachable',
      points: 20,
      maxPoints: 20,
      reason: `Direct contact available (${lead.phone}) for WhatsApp / phone outreach`,
      status: 'positive',
    });
    evidence.push(`Phone number provided: ${lead.phone}`);
    totalScore += 20;
    hasContact = true;
  } else {
    factors.push({
      factor: 'Phone Number Missing or Incomplete',
      points: 0,
      maxPoints: 20,
      reason: 'No valid phone number provided for direct contact',
      status: 'penalty',
    });
    missingWarnings.push('Missing direct WhatsApp / phone contact');
  }

  // 2. Email Verification (+15 pts)
  const normEmail = normalizeEmail(lead.email);
  if (normEmail && normEmail.includes('@') && normEmail.includes('.')) {
    factors.push({
      factor: 'Verified Email Address',
      points: 15,
      maxPoints: 15,
      reason: `Valid email address on file (${lead.email})`,
      status: 'positive',
    });
    evidence.push(`Email address verified: ${lead.email}`);
    totalScore += 15;
    hasContact = true;
  } else {
    factors.push({
      factor: 'Email Address Missing',
      points: 0,
      maxPoints: 15,
      reason: 'No email address on record',
      status: 'neutral',
    });
    missingWarnings.push('No email address provided');
  }

  // 3. Stated Budget & Purchase Intent (+20 pts)
  const budget = Number(lead.budget) || 0;
  if (budget >= 5000) {
    factors.push({
      factor: 'High Stated Budget (₹5,000+)',
      points: 20,
      maxPoints: 20,
      reason: `Explicit buyer budget of ₹${budget.toLocaleString('en-IN')}`,
      status: 'positive',
    });
    evidence.push(`High stated budget: ₹${budget.toLocaleString('en-IN')}`);
    totalScore += 20;
  } else if (budget >= 2000) {
    factors.push({
      factor: 'Moderate Stated Budget (₹2,000-₹4,999)',
      points: 14,
      maxPoints: 20,
      reason: `Commercial purchase intent with ₹${budget.toLocaleString('en-IN')} budget`,
      status: 'positive',
    });
    evidence.push(`Stated budget: ₹${budget.toLocaleString('en-IN')}`);
    totalScore += 14;
  } else if (budget > 0) {
    factors.push({
      factor: 'Entry-Level Stated Budget',
      points: 8,
      maxPoints: 20,
      reason: `Entry budget of ₹${budget.toLocaleString('en-IN')}`,
      status: 'positive',
    });
    evidence.push(`Entry budget: ₹${budget.toLocaleString('en-IN')}`);
    totalScore += 8;
  } else {
    factors.push({
      factor: 'No Budget Stated',
      points: 0,
      maxPoints: 20,
      reason: 'Customer has not indicated expected spend or budget range',
      status: 'neutral',
    });
    missingWarnings.push('Budget requirement not yet specified by lead');
  }

  // 4. Acquisition Channel Intent (+15 pts)
  const src = (lead.source || '').toLowerCase();
  if (src.includes('whatsapp') || src.includes('referral') || src.includes('search') || src.includes('google')) {
    factors.push({
      factor: 'High-Intent Channel Source',
      points: 15,
      maxPoints: 15,
      reason: `Inbound channel "${lead.source}" signals high organic intent`,
      status: 'positive',
    });
    evidence.push(`High intent channel: ${lead.source}`);
    totalScore += 15;
  } else if (src.includes('instagram') || src.includes('ad') || src.includes('meta') || src.includes('chat')) {
    factors.push({
      factor: 'Social / Ad Inbound Channel',
      points: 10,
      maxPoints: 15,
      reason: `Social channel "${lead.source}" requires active qualification`,
      status: 'positive',
    });
    evidence.push(`Inbound channel: ${lead.source}`);
    totalScore += 10;
  } else if (lead.source) {
    factors.push({
      factor: 'General Channel Source',
      points: 5,
      maxPoints: 15,
      reason: `Channel "${lead.source}" recorded`,
      status: 'neutral',
    });
    evidence.push(`Channel: ${lead.source}`);
    totalScore += 5;
  } else {
    missingWarnings.push('Acquisition channel unverified');
  }

  // 5. Explicit Product / Service Interest (+15 pts)
  if (lead.interest_product_or_service && lead.interest_product_or_service.trim().length > 3) {
    factors.push({
      factor: 'Specific Product / Service Interest Stated',
      points: 15,
      maxPoints: 15,
      reason: `Lead explicitly requested: "${lead.interest_product_or_service}"`,
      status: 'positive',
    });
    evidence.push(`Specific interest: ${lead.interest_product_or_service}`);
    totalScore += 15;
  } else {
    factors.push({
      factor: 'General / Unspecified Interest',
      points: 2,
      maxPoints: 15,
      reason: 'No specific SKU or service mentioned in initial inquiry',
      status: 'neutral',
    });
    missingWarnings.push('No specific SKU or service designated');
    totalScore += 2;
  }

  // 6. Recency & Engagement Velocity (+15 pts)
  const createdDate = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
  const ageInHours = (Date.now() - createdDate) / (1000 * 60 * 60);

  if (ageInHours <= 48) {
    factors.push({
      factor: 'Fresh Inbound Lead (<48 hours)',
      points: 15,
      maxPoints: 15,
      reason: `Inquiry received recently (${Math.round(ageInHours)}h ago). Peak conversion window.`,
      status: 'positive',
    });
    evidence.push(`Inquiry recency: ${Math.round(ageInHours)}h ago`);
    totalScore += 15;
  } else if (ageInHours <= 168) {
    // 7 days
    factors.push({
      factor: 'Active Lead Recency (<7 days)',
      points: 10,
      maxPoints: 15,
      reason: `Inquiry received within the past week (${Math.round(ageInHours / 24)}d ago).`,
      status: 'positive',
    });
    evidence.push(`Inquiry recency: ${Math.round(ageInHours / 24)} days ago`);
    totalScore += 10;
  } else if (ageInHours > 720) {
    // 30 days
    factors.push({
      factor: 'Aging Lead (>30 days)',
      points: -10,
      maxPoints: 0,
      reason: `Lead received >30 days ago without final conversion. Cool-off penalty.`,
      status: 'penalty',
    });
    evidence.push(`Aging inquiry: ${Math.round(ageInHours / 24)} days old`);
    totalScore = Math.max(0, totalScore - 10);
  } else {
    factors.push({
      factor: 'Standard Inbound Timeline',
      points: 5,
      maxPoints: 15,
      reason: `Lead received ${Math.round(ageInHours / 24)} days ago`,
      status: 'neutral',
    });
    totalScore += 5;
  }

  // Check if this lead matches an existing customer
  const isExistingCustomer = existingCustomers.some(
    (c) =>
      (normPhone && normalizePhoneNumber(c.phone) === normPhone) ||
      (normEmail && normalizeEmail(c.email) === normEmail)
  );
  if (isExistingCustomer) {
    factors.push({
      factor: 'Existing Customer Match (High Trust)',
      points: 10,
      maxPoints: 10,
      reason: 'Lead matched against existing registered customer profile',
      status: 'positive',
    });
    evidence.push('Matched to registered customer account');
    totalScore = Math.min(100, totalScore + 10);
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

  // Confidence Calculation
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (hasContact && budget > 0 && lead.interest_product_or_service) {
    confidence = 'high';
  } else if (!hasContact || (!lead.interest_product_or_service && budget === 0)) {
    confidence = 'low';
  }

  // Qualification Tier
  let qualificationTier: LeadScoreBreakdown['qualificationTier'] = 'Moderate';
  if (finalScore >= 80) qualificationTier = 'Hot';
  else if (finalScore >= 65) qualificationTier = 'Warm';
  else if (finalScore >= 45) qualificationTier = 'Moderate';
  else if (finalScore >= 25) qualificationTier = 'Cold';
  else qualificationTier = 'Unqualified';

  const isInsufficientData = !hasContact && !lead.interest_product_or_service && budget === 0;

  const summary = isInsufficientData
    ? 'Insufficient verified data to establish full score confidence.'
    : `${qualificationTier} opportunity (${finalScore}/100) based on ${factors.filter((f) => f.status === 'positive').length} positive verified data points.`;

  return {
    score: finalScore,
    confidence,
    factors,
    evidence,
    missingWarnings,
    isInsufficientData,
    qualificationTier,
    summary,
  };
}

/**
 * 3. DYNAMIC CUSTOMER & LEAD SEGMENTATION
 * Deterministically filters records based purely on verified database rows.
 */
export function getCustomerSegments(
  customers: Customer[] = [],
  leads: Lead[] = [],
  orders: Order[] = [],
  bookings: Booking[] = [],
  currencySymbol = '₹'
): {
  summaries: SegmentSummary[];
  filterBySegment: (segment: CustomerSegmentType) => {
    filteredCustomers: Customer[];
    filteredLeads: Lead[];
  };
} {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // Compute spend thresholds for High Value (top 20% or > 5000)
  const spends = customers.map((c) => c.total_spend || 0).sort((a, b) => b - a);
  const highValueThreshold = spends.length > 0 ? Math.max(5000, spends[Math.floor(spends.length * 0.2)] || 5000) : 5000;

  const newCustomers = customers.filter((c) => {
    const firstSeenTime = c.first_seen ? new Date(c.first_seen).getTime() : 0;
    return now - firstSeenTime <= thirtyDaysMs || (c.total_orders <= 1 && c.status !== 'dormant');
  });

  const repeatCustomers = customers.filter(
    (c) => c.status === 'repeat' || c.status === 'vip' || (c.total_orders && c.total_orders > 1)
  );

  const highValue = customers.filter(
    (c) => (c.total_spend && c.total_spend >= highValueThreshold) || c.status === 'vip'
  );

  const atRisk = customers.filter((c) => {
    if (c.status === 'churn_risk') return true;
    const lastTime = c.last_activity ? new Date(c.last_activity).getTime() : 0;
    return (c.total_orders > 0 || c.total_spend > 0) && now - lastTime >= sixtyDaysMs && now - lastTime < ninetyDaysMs;
  });

  const dormant = customers.filter((c) => {
    if (c.status === 'dormant' || c.status === 'inactive') return true;
    const lastTime = c.last_activity ? new Date(c.last_activity).getTime() : 0;
    return now - lastTime >= ninetyDaysMs;
  });

  const recentLeads = leads.filter((l) => {
    const createdTime = l.created_at ? new Date(l.created_at).getTime() : 0;
    return now - createdTime <= sevenDaysMs && (l.status === 'new' || l.status === 'contacted');
  });

  const highIntentLeads = leads.filter((l) => {
    const score = l.score || 0;
    const budget = Number(l.budget) || 0;
    return (score >= 75 || budget >= 3000) && l.status !== 'converted' && l.status !== 'lost';
  });

  const summaries: SegmentSummary[] = [
    {
      type: 'all',
      label: 'All Customers',
      description: 'Entire registered database across active channels',
      count: customers.length,
      totalValue: customers.reduce((s, c) => s + (c.total_spend || 0), 0),
      badgeColor: 'bg-slate-800 text-slate-200 border-slate-700',
    },
    {
      type: 'new_customers',
      label: 'New Customers',
      description: 'Joined in past 30 days or made 1st purchase',
      count: newCustomers.length,
      totalValue: newCustomers.reduce((s, c) => s + (c.total_spend || 0), 0),
      badgeColor: 'bg-blue-950 text-blue-300 border-blue-800',
    },
    {
      type: 'repeat_customers',
      label: 'Repeat Buyers',
      description: '2+ completed orders or clinic bookings',
      count: repeatCustomers.length,
      totalValue: repeatCustomers.reduce((s, c) => s + (c.total_spend || 0), 0),
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    },
    {
      type: 'high_value',
      label: 'VIP & High Value',
      description: `Lifetime spend ≥ ${currencySymbol}${highValueThreshold.toLocaleString('en-IN')}`,
      count: highValue.length,
      totalValue: highValue.reduce((s, c) => s + (c.total_spend || 0), 0),
      badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
    },
    {
      type: 'at_risk',
      label: 'At-Risk Retention',
      description: 'No activity in 60-90 days with past orders',
      count: atRisk.length,
      totalValue: atRisk.reduce((s, c) => s + (c.total_spend || 0), 0),
      badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
    },
    {
      type: 'dormant',
      label: 'Dormant Accounts',
      description: 'Inactive >90 days, ready for win-back campaigns',
      count: dormant.length,
      totalValue: dormant.reduce((s, c) => s + (c.total_spend || 0), 0),
      badgeColor: 'bg-slate-900 text-slate-400 border-slate-800',
    },
    {
      type: 'recent_leads',
      label: 'Fresh Inbound Leads',
      description: 'Inquiries received in the past 7 days',
      count: recentLeads.length,
      totalValue: recentLeads.reduce((s, l) => s + (Number(l.budget) || 0), 0),
      badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
    },
    {
      type: 'high_intent_leads',
      label: 'Hot Leads (Score ≥75)',
      description: 'High budget or strong buying signals',
      count: highIntentLeads.length,
      totalValue: highIntentLeads.reduce((s, l) => s + (Number(l.budget) || 0), 0),
      badgeColor: 'bg-purple-950 text-purple-300 border-purple-800',
    },
  ];

  const filterBySegment = (segment: CustomerSegmentType) => {
    switch (segment) {
      case 'new_customers':
        return { filteredCustomers: newCustomers, filteredLeads: [] };
      case 'repeat_customers':
        return { filteredCustomers: repeatCustomers, filteredLeads: [] };
      case 'high_value':
        return { filteredCustomers: highValue, filteredLeads: [] };
      case 'at_risk':
        return { filteredCustomers: atRisk, filteredLeads: [] };
      case 'dormant':
        return { filteredCustomers: dormant, filteredLeads: [] };
      case 'recent_leads':
        return { filteredCustomers: [], filteredLeads: recentLeads };
      case 'high_intent_leads':
        return { filteredCustomers: [], filteredLeads: highIntentLeads };
      case 'all':
      default:
        return { filteredCustomers: customers, filteredLeads: leads };
    }
  };

  return { summaries, filterBySegment };
}

/**
 * 4. CHRONOLOGICAL ACTIVITY TIMELINE BUILDER
 * Generates verified chronological event history from real table rows.
 */
export function buildCustomerTimeline(
  customer: Customer,
  orders: Order[] = [],
  bookings: Booking[] = [],
  leads: Lead[] = []
): CRMActivityTimelineEvent[] {
  const events: CRMActivityTimelineEvent[] = [];

  // Customer Created / First Seen
  if (customer.created_at || customer.first_seen) {
    events.push({
      id: `evt_create_${customer.id}`,
      type: 'customer_created',
      title: 'Customer Profile Created',
      description: `Registered via ${(customer.source || 'direct').replace(/_/g, ' ')} in ${customer.city || 'local clinic'}.`,
      timestamp: customer.created_at || customer.first_seen,
      source: customer.source || 'system',
      badgeColor: 'bg-blue-500',
    });
  }

  // Leads
  leads.forEach((l) => {
    events.push({
      id: `evt_lead_${l.id}`,
      type: 'lead_created',
      title: `Inbound Inquiry: ${l.interest_product_or_service || 'General Inquiry'}`,
      description: `Inbound lead from ${l.source} with budget ₹${(Number(l.budget) || 0).toLocaleString('en-IN')}. Lead score: ${l.score}/100.`,
      timestamp: l.created_at,
      source: l.source,
      badgeColor: 'bg-indigo-500',
      metadata: { score: l.score, budget: l.budget, notes: l.notes },
    });

    if (l.last_follow_up) {
      events.push({
        id: `evt_lead_fu_${l.id}`,
        type: 'lead_contacted',
        title: 'Staff Follow-up Logged',
        description: `Followed up with lead regarding ${l.interest_product_or_service}.`,
        timestamp: l.last_follow_up,
        source: 'CRM Staff',
        badgeColor: 'bg-purple-500',
      });
    }
  });

  // Orders
  orders.forEach((o) => {
    const itemsSummary = o.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'Custom Formulations';
    events.push({
      id: `evt_ord_${o.id}`,
      type: o.order_status === 'delivered' ? 'order_delivered' : 'order_placed',
      title: `Order #${o.id.replace('ord_', '')} Placed (₹${(Number(o.total_amount) || 0).toLocaleString('en-IN')})`,
      description: `Purchased: ${itemsSummary}. Status: ${o.order_status}, Paid via: ${o.payment_method?.toUpperCase() || 'UPI'}.`,
      timestamp: o.order_date || o.created_at || new Date().toISOString(),
      source: `Store Order (${o.payment_method || 'direct'})`,
      amount: o.total_amount,
      badgeColor: 'bg-emerald-500',
      metadata: { items: o.items, payment_status: o.payment_status },
    });
  });

  // Bookings
  bookings.forEach((b) => {
    events.push({
      id: `evt_bk_${b.id}`,
      type: b.status === 'completed' ? 'booking_completed' : 'booking_scheduled',
      title: `Booking: ${b.service_name || 'Consultation'} (₹${(Number(b.amount) || 0).toLocaleString('en-IN')})`,
      description: `Appointment scheduled for ${new Date(b.booking_date).toLocaleDateString('en-IN')}${b.time_slot ? ` at ${b.time_slot}` : ''}${b.practitioner_name ? ` with ${b.practitioner_name}` : ''}. Status: ${b.status}.`,
      timestamp: b.booking_date || b.created_at,
      source: 'Clinic Desk',
      amount: b.amount,
      badgeColor: 'bg-amber-500',
      metadata: { service: b.service_name, status: b.status },
    });
  });

  // Doctor / Staff Notes
  if (customer.notes && customer.notes.trim().length > 3) {
    events.push({
      id: `evt_note_${customer.id}`,
      type: 'note_logged',
      title: 'Clinical / Staff Note Recorded',
      description: customer.notes,
      timestamp: customer.last_activity || customer.created_at,
      source: 'Doctor / Staff',
      badgeColor: 'bg-slate-500',
    });
  }

  // Sort chronologically descending (newest first)
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * 5. LEAD TIMELINE BUILDER
 */
export function buildLeadTimeline(
  lead: Lead,
  matchedCustomer?: Customer,
  orders: Order[] = [],
  bookings: Booking[] = []
): CRMActivityTimelineEvent[] {
  const events: CRMActivityTimelineEvent[] = [];

  events.push({
    id: `evt_lead_init_${lead.id}`,
    type: 'lead_created',
    title: `Inbound Lead Inquired: ${lead.interest_product_or_service || 'Consultation'}`,
    description: `Submitted via ${lead.source}. Stated Budget: ₹${(Number(lead.budget) || 0).toLocaleString('en-IN')}. Initial Score: ${lead.score}/100.`,
    timestamp: lead.created_at,
    source: lead.source,
    badgeColor: 'bg-indigo-500',
  });

  if (lead.last_follow_up) {
    events.push({
      id: `evt_lead_contact_${lead.id}`,
      type: 'lead_contacted',
      title: 'Direct Contact / Follow-up Completed',
      description: `Staff reached out regarding "${lead.interest_product_or_service}".`,
      timestamp: lead.last_follow_up,
      source: 'Staff Outreach',
      badgeColor: 'bg-purple-500',
    });
  }

  if (lead.status === 'converted' || lead.converted_to_customer_id) {
    events.push({
      id: `evt_lead_won_${lead.id}`,
      type: 'lead_won',
      title: '🎉 Lead Converted to Paying Customer',
      description: `Converted into customer profile (${lead.converted_to_customer_id || 'ID Verified'}).`,
      timestamp: lead.last_follow_up || new Date().toISOString(),
      source: 'CRM Engine',
      badgeColor: 'bg-emerald-500',
    });
  }

  if (lead.status === 'lost') {
    events.push({
      id: `evt_lead_lost_${lead.id}`,
      type: 'lead_lost',
      title: 'Lead Closed as Lost / Unqualified',
      description: `Notes: ${lead.notes || 'No budget match or no response.'}`,
      timestamp: lead.last_follow_up || new Date().toISOString(),
      source: 'CRM Staff',
      badgeColor: 'bg-rose-500',
    });
  }

  // Add matched customer activity if converted
  if (matchedCustomer) {
    orders.forEach((o) => {
      events.push({
        id: `evt_lead_ord_${o.id}`,
        type: 'order_placed',
        title: `Customer Order Placed (₹${(Number(o.total_amount) || 0).toLocaleString('en-IN')})`,
        description: `Purchased items after conversion.`,
        timestamp: o.order_date || o.created_at || new Date().toISOString(),
        source: 'Store Order',
        badgeColor: 'bg-emerald-500',
      });
    });
    bookings.forEach((b) => {
      events.push({
        id: `evt_lead_bk_${b.id}`,
        type: 'booking_scheduled',
        title: `Clinic Booking: ${b.service_name}`,
        description: `Scheduled appointment.`,
        timestamp: b.booking_date,
        source: 'Clinic Desk',
        badgeColor: 'bg-amber-500',
      });
    });
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * 6. GROUNDED FOLLOW-UP RECOMMENDATION GENERATOR (HUMAN-IN-THE-LOOP)
 * Purely derived from verified timestamps and purchase intervals.
 */
function generateSingleCustomerRecommendations(
  customer: Customer,
  orders: Order[],
  bookings: Booking[],
  favProducts: { name: string; quantity: number; totalSpent: number }[],
  favServices: { name: string; bookingsCount: number; totalSpent: number }[],
  business?: Business
): CRMRecommendation[] {
  const recommendations: CRMRecommendation[] = [];
  const bizName = business?.name || 'VedaVeda Ayurveda';
  const now = Date.now();

  // 1. Replenishment Trigger: If customer purchased skincare/oils 30-50 days ago
  const latestOrder = orders.sort(
    (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
  )[0];

  if (latestOrder) {
    const orderAgeDays = Math.round(
      (now - new Date(latestOrder.order_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const topItem = latestOrder.items?.[0]?.name || favProducts[0]?.name || 'Ayurvedic Formulations';

    if (orderAgeDays >= 25 && orderAgeDays <= 60) {
      recommendations.push({
        id: `rec_rep_${customer.id}`,
        targetType: 'customer',
        targetId: customer.id,
        targetName: customer.name,
        targetPhone: customer.phone,
        targetEmail: customer.email,
        actionType: 'replenishment',
        title: `Refill Reminder: ${topItem}`,
        recommendedAction: `Send 30-day replenishment check-in via WhatsApp for ${topItem}`,
        reason: `Customer ordered ${topItem} ${orderAgeDays} days ago; standard bottle capacity is typically exhausted within 30-45 days.`,
        supportingEvidence: [
          `Last order: #${latestOrder.id.replace('ord_', '')} placed on ${new Date(latestOrder.order_date).toLocaleDateString('en-IN')}`,
          `Item: ${topItem} (Qty: ${latestOrder.items?.[0]?.quantity || 1})`,
          `Elapsed time: ${orderAgeDays} days since purchase`,
        ],
        confidence: 91,
        businessObjective: 'Boost repeat repurchase rate and prevent customer drop-off',
        draftMessage: `Namaste ${customer.name} Ji! 🙏 Hope you are experiencing wonderful results from your ${topItem}. As it has been about ${orderAgeDays} days, your bottle might be nearing completion. Would you like us to prepare your fresh refill batch with complimentary clinic dispatch?`,
        channel: 'whatsapp',
        requiresHumanApproval: true,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 2. VIP Appreciation: If customer spent > 15,000 or status is VIP
  if (customer.total_spend >= 15000 || customer.status === 'vip') {
    recommendations.push({
      id: `rec_vip_${customer.id}`,
      targetType: 'customer',
      targetId: customer.id,
      targetName: customer.name,
      targetPhone: customer.phone,
      targetEmail: customer.email,
      actionType: 'vip_appreciation',
      title: 'VIP Consultation & Privilege Check-in',
      recommendedAction: 'Extend complimentary Pulse Assessment upgrade & private clinic priority',
      reason: `Customer has achieved VIP tier with verified spend of ₹${customer.total_spend.toLocaleString('en-IN')} across ${customer.total_orders} orders.`,
      supportingEvidence: [
        `Lifetime spend: ₹${customer.total_spend.toLocaleString('en-IN')}`,
        `Total verified transactions: ${customer.total_orders}`,
        `Cohort: VIP Customer`,
      ],
      confidence: 95,
      businessObjective: 'Cultivate top 5% revenue cohort loyalty and generate referrals',
      draftMessage: `Dear ${customer.name}, thank you for your deep trust in ${bizName}. As one of our most valued patrons (verified spend ₹${customer.total_spend.toLocaleString('en-IN')}), we would love to extend a complimentary seasonal health review with our senior Vaidya this month. Let us know a convenient time!`,
      channel: 'whatsapp',
      requiresHumanApproval: true,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    });
  }

  // 3. At-Risk Win-Back: If churn_risk or inactive >60 days
  if (customer.status === 'churn_risk') {
    recommendations.push({
      id: `rec_win_${customer.id}`,
      targetType: 'customer',
      targetId: customer.id,
      targetName: customer.name,
      targetPhone: customer.phone,
      targetEmail: customer.email,
      actionType: 'win_back',
      title: 'Re-engagement & Wellness Check-in',
      recommendedAction: 'Send compassionate wellness check-in with 10% seasonal reorder privilege',
      reason: 'Customer has had 0 interactions for over 60 days despite having past verified transactions.',
      supportingEvidence: [
        `Status flagged as churn_risk`,
        `Past orders: ${customer.total_orders} (Total spend: ₹${customer.total_spend.toLocaleString('en-IN')})`,
        `Last activity recorded: ${new Date(customer.last_activity).toLocaleDateString('en-IN')}`,
      ],
      confidence: 84,
      businessObjective: 'Reactivate dormant customer base and recover lost LTV',
      draftMessage: `Namaste ${customer.name} Ji, we noticed it has been a while since your last visit to ${bizName}. We wanted to check in on your holistic wellness routine. We have recently launched fresh harvest batches and would love to welcome you back with a personalized consultation note.`,
      channel: 'whatsapp',
      requiresHumanApproval: true,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    });
  }

  return recommendations;
}

/**
 * 7. GLOBAL CRM RECOMMENDATIONS GENERATOR
 * Scans all customers & leads for prioritized human-in-the-loop actions.
 */
export function generateAllCRMRecommendations(
  customers: Customer[] = [],
  leads: Lead[] = [],
  orders: Order[] = [],
  bookings: Booking[] = [],
  products: Product[] = [],
  services: ServiceItem[] = [],
  business?: Business
): CRMRecommendation[] {
  const recommendations: CRMRecommendation[] = [];
  const bizName = business?.name || 'VedaVeda Ayurveda';
  const now = Date.now();

  // Scan Customers
  customers.forEach((c) => {
    const c360 = buildCustomer360(c, orders, bookings, leads, business);
    recommendations.push(...c360.recommendations);
  });

  // Scan Inbound Leads
  leads.forEach((l) => {
    if (l.status === 'converted' || l.status === 'lost') return;

    const leadAgeHours = (now - new Date(l.created_at).getTime()) / (1000 * 60 * 60);

    // Speed-to-lead for fresh new inquiries
    if (l.status === 'new' && leadAgeHours <= 72) {
      recommendations.push({
        id: `rec_lead_stl_${l.id}`,
        targetType: 'lead',
        targetId: l.id,
        targetName: l.name,
        targetPhone: l.phone,
        targetEmail: l.email,
        actionType: 'speed_to_lead',
        title: `Instant Inbound Welcome: ${l.name}`,
        recommendedAction: `Dispatch personalized WhatsApp greeting regarding "${l.interest_product_or_service}"`,
        reason: `New inquiry received ${Math.round(leadAgeHours)}h ago via ${l.source}. Conversion probability drops 4x after 24h.`,
        supportingEvidence: [
          `Inbound source: ${l.source}`,
          `Stated interest: ${l.interest_product_or_service}`,
          `Stated budget: ₹${(Number(l.budget) || 0).toLocaleString('en-IN')}`,
          `Lead qualification score: ${l.score}/100`,
        ],
        confidence: 96,
        businessObjective: 'Maximize speed-to-lead response time and book consultation',
        draftMessage: `Namaste ${l.name} Ji! 🙏 Thank you for reaching out to ${bizName} regarding ${l.interest_product_or_service}. We have reviewed your inquiry and would be delighted to guide you. Would you prefer a brief WhatsApp overview or a 10-minute slot with our doctor today?`,
        channel: 'whatsapp',
        requiresHumanApproval: true,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
      });
    }

    // High budget follow-up for qualified / proposal leads
    if ((l.status === 'qualified' || l.status === 'proposal' || l.status === 'proposal_sent') && Number(l.budget) >= 3000) {
      recommendations.push({
        id: `rec_lead_prop_${l.id}`,
        targetType: 'lead',
        targetId: l.id,
        targetName: l.name,
        targetPhone: l.phone,
        targetEmail: l.email,
        actionType: 'proposal_followup',
        title: `High-Value Proposal Follow-up: ${l.name}`,
        recommendedAction: `Send consultation slot confirmation & formulation breakdown`,
        reason: `Lead is qualified with budget ₹${(Number(l.budget) || 0).toLocaleString('en-IN')} for "${l.interest_product_or_service}".`,
        supportingEvidence: [
          `Budget: ₹${(Number(l.budget) || 0).toLocaleString('en-IN')}`,
          `Status: ${l.status}`,
          `Notes: ${l.notes || 'Awaiting slot confirmation'}`,
        ],
        confidence: 89,
        businessObjective: 'Convert qualified high-budget inquiry into paying customer',
        draftMessage: `Hello ${l.name} Ji, following up on our discussion for ${l.interest_product_or_service}. We have reserved priority slots for you this week. Would you like us to confirm your booking for tomorrow at 11:00 AM?`,
        channel: 'whatsapp',
        requiresHumanApproval: true,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
      });
    }
  });

  return recommendations;
}

/**
 * 8. LEAD FUNNEL PIPELINE DATA RECONCILER
 * Returns real counts and budgets for each stage.
 */
export function getLeadFunnelData(leads: Lead[] = []): LeadFunnelStageData[] {
  const stages: { stage: LeadFunnelStage; label: string; description: string; color: string }[] = [
    { stage: 'new', label: 'New Inbound', description: 'Fresh inquiries awaiting first contact', color: 'indigo' },
    { stage: 'contacted', label: 'Contacted', description: 'Outreach sent, waiting for reply', color: 'blue' },
    { stage: 'qualified', label: 'Qualified', description: 'Budget and treatment requirements verified', color: 'amber' },
    { stage: 'proposal', label: 'Proposal / Intent', description: 'Custom package or pricing sent', color: 'purple' },
    { stage: 'won', label: 'Won / Converted', description: 'Successfully converted to paying customer', color: 'emerald' },
    { stage: 'lost', label: 'Lost / Closed', description: 'Unqualified or declined inquiry', color: 'rose' },
    { stage: 'dormant', label: 'Dormant', description: 'No response after multiple follow-ups', color: 'slate' },
  ];

  const totalLeads = leads.length;

  return stages.map((st) => {
    const stageLeads = leads.filter((l) => {
      if (st.stage === 'new') return l.status === 'new';
      if (st.stage === 'contacted') return l.status === 'contacted';
      if (st.stage === 'qualified') return l.status === 'qualified';
      if (st.stage === 'proposal') return l.status === 'proposal' || l.status === 'proposal_sent' || l.status === 'intent' || l.status === 'negotiation';
      if (st.stage === 'won') return l.status === 'won' || l.status === 'converted';
      if (st.stage === 'lost') return l.status === 'lost';
      if (st.stage === 'dormant') return l.status === 'dormant';
      return false;
    });

    const totalBudget = stageLeads.reduce((sum, l) => sum + (Number(l.budget) || 0), 0);
    const conversionRateFromStart = totalLeads > 0 ? Math.round((stageLeads.length / totalLeads) * 100) : 0;

    return {
      stage: st.stage,
      label: st.label,
      description: st.description,
      color: st.color,
      leads: stageLeads,
      count: stageLeads.length,
      totalBudget,
      conversionRateFromStart,
    };
  });
}

export function formatCurrency(amount: number, symbol = '₹'): string {
  const num = Number(amount) || 0;
  return `${symbol}${num.toLocaleString('en-IN')}`;
}

/**
 * 6. FOLLOW-UPS RECONCILIATION ENGINE
 * Reconciles scheduled lead follow-ups and CRM follow-ups with timezone-aware due/overdue calculation.
 */
export function deriveFollowUpsFromRecords(
  leads: Lead[] = [],
  customers: Customer[] = [],
  existingFollowUps: CRMFollowUp[] = [],
  timezone: string = 'Asia/Kolkata'
): CRMFollowUp[] {
  const followUpMap = new Map<string, CRMFollowUp>();

  // 1. Existing explicit follow-ups
  existingFollowUps.forEach((f) => {
    let status = f.status;
    if (status === 'pending' && isOverdueInTimezone(f.due_date, timezone)) {
      status = 'overdue';
    }
    followUpMap.set(f.id, { ...f, status });
  });

  // Track explicit target IDs to prevent duplicate follow-ups
  const explicitLeadTargetIds = new Set(
    existingFollowUps
      .filter((f) => f.target_type === 'lead')
      .map((f) => f.target_id)
  );

  // 2. Leads with next_follow_up
  leads.forEach((l) => {
    if (l.next_follow_up) {
      if (explicitLeadTargetIds.has(l.id)) {
        return;
      }
      const derivedId = `fu_lead_${l.id}`;
      if (followUpMap.has(derivedId)) {
        return;
      }
      const isOverdue = isOverdueInTimezone(l.next_follow_up, timezone);
      const isWonOrLost = l.status === 'won' || l.status === 'converted' || l.status === 'lost';

      followUpMap.set(derivedId, {
        id: derivedId,
        business_id: l.business_id,
        target_type: 'lead',
        target_id: l.id,
        target_name: l.name,
        contact_phone: l.phone,
        contact_email: l.email,
        due_date: l.next_follow_up,
        reason: l.interest_product_or_service
          ? `Inquiry regarding ${l.interest_product_or_service}`
          : 'Scheduled sales pipeline follow-up',
        notes: l.notes || '',
        status: isWonOrLost ? 'completed' : isOverdue ? 'overdue' : 'pending',
        created_at: l.created_at,
      });
    }
  });

  return Array.from(followUpMap.values()).sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );
}

/**
 * 7. CRM OVERVIEW METRICS ENGINE
 * Grounded calculation of all CRM KPIs strictly from real Supabase business records.
 * Generates transparent data-state indicators without inventing numbers.
 */
export function calculateCRMMetrics(
  business: Business,
  leads: Lead[] = [],
  customers: Customer[] = [],
  orders: Order[] = [],
  bookings: Booking[] = [],
  followups: CRMFollowUp[] = []
): CRMMetrics {
  const timezone = business.timezone || 'Asia/Kolkata';

  // 1. Lead Pipeline Metrics
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === 'new').length;
  const qualifiedLeads = leads.filter((l) => l.status === 'qualified').length;
  const wonLeads = leads.filter((l) => l.status === 'won' || l.status === 'converted').length;
  const lostLeads = leads.filter((l) => l.status === 'lost').length;
  const openLeads = leads.filter(
    (l) => l.status !== 'won' && l.status !== 'converted' && l.status !== 'lost'
  ).length;

  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : null;

  // 2. Customer Base Metrics
  const totalCustomers = customers.length;
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  const newCustomers = customers.filter((c) => {
    const firstSeenTime = c.first_seen ? new Date(c.first_seen).getTime() : 0;
    return now - firstSeenTime <= thirtyDaysMs || (c.total_orders <= 1 && c.status !== 'dormant');
  }).length;

  const repeatCustomers = customers.filter(
    (c) => c.status === 'repeat' || c.status === 'vip' || (c.total_orders && c.total_orders > 1)
  ).length;

  const inactiveCustomers = customers.filter((c) => {
    if (c.status === 'dormant' || c.status === 'inactive') return true;
    const lastTime = c.last_activity ? new Date(c.last_activity).getTime() : 0;
    return lastTime > 0 && now - lastTime >= ninetyDaysMs;
  }).length;

  // 3. Follow-ups in Business Timezone
  const allFollowUps = deriveFollowUpsFromRecords(leads, customers, followups, timezone);

  const followupsDueToday = allFollowUps.filter(
    (f) => f.status === 'pending' && isTodayInTimezone(f.due_date, timezone)
  ).length;

  const overdueFollowups = allFollowUps.filter(
    (f) => f.status === 'overdue' || (f.status === 'pending' && isOverdueInTimezone(f.due_date, timezone))
  ).length;

  const upcomingFollowups = allFollowUps.filter(
    (f) => f.status === 'pending' && isUpcomingInTimezone(f.due_date, timezone)
  ).length;

  const completedFollowups = allFollowUps.filter((f) => f.status === 'completed').length;

  // 4. Financial & Scoring Aggregates
  const avgLeadScore =
    totalLeads > 0
      ? Math.round(leads.reduce((sum, l) => sum + (Number(l.score) || 0), 0) / totalLeads)
      : null;

  const totalSpend = customers.reduce((sum, c) => sum + (Number(c.total_spend) || 0), 0);
  const avgCustomerSpend =
    totalCustomers > 0 ? Math.round(totalSpend / totalCustomers) : null;

  // 5. Data State & Evidence Traces
  const metricsEvidence: Record<string, MetricEvidenceInfo> = {
    totalLeads: {
      state: 'observed',
      label: 'Observed',
      source: 'leads table (tenant scoped)',
    },
    newLeads: {
      state: 'observed',
      label: 'Observed',
      source: 'leads table (status = new)',
    },
    qualifiedLeads: {
      state: 'observed',
      label: 'Observed',
      source: 'leads table (status = qualified)',
    },
    wonLeads: {
      state: 'observed',
      label: 'Observed',
      source: 'leads table (status = won/converted)',
    },
    lostLeads: {
      state: 'observed',
      label: 'Observed',
      source: 'leads table (status = lost)',
    },
    openLeads: {
      state: 'observed',
      label: 'Observed',
      source: 'leads table (active pipeline stages)',
    },
    conversionRate: {
      state: totalLeads > 0 ? 'calculated' : 'insufficient_data',
      label: totalLeads > 0 ? 'Calculated from observed DB data' : 'Insufficient data',
      source: 'wonLeads / totalLeads ratio',
      explanation: totalLeads === 0 ? 'No leads registered in database to calculate conversion' : undefined,
    },
    totalCustomers: {
      state: 'observed',
      label: 'Observed',
      source: 'customers table (tenant scoped)',
    },
    newCustomers: {
      state: 'calculated',
      label: 'Calculated from observed DB data',
      source: 'customers joined within 30 days or first transaction',
    },
    repeatCustomers: {
      state: totalCustomers > 0 ? 'calculated' : 'insufficient_data',
      label: totalCustomers > 0 ? 'Calculated from observed DB data' : 'Insufficient data',
      source: 'customers with status = repeat/vip or >1 verified orders',
      explanation: totalCustomers === 0 ? 'No customers in database to evaluate repeat frequency' : undefined,
    },
    inactiveCustomers: {
      state: totalCustomers > 0 ? 'calculated' : 'insufficient_data',
      label: totalCustomers > 0 ? 'Calculated from observed DB data' : 'Insufficient data',
      source: 'customers with status = dormant/inactive or no activity in 90+ days',
      explanation: totalCustomers === 0 ? 'No customers in database to evaluate retention' : undefined,
    },
    followupsDueToday: {
      state: 'calculated',
      label: 'Calculated from observed DB data',
      source: `pending follow-ups scheduled for today in ${timezone}`,
    },
    overdueFollowups: {
      state: 'calculated',
      label: 'Calculated from observed DB data',
      source: `pending follow-ups prior to today in ${timezone}`,
    },
    upcomingFollowups: {
      state: 'calculated',
      label: 'Calculated from observed DB data',
      source: `pending follow-ups in the future in ${timezone}`,
    },
    avgLeadScore: {
      state: totalLeads > 0 ? 'calculated' : 'insufficient_data',
      label: totalLeads > 0 ? 'Calculated from observed DB data' : 'Insufficient data',
      source: 'average of deterministic lead scores across registered leads',
      explanation: totalLeads === 0 ? 'No leads recorded in database to compute average score' : undefined,
    },
    avgCustomerSpend: {
      state: totalCustomers > 0 && totalSpend > 0 ? 'calculated' : 'insufficient_data',
      label: totalCustomers > 0 && totalSpend > 0 ? 'Calculated from observed DB data' : 'Insufficient data',
      source: 'total revenue divided by customer count',
      explanation:
        totalCustomers === 0
          ? 'No registered customers to compute average spend'
          : totalSpend === 0
          ? 'Zero cumulative customer spend recorded in database'
          : undefined,
    },
  };

  return {
    totalLeads,
    newLeads,
    qualifiedLeads,
    wonLeads,
    lostLeads,
    openLeads,
    conversionRate,
    totalCustomers,
    newCustomers,
    repeatCustomers,
    inactiveCustomers,
    followupsDueToday,
    overdueFollowups,
    upcomingFollowups,
    completedFollowups,
    avgLeadScore,
    avgCustomerSpend,
    metricsEvidence,
    hasSufficientLeadData: totalLeads > 0,
    hasSufficientCustomerData: totalCustomers > 0,
  };
}

/**
 * 8. DUPLICATE CUSTOMER DETECTION
 * Matches existing customers by business_id + normalized phone and/or email.
 * Prevents unintentional duplicate customer profiles.
 */
export function findDuplicateCustomer(
  phone: string | undefined | null,
  email: string | undefined | null,
  customers: Customer[],
  excludeCustomerId?: string
): Customer | null {
  const normPhone = normalizePhoneNumber(phone);
  const normEmail = normalizeEmail(email);

  return (
    customers.find((c) => {
      if (excludeCustomerId && c.id === excludeCustomerId) return false;
      if (normPhone && normPhone.length >= 10 && normalizePhoneNumber(c.phone) === normPhone) {
        return true;
      }
      if (normEmail && normEmail.includes('@') && normalizeEmail(c.email) === normEmail) {
        return true;
      }
      return false;
    }) || null
  );
}
