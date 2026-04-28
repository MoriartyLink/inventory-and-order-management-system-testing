import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db, Product, handleFirestoreError, OperationType, Role } from '../../firebase';
import { useAuth } from '../../App';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  ChevronRight,
  MoreVertical,
  X,
  Save,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InventoryList() {
  const { profile } = useAuth();
  const isOwner = profile?.role === Role.OWNER;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return unsubscribe;
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      }
    }
  };

  return (
    <div className="space-y-6 h-full pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-brand-deep tracking-tight">Active Inventory</h2>
          <p className="text-brand-deep/50 text-sm">Real-time stock management and logic.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Filter catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input w-full md:w-64 pl-10"
            />
            <Search className="absolute left-3 top-2.5 opacity-30 text-brand-deep" size={16} />
          </div>
          {isOwner && (
            <button 
              onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
              className="liquid-button flex items-center gap-2 group"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="hidden md:inline">Catalog Entry</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-brand-pink" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                canEdit={isOwner}
                onEdit={() => { setEditingProduct(product); setIsModalOpen(true); }}
                onDelete={() => handleDelete(product.id)}
              />
            ))}
          </AnimatePresence>
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center glass-card">
              <Package size={48} className="mx-auto text-brand-pink/20 mb-4" />
              <p className="text-brand-deep/40 italic">Inventory search returned no results.</p>
            </div>
          )}
        </div>
      )}

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <ProductModal 
            onClose={() => setIsModalOpen(false)} 
            product={editingProduct} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({ product, onEdit, onDelete, canEdit }: { product: Product, onEdit: () => void, onDelete: () => Promise<void> | void, canEdit: boolean, key?: any }) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="glass-card overflow-hidden group hover:shadow-2xl transition-all duration-500 border-l-4 border-l-brand-pink"
    >
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex gap-4 items-center">
            {product.imageUrl && (
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <h4 className="font-bold text-lg text-brand-deep tracking-tight">{product.name}</h4>
              <p className="text-[10px] text-brand-pink font-bold uppercase tracking-widest">{product.category}</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onEdit} className="p-2 hover:bg-brand-light/20 text-brand-deep/40 hover:text-brand-pink rounded-xl transition-colors">
                <Edit2 size={16} />
              </button>
              <button onClick={onDelete} className="p-2 hover:bg-red-50 text-brand-deep/40 hover:text-brand-accent rounded-xl transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-brand-light/30">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-brand-deep/30 tracking-widest mb-1">Unit Price</span>
            <span className="text-sm font-bold text-brand-deep">
              {product.price.toLocaleString()} Ks
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase font-bold text-brand-deep/30 tracking-widest mb-1">Stock Load</span>
            <div className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${
              product.stock < 10 
                ? 'bg-red-100 text-brand-accent animate-pulse' 
                : 'bg-brand-light/30 text-brand-pink'
            }`}>
              {product.stock} units • {product.stock < 10 ? 'Low' : 'Stable'}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProductModal({ onClose, product }: { onClose: () => void, product: Product | null }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || 0,
    stock: product?.stock || 0,
    category: product?.category || 'General',
    imageUrl: product?.imageUrl || ''
  });
  const [saving, setSaving] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
        updatedAt: serverTimestamp()
      };

      if (product) {
        await updateDoc(doc(db, 'products', product.id), data);
      } else {
        await addDoc(collection(db, 'products'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-brand-deep/20 backdrop-blur-md" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-card max-w-2xl w-full p-10 relative z-10 space-y-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold tracking-tight">{product ? 'Update Data' : 'New Catalog Entry'}</h3>
          <button onClick={onClose} className="text-brand-deep/30 hover:text-brand-deep"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-brand-deep/40 uppercase tracking-widest ml-1">Entity Reference</label>
              <input 
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="glass-card bg-white/40 w-full px-6 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-light" 
                placeholder="Item Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-brand-deep/40 uppercase tracking-widest ml-1">Price (Ks)</label>
                <input 
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className="glass-card bg-white/40 w-full px-6 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-light" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-brand-deep/40 uppercase tracking-widest ml-1">Stock</label>
                <input 
                  type="number"
                  required
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
                  className="glass-card bg-white/40 w-full px-6 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-light" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-brand-deep/40 uppercase tracking-widest ml-1">Classification</label>
              <input 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="glass-card bg-white/40 w-full px-6 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-light" 
                placeholder="Product Category"
              />
            </div>
          </div>

          <div className="space-y-6 flex flex-col">
            <div className="space-y-2 flex-1">
              <label className="text-[10px] font-bold text-brand-deep/40 uppercase tracking-widest ml-1">Visual Asset</label>
              <div className="glass-card bg-white/40 border-dashed border-2 border-brand-light/30 h-48 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                {formData.imageUrl ? (
                  <>
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, imageUrl: '' })}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-brand-deep/30">
                    <Package size={40} />
                    <p className="text-[10px] font-bold uppercase">Upload Product Image</p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={saving}
              className="liquid-button w-full flex items-center justify-center gap-3 active:scale-95 transition-transform mt-auto"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {product ? 'Synchronize' : 'Commit Entry'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
