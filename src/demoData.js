export const demoData = {
  company: {
    name: "Müller GmbH",
    location: "Munich",
    employees: 150,
    sector: "Food Processing",
    status: "ACTIVE"
  },
  scores: {
    total: 74,
    environmental: 68,
    social: 82,
    governance: 72,
    trend: "+4.2% vs last year"
  },
  co2Trend: [
    { month: 'Jan', co2: 245 },
    { month: 'Feb', co2: 238 },
    { month: 'Mar', co2: 241 },
    { month: 'Apr', co2: 230 },
    { month: 'May', co2: 222 },
    { month: 'Jun', co2: 218 },
    { month: 'Jul', co2: 215 },
    { month: 'Aug', co2: 210 },
    { month: 'Sep', co2: 208 },
    { month: 'Oct', co2: 205 },
    { month: 'Nov', co2: 201 },
    { month: 'Dec', co2: 198 },
  ],
  gapMatrix: [
    { id: "E1", name: "Climate change", status: "yellow", action: "Drafting transition plan", hours: 24 },
    { id: "E2", name: "Pollution", status: "green", action: "Monitoring only", hours: 0 },
    { id: "E3", name: "Water resources", status: "red", action: "Missing tier 1 supplier data", hours: 42 },
    { id: "E4", name: "Biodiversity", status: "yellow", action: "Site impact assessment pending", hours: 18 },
    { id: "E5", name: "Circular economy", status: "green", action: "Packaging policy updated", hours: 0 },
    { id: "S1", name: "Own workforce", status: "green", action: "Full transparency achieved", hours: 0 },
    { id: "S2", name: "Value chain workers", status: "yellow", action: "Code of conduct rollout", hours: 30 },
    { id: "S3", name: "Affected communities", status: "green", action: "Local engagement active", hours: 0 },
    { id: "S4", name: "Consumers", status: "green", action: "Health & safety tracking ok", hours: 0 },
    { id: "G1", name: "Business conduct", status: "green", action: "Anti-corruption audit passed", hours: 0 },
  ],
  aiHistory: [
    { id: 1, sender: 'ai', text: "Welcome back! I've analyzed Müller GmbH's December data. Good news: CO2 intensity dropped to 198t, but ESRS E3 (Water) remains critical." },
    { id: 2, sender: 'user', text: "Why is ESRS E3 still red?" },
    { id: 3, sender: 'ai', text: "The primary gap is Disclosure Requirement 1: 'Water consumption in m3'. We lack documented reuse metrics for your Munich production site." },
  ],
  predictions: {
    e_forecast: [68, 69, 70, 71, 72, 73, 75, 76, 77, 78, 79, 81],
    s_forecast: [82, 82, 83, 83, 84, 84, 85, 85, 86, 86, 87, 88],
    g_forecast: [72, 72, 72, 73, 73, 74, 74, 75, 75, 76, 76, 77],
    co2_reduction_trend: 12.5,
    roi_estimate: 18.4
  },
  license: {
    status: "trial_active",
    days_remaining: 11,
    usage_count: 3,
    ai_queries_used: 12
  }
};
