import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, Product, Order, OrderStatus, handleFirestoreError, OperationType } from '../../firebase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  AlertCircle,
  Clock,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStockValue: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Products stats
        const productsSnap = await getDocs(collection(db, 'products'));
        const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        let totalStockValue = 0;
        products.forEach(p => totalStockValue += (p.price * p.stock));
        
        setLowStockItems(products.filter(p => p.stock < 10).sort((a,b) => a.stock - b.stock).slice(0, 5));

        // Orders stats
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        
        let totalRevenue = 0;
        let pendingOrders = 0;
        orders.forEach(o => {
          if (o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.REJECTED) totalRevenue += o.totalAmount;
          if (o.status === OrderStatus.PENDING) pendingOrders++;
        });

        setStats({
          totalProducts: products.length,
          totalStockValue,
          totalOrders: orders.length,
          totalRevenue,
          pendingOrders,
        });

        // Simple chart data (by status)
        const statusCounts = orders.reduce((acc: any, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        }, {});

        // Color mapping for bars (optional, but good for visual clarity)
        const labels: Record<string, string> = {
          [OrderStatus.PENDING]: 'Pending',
          [OrderStatus.PROCESSING]: 'In Flow',
          [OrderStatus.SHIPPED]: 'Shipped',
          [OrderStatus.DELIVERED]: 'Delivered',
          [OrderStatus.CANCELLED]: 'Voided',
          [OrderStatus.REJECTED]: 'Rejected',
        };

        setChartData(Object.entries(statusCounts).map(([name, value]) => ({ 
          name: labels[name] || name, 
          value 
        })));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'dashboard_data');
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-8 h-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Highlight Card */}
        <section className="glass-card p-10 col-span-1 lg:col-span-2 flex flex-col md:flex-row justify-between relative overflow-hidden">
          <div className="flex flex-col justify-between z-10 space-y-6">
            <div>
              <h2 className="font-bold text-lg mb-1 opacity-60">Revenue Performance</h2>
              <p className="text-5xl font-light text-brand-accent tracking-tighter">{stats.totalRevenue.toLocaleString()} Ks</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-600 rounded-full font-bold uppercase tracking-wider">↑ 14% vs Last Period</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="liquid-button text-xs py-3 px-6">Generate Report</button>
              <button className="bg-white/60 border border-brand-light px-6 py-3 rounded-2xl text-brand-deep font-bold text-xs hover:bg-white transition-colors">Export CSV</button>
            </div>
          </div>
          
            <div className="flex-1 flex items-end justify-around gap-2 px-4 h-48 md:h-full mt-8 md:mt-0">
            {chartData.map((d, i) => (
              <motion.div 
                key={d.name}
                initial={{ height: 0 }}
                animate={{ height: `${(d.value / Math.max(...chartData.map(v => v.value), 1)) * 80 + 10}%` }}
                transition={{ delay: i * 0.1, duration: 1, ease: "circOut" }}
                className={`w-10 rounded-t-2xl shadow-sm ${i === chartData.length - 1 ? 'bg-brand-pink' : 'bg-brand-light/40'}`}
              />
            ))}
          </div>
        </section>

        {/* Active tracking teaser/Quick stats */}
        <section className="tracking-card flex flex-col justify-between">
          <div className="z-10">
            <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-brand-pink" />
              Store Velocity
            </h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold opacity-40">Orders Handled</p>
                  <p className="text-2xl font-serif italic text-brand-bg">{stats.totalOrders}</p>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <ShoppingCart size={18} />
                </div>
              </div>
              <div className="space-y-2">
                 <div className="relative h-1 bg-white/10 rounded-full">
                    <div className="absolute left-0 top-0 h-full w-3/4 bg-brand-pink rounded-full shadow-[0_0_10px_rgba(255,146,165,0.5)]"></div>
                 </div>
                 <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest opacity-50">
                   <span>Processing</span>
                   <span className="text-brand-pink">Optimized</span>
                   <span>Scaled</span>
                 </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Inventory status */}
         <section className="glass-card p-8 flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-bold text-lg">Inventory Alerts</h2>
              <PackageCheck className="text-brand-pink" />
            </div>
            <div className="space-y-4">
              {lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-30">
                  <CheckCircle2 size={40} />
                  <p className="text-xs font-bold uppercase mt-2">All Stocks Healthy</p>
                </div>
              ) : lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white/20 rounded-2xl border border-white/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-light/30 flex items-center justify-center text-lg">📦</div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-[10px] px-2 py-1 bg-red-100/50 text-brand-accent rounded-lg font-bold uppercase">Critical ({item.stock})</span>
                </div>
              ))}
            </div>
          </section>

          {/* Stats Grid Expansion */}
          <section className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <StatCard 
              icon={<Package className="text-brand-pink" />} 
              label="Inventory Assets" 
              value={stats.totalProducts} 
              detail={`${stats.totalProducts} unique SKU units`}
            />
            <StatCard 
              icon={<TrendingUp className="text-green-500" />} 
              label="Est. Assets Value" 
              value={`${stats.totalStockValue.toLocaleString()} Ks`} 
              detail="Based on unit retail price"
            />
            <StatCard 
              icon={<Clock className="text-orange-500" />} 
              label="Pending Actions" 
              value={stats.pendingOrders} 
              detail="Orders awaiting processing"
            />
            <StatCard 
              icon={<CheckCircle2 className="text-blue-500" />} 
              label="Success Rate" 
              value="98.2%" 
              detail="Fulfillment completion"
            />
          </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode, label: string, value: string | number, detail: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="glass-card p-8 flex flex-col justify-between group"
    >
      <div className="w-12 h-12 bg-white/60 rounded-2xl flex items-center justify-center shadow-inner mb-4 transition-transform group-hover:rotate-6">
        {icon}
      </div>
      <div>
        <p className="text-brand-deep/40 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-bold text-brand-deep tracking-tight mb-2">{value}</p>
        <p className="text-[10px] text-brand-deep/30 font-medium">{detail}</p>
      </div>
    </motion.div>
  );
}
