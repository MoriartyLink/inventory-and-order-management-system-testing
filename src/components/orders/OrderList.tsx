import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  arrayUnion,
  query,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db, Order, OrderStatus, Product, handleFirestoreError, OperationType, Role } from '../../firebase';
import { 
  Search, 
  ShoppingCart, 
  Truck, 
  CheckCircle2, 
  Clock, 
  XCircle,
  MoreVertical,
  Plus,
  Loader2,
  X,
  Package,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../App';

export default function OrderList() {
  const { profile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });
    return unsubscribe;
  }, []);

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(search.toLowerCase()) || 
    o.id.toLowerCase().includes(search.toLowerCase())
  );

  const updateStatus = async (id: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === id);
    if (!order || order.status === newStatus) return;

    // Permissions check
    const isOwner = profile?.role === Role.OWNER;
    const isCreator = order.createdBy === user?.uid;
    
    if (!isCreator && !(isOwner && newStatus === OrderStatus.REJECTED)) {
      alert("Permission Denied: Only the creator can modify this order. System owners may only 'Reject'.");
      return;
    }

    try {
      const historyEntry = {
        status: newStatus,
        updatedAt: new Date().toISOString(), // Using string for immediate local UI feedback, rules will check server time on write
        updatedBy: user?.uid || 'unknown',
        updaterName: profile?.name || 'Staff'
      };

      // Logic for stock reconciliation
      if ((newStatus === OrderStatus.CANCELLED || newStatus === OrderStatus.REJECTED) && 
          (order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.REJECTED)) {
        for (const item of order.items) {
          const productRef = doc(db, 'products', item.productId);
          const productDoc = await getDoc(productRef);
          if (productDoc.exists()) {
            await updateDoc(productRef, {
              stock: (productDoc.data().stock || 0) + item.quantity
            });
          }
        }
      } 
      else if ((order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REJECTED) && 
               (newStatus !== OrderStatus.CANCELLED && newStatus !== OrderStatus.REJECTED)) {
        for (const item of order.items) {
          const productRef = doc(db, 'products', item.productId);
          const productDoc = await getDoc(productRef);
          if (productDoc.exists()) {
            const currentStock = productDoc.data().stock || 0;
            if (currentStock < item.quantity) {
              alert(`Insufficient stock for ${item.productName}. Currently ${currentStock} units available.`);
              return;
            }
            await updateDoc(productRef, {
              stock: currentStock - item.quantity
            });
          }
        }
      }

      await updateDoc(doc(db, 'orders', id), { 
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
        updaterName: profile?.name || 'Unknown Staff',
        updaterRole: profile?.role || Role.ADMIN,
        statusHistory: arrayUnion(historyEntry)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
  };

  return (
    <div className="space-y-6 h-full pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-brand-deep tracking-tight">Active Fulfillment</h2>
          <p className="text-brand-deep/50 text-sm">Real-time logistic flow and tracking.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search logistics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input w-full md:w-64 pl-10"
            />
            <Search className="absolute left-3 top-2.5 opacity-30 text-brand-deep" size={16} />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="liquid-button flex items-center gap-2 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="hidden md:inline">Log New Order</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-brand-pink" size={40} />
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {filteredOrders.map(order => (
              <OrderRow 
                key={order.id} 
                order={order} 
                onStatusChange={(status) => updateStatus(order.id, status)}
              />
            ))}
          </AnimatePresence>
          {filteredOrders.length === 0 && (
            <div className="py-20 text-center glass-card">
              <ShoppingCart size={48} className="mx-auto text-brand-pink/20 mb-4" />
              <p className="text-brand-deep/40 italic">Logistics returned no active records.</p>
            </div>
          )}
        </div>
      )}

      {/* New Order Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <OrderModal onClose={() => setIsModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderRow({ order, onStatusChange }: { order: Order, onStatusChange: (status: OrderStatus) => Promise<void> | void, key?: any }) {
  const { profile, user } = useAuth();
  const isCreator = order.createdBy === user?.uid;
  const isOwner = profile?.role === Role.OWNER;

  const statusConfig = {
    [OrderStatus.PENDING]: { icon: <Clock size={16} />, color: 'bg-orange-50 text-orange-600', label: 'Pending' },
    [OrderStatus.PROCESSING]: { icon: <Loader2 size={16} className="animate-spin" />, color: 'bg-blue-50 text-blue-600', label: 'In Flow' },
    [OrderStatus.SHIPPED]: { icon: <Truck size={16} />, color: 'bg-purple-50 text-purple-600', label: 'Shipped' },
    [OrderStatus.DELIVERED]: { icon: <CheckCircle2 size={16} />, color: 'bg-green-50 text-green-600', label: 'Delivered' },
    [OrderStatus.CANCELLED]: { icon: <XCircle size={16} />, color: 'bg-red-50 text-brand-accent', label: 'Voided' },
    [OrderStatus.REJECTED]: { icon: <AlertCircle size={16} />, color: 'bg-slate-100 text-slate-500', label: 'Rejected' },
  };

  const currentStatus = statusConfig[order.status];

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:shadow-2xl transition-all duration-500"
    >
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center text-xl shadow-inner ${currentStatus.color.split(' ')[0]}`}>
          {currentStatus.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-lg text-brand-deep tracking-tight">{order.customerName}</h4>
            <div className="flex flex-col">
              <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase w-fit ${order.creatorRole === Role.OWNER ? 'bg-brand-pink/20 text-brand-pink' : 'bg-slate-100 text-slate-400'}`}>
                Opened by {order.creatorName?.split(' ')[0] || 'Staff'}
              </span>
              {order.updaterName && (
                <span className="text-[8px] px-1.5 py-0.5 font-bold uppercase text-brand-accent/60 italic">
                  Modified by {order.updaterName?.split(' ')[0] || 'Staff'}
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-brand-deep/30 font-mono tracking-widest bg-brand-light/20 inline-block px-2 py-0.5 rounded mt-1">ID_{order.id.slice(-6).toUpperCase()}</p>
          
          {/* Status History Audit Trail */}
          <div className="mt-4 space-y-2 max-w-xs">
            <p className="text-[9px] uppercase font-bold opacity-30 tracking-tighter flex items-center gap-1">
              <Clock size={10} /> Activity Log
            </p>
            <div className="border-l border-brand-light/40 ml-1 pl-3 space-y-2">
              <div className="relative">
                <div className="absolute -left-[14.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-brand-pink shadow-sm" />
                <p className="text-[10px] font-bold text-brand-deep/60">Order Created</p>
                <p className="text-[9px] text-brand-deep/30">{order.creatorName} at {new Date(order.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              {order.statusHistory?.map((entry, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[14.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-brand-accent shadow-sm" />
                  <p className="text-[10px] font-bold text-brand-deep/80 capitalize">Status: {entry.status}</p>
                  <p className="text-[9px] text-brand-deep/40">{entry.updaterName || 'Staff'} • {new Date(entry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-6 items-center">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold text-brand-deep/30 tracking-widest mb-1">Payload</span>
          <span className="text-sm font-semibold text-brand-deep/80">{order.items.length} Units</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold text-brand-deep/30 tracking-widest mb-1">Valuation</span>
          <span className="text-sm font-bold text-brand-accent">{order.totalAmount.toLocaleString()} Ks</span>
        </div>
        <div className="flex flex-col col-span-2">
          <span className="text-[9px] uppercase font-bold text-brand-deep/30 tracking-widest mb-2">Transit Progress</span>
          <div className="relative h-1.5 w-full bg-brand-light/30 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.REJECTED) ? '100%' : order.status === OrderStatus.SHIPPED ? '75%' : '25%' }}
              className={`absolute top-0 left-0 h-full rounded-full ${
                order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REJECTED ? 'bg-slate-300' : 'bg-brand-accent'
              }`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isCreator ? (
          <div className="flex bg-white/40 p-1.5 rounded-2xl border border-brand-light/20 shadow-sm">
            {Object.values(OrderStatus).filter(s => s !== OrderStatus.REJECTED).map((status) => {
              const isActive = order.status === status;
              const config = statusConfig[status];
              return (
                <button
                  key={status}
                  onClick={() => onStatusChange(status)}
                  title={status}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isActive 
                      ? `${config.color.split(' ')[0]} ${config.color.split(' ')[1]} shadow-sm scale-105 z-10` 
                      : 'text-brand-deep/20 hover:text-brand-deep/40 hover:bg-white/50'
                  }`}
                >
                  {config.icon}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest border border-white/60 shadow-sm ${currentStatus.color}`}>
              {currentStatus.label}
            </div>
            {isOwner && order.status !== OrderStatus.REJECTED && (
              <button 
                onClick={() => onStatusChange(OrderStatus.REJECTED)}
                className="w-10 h-10 rounded-xl bg-red-50 text-brand-accent flex items-center justify-center hover:bg-red-100 transition-colors shadow-sm"
                title="Reject Order"
              >
                <XCircle size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function OrderModal({ onClose }: { onClose: () => void }) {
  const { profile, user } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<{product: Product, quantity: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const snap = await getDocs(query(collection(db, 'products'), orderBy('name')));
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'products');
      }
    }
    fetchProducts();
  }, []);

  const addItem = (product: Product) => {
    const existing = selectedItems.find(i => i.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return;
      setSelectedItems(selectedItems.map(i => 
        i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      if (product.stock <= 0) return;
      setSelectedItems([...selectedItems, { product, quantity: 1 }]);
    }
  };

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(i => i.product.id !== productId));
  };

  const total = selectedItems.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0 || !customerName) return;
    setSaving(true);
    try {
      const orderData = {
        customerName,
        items: selectedItems.map(i => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          price: i.product.price
        })),
        totalAmount: total,
        status: OrderStatus.PENDING,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid,
        creatorName: profile?.name || 'Unknown Staff',
        creatorRole: profile?.role || Role.ADMIN,
        statusHistory: []
      };

      await addDoc(collection(db, 'orders'), orderData);
      
      for (const item of selectedItems) {
        await updateDoc(doc(db, 'products', item.product.id), {
          stock: item.product.stock - item.quantity
        });
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-brand-deep/20 backdrop-blur-md" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-card max-w-5xl w-full p-10 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10"
      >
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold tracking-tight text-brand-deep">Create Fulfillment</h3>
            <button onClick={onClose} className="md:hidden text-brand-deep/30"><X size={24} /></button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-brand-deep/40 uppercase tracking-widest ml-1">Client Entity</label>
            <input 
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="glass-card bg-white/40 w-full px-6 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-light placeholder:text-brand-deep/20" 
              placeholder="Full Identification"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-brand-deep/40 uppercase tracking-widest ml-1">Asset Selection</label>
            <div className="glass-card bg-white/20 p-2 h-72 overflow-y-auto space-y-2 custom-scrollbar">
              {loading ? <Loader2 className="animate-spin mx-auto mt-10 text-brand-pink" /> : products.map(p => (
                <button 
                  key={p.id}
                  onClick={() => addItem(p)}
                  disabled={p.stock <= 0}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/60 rounded-2xl transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-light/40 rounded-xl flex items-center justify-center text-brand-pink">
                      <Package size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-brand-deep">{p.name}</p>
                      <p className="text-[10px] text-brand-deep/40 font-bold uppercase">{p.price.toLocaleString()} Ks | {p.stock} units left</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-brand-pink group-hover:text-white transition-all">
                    <Plus size={14} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col h-full space-y-8 border-l border-brand-light/30 md:pl-10">
          <div className="flex-1 space-y-6">
            <h4 className="font-bold text-brand-deep/60 uppercase text-[11px] tracking-[0.2em] border-b border-brand-light/30 pb-3">Load Specification</h4>
            <div className="space-y-3">
              {selectedItems.map(item => (
                <div key={item.product.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/40 border border-white shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-brand-deep">{item.product.name}</p>
                    <p className="text-[10px] text-brand-deep/40 font-bold uppercase tracking-wider">{item.quantity} × {item.product.price.toLocaleString()} Ks</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-brand-accent">{ (item.product.price * item.quantity).toLocaleString() } Ks</span>
                    <button onClick={() => removeItem(item.product.id)} className="text-brand-deep/20 hover:text-red-500 transition-colors"><X size={18} /></button>
                  </div>
                </div>
              ))}
              {selectedItems.length === 0 && <p className="text-sm text-brand-deep/30 italic text-center py-20 font-medium">No items in fulfillment load</p>}
            </div>
          </div>

          <div className="pt-6 border-t border-brand-light/30 space-y-6">
            <div className="flex justify-between items-end">
              <span className="text-brand-deep/40 uppercase text-[10px] font-bold tracking-[0.3em]">Aggregate Total</span>
              <span className="text-4xl font-light text-brand-accent tracking-tighter">{total.toLocaleString()} Ks</span>
            </div>
            <button 
              onClick={handleSubmit}
              disabled={saving || selectedItems.length === 0 || !customerName}
              className="liquid-button w-full flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 transition-transform"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={24} />}
              Authorize Fulfillment
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
