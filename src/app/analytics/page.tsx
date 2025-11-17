"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartWrapper } from "@/components/chart-wrapper";

interface Stats {
  total_events: number;
  unique_users: number;
  unique_sessions: number;
  purchases: number;
  product_views: number;
  add_to_carts: number;
  total_revenue: number;
  avg_order_value: number;
  unique_products_viewed: number;
  conversion_rate: number;
}

interface TimeSeries {
  time: string;
  event_count: number;
  unique_users: number;
  total_revenue: number;
}

interface TopProduct {
  product_id: string;
  event_count: number;
  total_revenue: number;
  avg_price: number;
  unique_users: number;
}

interface FunnelStep {
  step: string;
  count: number;
  percentage: number;
}

interface Insight {
  type: "anomaly" | "trend" | "recommendation";
  severity: "high" | "medium" | "low";
  message: string;
  metric?: string;
  change?: number;
}

interface TrendingProduct {
  product_id: string;
  events_last_hour: number;
  events_last_10min: number;
  unique_users: number;
  total_revenue: number;
  momentum: number;
  trend: string;
  trend_percentage: number;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeries[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [trending, setTrending] = useState<TrendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statsRes, timeSeriesRes, topProductsRes, funnelRes, insightsRes, momentumRes] =
        await Promise.all([
          fetch("/api/analytics/stats?days=7"),
          fetch("/api/analytics/time-series?days=1&interval=hour"),
          fetch("/api/analytics/top-products?limit=10&event_type=product_view"),
          fetch("/api/analytics/funnel?days=7"),
          fetch("/api/analytics/insights?days=7"),
          fetch("/api/analytics/momentum?limit=5&lookback_hours=1"),
        ]);

      // Handle each response, defaulting to empty data if not ok
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        // Set default empty stats
        setStats({
          total_events: 0,
          unique_users: 0,
          unique_sessions: 0,
          purchases: 0,
          product_views: 0,
          add_to_carts: 0,
          total_revenue: 0,
          avg_order_value: 0,
          unique_products_viewed: 0,
          conversion_rate: 0,
        });
      }

      if (timeSeriesRes.ok) {
        const timeSeriesData = await timeSeriesRes.json();
        setTimeSeries(timeSeriesData.series || []);
      } else {
        setTimeSeries([]);
      }

      if (topProductsRes.ok) {
        const topProductsData = await topProductsRes.json();
        setTopProducts(topProductsData.products || []);
      } else {
        setTopProducts([]);
      }

      if (funnelRes.ok) {
        const funnelData = await funnelRes.json();
        setFunnel(funnelData.funnel || []);
      } else {
        setFunnel([
          { step: "Page Views", count: 0, percentage: 100 },
          { step: "Product Views", count: 0, percentage: 0 },
          { step: "Add to Cart", count: 0, percentage: 0 },
          { step: "Purchases", count: 0, percentage: 0 },
        ]);
      }

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData.insights || []);
      } else {
        setInsights([]);
      }

      if (momentumRes.ok) {
        const momentumData = await momentumRes.json();
        setTrending(momentumData.trending_products || []);
      } else {
        setTrending([]);
      }

      setLastUpdate(new Date());
      setError(null);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setError(error instanceof Error ? error.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-lg text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchData();
            }}
            className="px-4 py-2 bg-accent1 text-white rounded hover:bg-opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-accent1 mb-2">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()} • Auto-refreshes every 30s
        </p>
      </div>

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-2 ${
                insight.severity === "high"
                  ? "border-red-500 bg-red-50"
                  : insight.severity === "medium"
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-blue-500 bg-blue-50"
              }`}
            >
              <p className="text-sm font-semibold mb-1">
              {insight.type === "anomaly" ? "⚠️" : insight.type === "trend" ? "📊" : "💡"} {insight.type.toUpperCase()}
              </p>
              <p className="text-sm">{insight.message}</p>
              {insight.change !== undefined && (
                <p className="text-xs mt-1 text-gray-600">
                  Change: {insight.change > 0 ? "+" : ""}
                  {insight.change.toFixed(1)}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Total Events</p>
            <p className="text-2xl font-bold">{stats.total_events.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Unique Users</p>
            <p className="text-2xl font-bold">{stats.unique_users.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Revenue</p>
            <p className="text-2xl font-bold">${stats.total_revenue.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Conversion Rate</p>
            <p className="text-2xl font-bold">{stats.conversion_rate.toFixed(2)}%</p>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Avg Order Value</p>
            <p className="text-2xl font-bold">${stats.avg_order_value.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Trending Products */}
      {trending.length > 0 && (
        <div className="mb-8 bg-white p-6 rounded-lg border-2 border-gray-200">
          <h2 className="text-xl font-bold mb-4">🔥 Live Shopping Momentum</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">Last 10min</th>
                  <th className="text-right p-2">Last Hour</th>
                  <th className="text-right p-2">Momentum</th>
                  <th className="text-right p-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {trending.map((product) => (
                  <tr key={product.product_id} className="border-b">
                    <td className="p-2 font-mono text-xs">{product.product_id.slice(0, 30)}...</td>
                    <td className="text-right p-2">{product.events_last_10min}</td>
                    <td className="text-right p-2">{product.events_last_hour}</td>
                    <td className="text-right p-2">
                      {product.momentum.toFixed(1)}/min
                    </td>
                    <td className="text-right p-2">
                      <span
                        className={
                          product.trend === "accelerating"
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {product.trend === "accelerating" ? "↑" : "↓"}{" "}
                        {Math.abs(product.trend_percentage).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Time Series Chart */}
        <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
          <h2 className="text-xl font-bold mb-4">Events Over Time (Last 24h)</h2>
          {timeSeries.length > 0 ? (
            <ChartWrapper>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeries} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="event_count"
                    stroke="#0088FE"
                    name="Events"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="unique_users"
                    stroke="#00C49F"
                    name="Unique Users"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartWrapper>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <p>No time series data available yet.</p>
            </div>
          )}
        </div>

        {/* Funnel Chart */}
        <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
          <h2 className="text-xl font-bold mb-4">Conversion Funnel</h2>
          {funnel.length > 0 ? (
            <>
              <ChartWrapper>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnel} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="step" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" name="Users" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
              <div className="mt-4 text-sm">
                {funnel.map((step, idx) => (
                  <div key={idx} className="flex justify-between mb-1">
                    <span>{step.step}:</span>
                    <span className="font-semibold">
                      {step.count} ({step.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <p>No funnel data available yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="mb-8 bg-white p-6 rounded-lg border-2 border-gray-200">
        <h2 className="text-xl font-bold mb-4">Top Products (Last 7 Days)</h2>
        {topProducts.length > 0 ? (
          <ChartWrapper>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={topProducts.slice(0, 10)} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="product_id"
                  type="category"
                  width={150}
                  tick={{ fontSize: 9 }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="event_count" fill="#0088FE" name="Views" />
                <Bar dataKey="unique_users" fill="#00C49F" name="Unique Users" />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <p>No product view data available yet.</p>
            <p className="text-sm mt-2">
              Browse some products to generate analytics data!
            </p>
          </div>
        )}
      </div>

      {/* Revenue Chart */}
      <div className="mb-8 bg-white p-6 rounded-lg border-2 border-gray-200">
        <h2 className="text-xl font-bold mb-4">Revenue Over Time</h2>
        {timeSeries.length > 0 ? (
          <ChartWrapper>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart 
                data={timeSeries}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                <Line
                  type="monotone"
                  dataKey="total_revenue"
                  stroke="#FF8042"
                  name="Revenue"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <p>No revenue data available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

