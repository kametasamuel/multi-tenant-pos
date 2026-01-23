const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireSuperAdmin: authRequireSuperAdmin } = require('../middleware/auth');

// Use requireSuperAdmin from auth middleware
const requireSuperAdmin = authRequireSuperAdmin;

// ==========================================
// PRODUCT AFFINITY & BASKET ANALYSIS
// ==========================================

// GET /api/market-intelligence/basket-analysis - Get product affinity pairs
router.get('/basket-analysis', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId, minSupport = 5, limit = 50 } = req.query;

    // Get all sales with their items
    const sales = await prisma.sale.findMany({
      where: {
        ...(tenantId && { tenantId }),
        paymentStatus: { not: 'voided' },
        items: { some: {} }
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, customCategory: true }
            }
          }
        }
      },
      take: 5000 // Limit for performance
    });

    // Build co-occurrence matrix
    const coOccurrence = {};
    const productCounts = {};
    const totalTransactions = sales.length;

    sales.forEach(sale => {
      const products = sale.items.map(item => ({
        id: item.product.id,
        name: item.product.name,
        category: item.product.customCategory
      }));

      // Count individual products
      products.forEach(p => {
        productCounts[p.id] = productCounts[p.id] || { count: 0, ...p };
        productCounts[p.id].count++;
      });

      // Count co-occurrences
      for (let i = 0; i < products.length; i++) {
        for (let j = i + 1; j < products.length; j++) {
          const key = [products[i].id, products[j].id].sort().join('|');
          coOccurrence[key] = coOccurrence[key] || {
            count: 0,
            productA: products[i],
            productB: products[j]
          };
          coOccurrence[key].count++;
        }
      }
    });

    // Calculate association rules
    const affinityPairs = Object.values(coOccurrence)
      .filter(pair => pair.count >= parseInt(minSupport))
      .map(pair => {
        const supportAB = pair.count / totalTransactions;
        const supportA = (productCounts[pair.productA.id]?.count || 0) / totalTransactions;
        const supportB = (productCounts[pair.productB.id]?.count || 0) / totalTransactions;

        // Confidence: P(B|A) = P(A∩B) / P(A)
        const confidenceAtoB = supportA > 0 ? supportAB / supportA : 0;
        const confidenceBtoA = supportB > 0 ? supportAB / supportB : 0;

        // Lift: P(A∩B) / (P(A) * P(B))
        const lift = (supportA * supportB) > 0 ? supportAB / (supportA * supportB) : 0;

        return {
          productA: pair.productA.name,
          productB: pair.productB.name,
          coOccurrences: pair.count,
          support: Math.round(supportAB * 100 * 100) / 100,
          confidenceAB: Math.round(confidenceAtoB * 100),
          confidenceBA: Math.round(confidenceBtoA * 100),
          lift: Math.round(lift * 100) / 100
        };
      })
      .sort((a, b) => b.lift - a.lift)
      .slice(0, parseInt(limit));

    res.json({
      totalTransactions,
      totalProducts: Object.keys(productCounts).length,
      affinityPairs,
      topProducts: Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map(p => ({ name: p.name, frequency: p.count, category: p.category }))
    });
  } catch (error) {
    console.error('Basket analysis error:', error);
    res.status(500).json({ error: 'Failed to perform basket analysis' });
  }
});

// ==========================================
// BRAND MARKET SHARE TRACKING
// ==========================================

// GET /api/market-intelligence/brand-share - Get brand market share across tenants
router.get('/brand-share', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { category, period = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get all sale items with product info
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          createdAt: { gte: startDate },
          paymentStatus: { not: 'voided' }
        },
        ...(category && {
          product: { customCategory: { contains: category, mode: 'insensitive' } }
        })
      },
      include: {
        product: {
          select: { id: true, name: true, customCategory: true }
        },
        sale: {
          select: { tenantId: true }
        }
      }
    });

    // Aggregate by product name (as proxy for brand)
    const brandStats = {};
    let totalRevenue = 0;
    let totalUnits = 0;

    saleItems.forEach(item => {
      const brandName = item.product.name.split(' ')[0]; // First word as brand proxy
      const category = item.product.customCategory || 'General';
      const key = `${brandName}|${category}`;

      brandStats[key] = brandStats[key] || {
        brand: brandName,
        category,
        revenue: 0,
        units: 0,
        tenants: new Set(),
        transactions: 0
      };

      brandStats[key].revenue += item.subtotal;
      brandStats[key].units += item.quantity;
      brandStats[key].tenants.add(item.sale.tenantId);
      brandStats[key].transactions++;

      totalRevenue += item.subtotal;
      totalUnits += item.quantity;
    });

    // Calculate market share
    const brands = Object.values(brandStats)
      .map(b => ({
        brand: b.brand,
        category: b.category,
        revenue: b.revenue,
        units: b.units,
        revenueShare: totalRevenue > 0 ? Math.round((b.revenue / totalRevenue) * 100 * 100) / 100 : 0,
        unitShare: totalUnits > 0 ? Math.round((b.units / totalUnits) * 100 * 100) / 100 : 0,
        tenantCount: b.tenants.size,
        transactionCount: b.transactions
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50);

    // Group by category
    const categoryBreakdown = {};
    brands.forEach(b => {
      if (!categoryBreakdown[b.category]) {
        categoryBreakdown[b.category] = { revenue: 0, units: 0, brands: [] };
      }
      categoryBreakdown[b.category].revenue += b.revenue;
      categoryBreakdown[b.category].units += b.units;
      categoryBreakdown[b.category].brands.push(b.brand);
    });

    res.json({
      period: parseInt(period),
      totalRevenue,
      totalUnits,
      brands,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([cat, data]) => ({
        category: cat,
        revenue: data.revenue,
        units: data.units,
        brandCount: data.brands.length,
        topBrands: data.brands.slice(0, 5)
      })).sort((a, b) => b.revenue - a.revenue)
    });
  } catch (error) {
    console.error('Brand share error:', error);
    res.status(500).json({ error: 'Failed to calculate brand market share' });
  }
});

// ==========================================
// GEOSPATIAL SPENDING ANALYSIS
// ==========================================

// GET /api/market-intelligence/spending-by-location - Get spending patterns by tenant location
router.get('/spending-by-location', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { period = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get sales grouped by tenant
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { sales: true, users: true, products: true } },
        sales: {
          where: {
            createdAt: { gte: startDate },
            paymentStatus: { not: 'voided' }
          },
          select: {
            finalAmount: true,
            createdAt: true,
            items: {
              select: { quantity: true, subtotal: true }
            }
          }
        }
      }
    });

    // Aggregate by business type (as proxy for location/area type)
    const locationStats = {};

    tenants.forEach(tenant => {
      const location = tenant.businessType || 'UNKNOWN';
      const country = tenant.country || 'GH';
      const key = `${country}|${location}`;

      locationStats[key] = locationStats[key] || {
        country,
        businessType: location,
        tenantCount: 0,
        totalRevenue: 0,
        totalTransactions: 0,
        totalItems: 0,
        avgTicket: 0,
        hourlyDistribution: Array(24).fill(0)
      };

      locationStats[key].tenantCount++;

      tenant.sales.forEach(sale => {
        locationStats[key].totalRevenue += sale.finalAmount;
        locationStats[key].totalTransactions++;
        locationStats[key].totalItems += sale.items.reduce((sum, i) => sum + i.quantity, 0);

        // Track hourly distribution
        const hour = new Date(sale.createdAt).getHours();
        locationStats[key].hourlyDistribution[hour]++;
      });
    });

    // Calculate averages
    const locations = Object.values(locationStats).map(loc => ({
      ...loc,
      avgTicket: loc.totalTransactions > 0
        ? Math.round(loc.totalRevenue / loc.totalTransactions)
        : 0,
      avgTransactionsPerTenant: loc.tenantCount > 0
        ? Math.round(loc.totalTransactions / loc.tenantCount)
        : 0,
      peakHours: loc.hourlyDistribution
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(h => `${h.hour}:00`)
    })).sort((a, b) => b.totalRevenue - a.revenue);

    res.json({
      period: parseInt(period),
      locations,
      summary: {
        totalCountries: new Set(locations.map(l => l.country)).size,
        totalLocations: locations.length,
        totalRevenue: locations.reduce((sum, l) => sum + l.totalRevenue, 0),
        totalTransactions: locations.reduce((sum, l) => sum + l.totalTransactions, 0)
      }
    });
  } catch (error) {
    console.error('Spending by location error:', error);
    res.status(500).json({ error: 'Failed to analyze spending by location' });
  }
});

// GET /api/market-intelligence/peak-hours - Get peak trading hours across platform
router.get('/peak-hours', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { period = 7, tenantId, country } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: startDate },
        paymentStatus: { not: 'voided' },
        ...(tenantId && { tenantId }),
        ...(country && { tenant: { country } })
      },
      select: {
        createdAt: true,
        finalAmount: true,
        tenant: { select: { businessType: true, country: true } }
      }
    });

    // Aggregate by hour and day
    const hourlyStats = Array(24).fill(null).map((_, hour) => ({
      hour,
      transactions: 0,
      revenue: 0
    }));

    const dailyStats = Array(7).fill(null).map((_, day) => ({
      day,
      dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
      transactions: 0,
      revenue: 0
    }));

    sales.forEach(sale => {
      const date = new Date(sale.createdAt);
      const hour = date.getHours();
      const day = date.getDay();

      hourlyStats[hour].transactions++;
      hourlyStats[hour].revenue += sale.finalAmount;

      dailyStats[day].transactions++;
      dailyStats[day].revenue += sale.finalAmount;
    });

    // Find peak times
    const peakHour = hourlyStats.reduce((max, h) => h.transactions > max.transactions ? h : max, hourlyStats[0]);
    const peakDay = dailyStats.reduce((max, d) => d.transactions > max.transactions ? d : max, dailyStats[0]);

    res.json({
      period: parseInt(period),
      totalTransactions: sales.length,
      hourlyStats,
      dailyStats,
      insights: {
        peakHour: `${peakHour.hour}:00 - ${peakHour.hour + 1}:00`,
        peakHourTransactions: peakHour.transactions,
        peakDay: peakDay.dayName,
        peakDayTransactions: peakDay.transactions,
        quietestHour: hourlyStats.reduce((min, h) => h.transactions < min.transactions ? h : min, hourlyStats[0]).hour,
        busiestPeriod: peakHour.hour < 12 ? 'Morning' : peakHour.hour < 17 ? 'Afternoon' : 'Evening'
      }
    });
  } catch (error) {
    console.error('Peak hours error:', error);
    res.status(500).json({ error: 'Failed to analyze peak hours' });
  }
});

// ==========================================
// DATA EXPORT API (Data-as-a-Service)
// ==========================================

// GET /api/market-intelligence/export/summary - Get anonymized platform summary
router.get('/export/summary', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { period = 30, format = 'json' } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Aggregate anonymized data
    const [
      tenantCount,
      salesStats,
      productStats,
      categoryStats
    ] = await Promise.all([
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.sale.aggregate({
        where: {
          createdAt: { gte: startDate },
          paymentStatus: { not: 'voided' }
        },
        _sum: { finalAmount: true },
        _count: true,
        _avg: { finalAmount: true }
      }),
      prisma.product.aggregate({
        where: { isActive: true },
        _count: true,
        _avg: { sellingPrice: true }
      }),
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: {
            createdAt: { gte: startDate },
            paymentStatus: { not: 'voided' }
          }
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 100
      })
    ]);

    // Get category data
    const productIds = categoryStats.map(c => c.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, customCategory: true }
    });

    const productCategoryMap = Object.fromEntries(products.map(p => [p.id, p.customCategory || 'General']));

    // Aggregate by category
    const categoryAggregates = {};
    categoryStats.forEach(stat => {
      const cat = productCategoryMap[stat.productId] || 'General';
      categoryAggregates[cat] = categoryAggregates[cat] || { revenue: 0, units: 0 };
      categoryAggregates[cat].revenue += stat._sum.subtotal || 0;
      categoryAggregates[cat].units += stat._sum.quantity || 0;
    });

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        period: `${period} days`,
        dataType: 'anonymized_aggregate'
      },
      platformSummary: {
        activeTenants: tenantCount,
        transactionVolume: salesStats._count,
        totalRevenue: salesStats._sum.finalAmount || 0,
        averageTicketSize: Math.round(salesStats._avg.finalAmount || 0),
        activeProducts: productStats._count,
        averageProductPrice: Math.round(productStats._avg.sellingPrice || 0)
      },
      categoryPerformance: Object.entries(categoryAggregates)
        .map(([category, data]) => ({
          category,
          revenue: data.revenue,
          units: data.units,
          revenueShare: salesStats._sum.finalAmount
            ? Math.round((data.revenue / salesStats._sum.finalAmount) * 100 * 100) / 100
            : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
    };

    if (format === 'csv') {
      // Convert to CSV
      const csvRows = [
        ['Metric', 'Value'],
        ['Active Tenants', exportData.platformSummary.activeTenants],
        ['Transaction Volume', exportData.platformSummary.transactionVolume],
        ['Total Revenue', exportData.platformSummary.totalRevenue],
        ['Average Ticket Size', exportData.platformSummary.averageTicketSize],
        ['Active Products', exportData.platformSummary.activeProducts],
        ['Average Product Price', exportData.platformSummary.averageProductPrice],
        [],
        ['Category', 'Revenue', 'Units', 'Revenue Share %'],
        ...exportData.categoryPerformance.map(c => [c.category, c.revenue, c.units, c.revenueShare])
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=platform-summary-${period}d.csv`);
      return res.send(csvRows.map(row => row.join(',')).join('\n'));
    }

    res.json(exportData);
  } catch (error) {
    console.error('Export summary error:', error);
    res.status(500).json({ error: 'Failed to export platform summary' });
  }
});

// GET /api/market-intelligence/export/trends - Get trend data for external consumption
router.get('/export/trends', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { period = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get daily aggregates
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: startDate },
        paymentStatus: { not: 'voided' }
      },
      select: {
        createdAt: true,
        finalAmount: true
      }
    });

    // Aggregate by date
    const dailyData = {};
    sales.forEach(sale => {
      const date = sale.createdAt.toISOString().split('T')[0];
      dailyData[date] = dailyData[date] || { date, transactions: 0, revenue: 0 };
      dailyData[date].transactions++;
      dailyData[date].revenue += sale.finalAmount;
    });

    const trends = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate moving averages
    const movingAvg = trends.map((day, i) => {
      const window = trends.slice(Math.max(0, i - 6), i + 1);
      return {
        ...day,
        ma7_transactions: Math.round(window.reduce((sum, d) => sum + d.transactions, 0) / window.length),
        ma7_revenue: Math.round(window.reduce((sum, d) => sum + d.revenue, 0) / window.length)
      };
    });

    res.json({
      metadata: {
        exportedAt: new Date().toISOString(),
        period: `${period} days`,
        dataPoints: trends.length
      },
      trends: movingAvg
    });
  } catch (error) {
    console.error('Export trends error:', error);
    res.status(500).json({ error: 'Failed to export trend data' });
  }
});

// ==========================================
// PRICE ELASTICITY ANALYSIS
// ==========================================

// GET /api/market-intelligence/price-elasticity - Analyze price vs volume relationships
router.get('/price-elasticity', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { productName, category, period = 90 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get sale items with historical prices
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          createdAt: { gte: startDate },
          paymentStatus: { not: 'voided' }
        },
        ...(productName && {
          product: { name: { contains: productName, mode: 'insensitive' } }
        }),
        ...(category && {
          product: { customCategory: { contains: category, mode: 'insensitive' } }
        })
      },
      include: {
        product: { select: { name: true, customCategory: true } },
        sale: { select: { createdAt: true } }
      }
    });

    // Group by product and price point
    const productPriceData = {};

    saleItems.forEach(item => {
      const productName = item.product.name;
      const pricePoint = Math.round(item.unitPrice / 10) * 10; // Round to nearest 10

      productPriceData[productName] = productPriceData[productName] || {
        name: productName,
        category: item.product.customCategory,
        pricePoints: {}
      };

      productPriceData[productName].pricePoints[pricePoint] =
        productPriceData[productName].pricePoints[pricePoint] || { units: 0, revenue: 0 };

      productPriceData[productName].pricePoints[pricePoint].units += item.quantity;
      productPriceData[productName].pricePoints[pricePoint].revenue += item.subtotal;
    });

    // Calculate elasticity for products with multiple price points
    const elasticityData = Object.values(productPriceData)
      .filter(p => Object.keys(p.pricePoints).length >= 2)
      .map(product => {
        const prices = Object.entries(product.pricePoints)
          .map(([price, data]) => ({
            price: parseFloat(price),
            units: data.units,
            revenue: data.revenue
          }))
          .sort((a, b) => a.price - b.price);

        // Simple elasticity calculation: % change in quantity / % change in price
        let totalElasticity = 0;
        let comparisons = 0;

        for (let i = 1; i < prices.length; i++) {
          const pctPriceChange = (prices[i].price - prices[i-1].price) / prices[i-1].price;
          const pctQtyChange = (prices[i].units - prices[i-1].units) / prices[i-1].units;

          if (pctPriceChange !== 0) {
            totalElasticity += pctQtyChange / pctPriceChange;
            comparisons++;
          }
        }

        const avgElasticity = comparisons > 0 ? totalElasticity / comparisons : 0;

        return {
          product: product.name,
          category: product.category,
          priceRange: `${prices[0].price} - ${prices[prices.length-1].price}`,
          elasticity: Math.round(avgElasticity * 100) / 100,
          elasticityType: avgElasticity < -1 ? 'Elastic' : avgElasticity > -1 && avgElasticity < 0 ? 'Inelastic' : 'Unusual',
          pricePoints: prices.length
        };
      })
      .sort((a, b) => a.elasticity - b.elasticity);

    res.json({
      period: parseInt(period),
      productsAnalyzed: elasticityData.length,
      elasticityData,
      summary: {
        elasticProducts: elasticityData.filter(p => p.elasticityType === 'Elastic').length,
        inelasticProducts: elasticityData.filter(p => p.elasticityType === 'Inelastic').length
      }
    });
  } catch (error) {
    console.error('Price elasticity error:', error);
    res.status(500).json({ error: 'Failed to analyze price elasticity' });
  }
});

module.exports = router;
