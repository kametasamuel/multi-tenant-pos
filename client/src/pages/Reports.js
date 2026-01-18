import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../api';
import './Reports.css';

const Reports = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [dailySales, setDailySales] = useState(null);
  const [salesTrends, setSalesTrends] = useState(null);
  const [staffPerformance, setStaffPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState('daily');

  useEffect(() => {
    loadAllReports();
  }, [date, period]);

  const loadAllReports = async () => {
    setLoading(true);
    try {
      const [dashboardRes, dailySalesRes, trendsRes, staffRes] = await Promise.all([
        reportsAPI.getDashboard({ startDate: date, endDate: date }),
        reportsAPI.getDailySales({ date }),
        reportsAPI.getSalesTrends({ period, days: 30 }),
        reportsAPI.getStaffPerformance({ startDate: date, endDate: date })
      ]);

      setDashboardData(dashboardRes.data);
      setDailySales(dailySalesRes.data);
      setSalesTrends(trendsRes.data);
      setStaffPerformance(staffRes.data);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading reports...</div>;
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <div className="date-filter">
          <label>Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {dashboardData && (
        <div className="dashboard-summary">
          <div className="summary-card">
            <h3>Today's Sales</h3>
            <p className="amount">${dashboardData.totalSales?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="summary-card">
            <h3>Today's Expenses</h3>
            <p className="amount expense">${dashboardData.totalExpenses?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="summary-card">
            <h3>Net Profit</h3>
            <p className={`amount ${dashboardData.netProfit >= 0 ? 'profit' : 'loss'}`}>
              ${dashboardData.netProfit?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="summary-card">
            <h3>Transactions</h3>
            <p className="amount">{dashboardData.transactionCount || 0}</p>
          </div>
        </div>
      )}

      {staffPerformance && (
        <div className="report-section">
          <h2>Staff Performance</h2>
          <div className="staff-performance-table">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Total Sales</th>
                  <th>Transactions</th>
                </tr>
              </thead>
              <tbody>
                {staffPerformance.performance.map((perf, index) => (
                  <tr key={index}>
                    <td>{perf.staff?.fullName || 'Unknown'}</td>
                    <td>
                      <span className={`role-badge ${perf.staff?.role.toLowerCase()}`}>
                        {perf.staff?.role}
                      </span>
                    </td>
                    <td>${perf.totalSales.toFixed(2)}</td>
                    <td>{perf.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dailySales && (
        <div className="report-section">
          <h2>Daily Sales Detail</h2>
          <p>
            <strong>Date:</strong> {new Date(dailySales.date).toLocaleDateString()}
          </p>
          <p>
            <strong>Total Amount:</strong> ${dailySales.totalAmount.toFixed(2)}
          </p>
          <p>
            <strong>Transaction Count:</strong> {dailySales.transactionCount}
          </p>
          <div className="sales-list">
            {dailySales.sales.map((sale) => (
              <div key={sale.id} className="sale-item">
                <div className="sale-header">
                  <strong>{sale.transactionNumber}</strong>
                  <span>${sale.finalAmount.toFixed(2)}</span>
                </div>
                <div className="sale-details">
                  <span>Cashier: {sale.cashier?.fullName}</span>
                  <span>Payment: {sale.paymentMethod}</span>
                  <span>{new Date(sale.createdAt).toLocaleString()}</span>
                </div>
                <div className="sale-items">
                  {sale.items.map((item, idx) => (
                    <span key={idx}>
                      {item.product.name} × {item.quantity}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {salesTrends && (
        <div className="report-section">
          <h2>Sales Trends</h2>
          <div className="period-filter">
            <label>Period:</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="trends-list">
            {Object.entries(salesTrends.trends)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([key, value]) => (
                <div key={key} className="trend-item">
                  <span className="trend-date">{key}</span>
                  <span className="trend-amount">${value.toFixed(2)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
