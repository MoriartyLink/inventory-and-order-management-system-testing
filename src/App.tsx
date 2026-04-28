import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, Role, UserProfile, handleFirestoreError, OperationType } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  ShoppingCart, 
  BarChart3, 
  User as UserIcon, 
  LogOut, 
  LayoutDashboard,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  PackageCheck,
  Clock,
  Menu,
  X
} from 'lucide-react';
import InventoryList from './components/inventory/InventoryList';
import OrderList from './components/orders/OrderList';
import Dashboard from './components/reports/Dashboard';

// Context
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'inventory' | 'orders'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (profile && profile.role === Role.ADMIN && currentTab === 'dashboard') {
      setCurrentTab('inventory');
    }
  }, [profile, currentTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile({ id: user.uid, ...userDoc.data() } as UserProfile);
          } else {
            // If first user, make Owner. Otherwise Admin (for demo purposes)
            // In real world, first user is owner, others are invited.
            const role = (user.email === 'moriartylink@gmail.com') ? Role.OWNER : Role.ADMIN;
            const newProfile = {
              email: user.email!,
              name: user.displayName || 'User',
              role: role,
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile({ id: user.uid, ...newProfile } as any);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 max-w-md w-full text-center space-y-8"
        >
          <div className="w-24 h-24 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Package className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-brand-deep leading-tight">Inventory Management & Order System</h1>
            <p className="text-brand-deep/60">Professional Fulfillment Platform</p>
          </div>
          <button 
            onClick={signIn}
            className="liquid-button w-full flex items-center justify-center gap-3 active:scale-95 transition-transform"
          >
            <UserIcon className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      <div className="h-screen flex overflow-hidden p-6 gap-6 relative">
        {/* Immersive Sidebar */}
        <aside className="hidden lg:flex w-72 h-full glass-card flex-col p-8 transition-all duration-500">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-full bg-brand-light shadow-inner flex items-center justify-center">
              <Package size={20} className="text-white" />
            </div>
            <h1 className="font-bold text-sm leading-tight tracking-tight text-brand-deep">Inventory Management<br/>& Order System</h1>
          </div>
          
          <nav className="space-y-3 flex-1">
            {profile?.role === Role.OWNER && (
              <SidebarNavBtn active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
            )}
            <SidebarNavBtn active={currentTab === 'inventory'} onClick={() => setCurrentTab('inventory')} icon={<Package size={20} />} label="Inventory" />
            <SidebarNavBtn active={currentTab === 'orders'} onClick={() => setCurrentTab('orders')} icon={<ShoppingCart size={20} />} label="Order Tracking" />
          </nav>

          <div className="mt-auto space-y-4">
            <div className={`p-5 rounded-3xl border border-white/50 shadow-sm ${
              profile?.role === Role.OWNER 
                ? 'bg-brand-accent/10' 
                : 'bg-brand-light/20'
            }`}>
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2">Authorized {profile?.role}</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${
                  profile?.role === Role.OWNER ? 'bg-brand-accent text-white' : 'bg-white/60 text-brand-pink'
                }`}>
                  <UserIcon size={18} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-brand-deep truncate">{profile?.name}</p>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${profile?.role === Role.OWNER ? 'bg-green-500' : 'bg-brand-accent'}`} />
                    <p className="text-[9px] text-brand-deep/60 font-bold uppercase tracking-tighter">System {profile?.role}</p>
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 p-3 text-brand-deep/60 hover:text-red-500 transition-colors uppercase text-[10px] font-bold tracking-widest"
            >
              <LogOut size={14} />
              Logout System
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Header */}
          <header className="h-20 w-full glass-header px-8 flex items-center justify-between">
            <div className="flex items-center gap-4 lg:hidden">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-brand-deep"
              >
                <Menu size={24} />
              </button>
              <h1 className="font-bold text-sm text-brand-deep">Inventory System</h1>
            </div>

            <div className="hidden md:block relative">
              <input 
                type="text" 
                placeholder="Search resources..." 
                className="glass-input w-80 pl-10 pr-4 py-2"
              />
              <Search className="absolute left-3 top-2.5 opacity-30 text-brand-deep" size={16} />
            </div>

            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-2xl bg-white/60 border border-white flex items-center justify-center text-brand-deep shadow-sm cursor-pointer hover:bg-white transition-colors relative">
                <TrendingUp size={18} className="text-brand-pink" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-accent rounded-full border-2 border-white" />
              </div>
            </div>
          </header>

          {/* Main View */}
          <main className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: "circOut" }}
                className="pb-8"
              >
                {currentTab === 'dashboard' && <Dashboard />}
                {currentTab === 'inventory' && <InventoryList />}
                {currentTab === 'orders' && <OrderList />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden fixed inset-0 bg-brand-deep/20 backdrop-blur-sm z-[60]"
              />
              <motion.aside 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-white/90 backdrop-blur-2xl z-[70] p-8 flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between mb-12">
                  <h1 className="font-bold text-xl text-brand-deep">Inventory System</h1>
                  <button onClick={() => setIsMobileMenuOpen(false)}><X size={24} /></button>
                </div>
                <nav className="space-y-4">
                  {profile?.role === Role.OWNER && (
                    <SidebarNavBtn active={currentTab === 'dashboard'} onClick={() => { setCurrentTab('dashboard'); setIsMobileMenuOpen(false); }} icon={<LayoutDashboard size={20} />} label="Dashboard" />
                  )}
                  <SidebarNavBtn active={currentTab === 'inventory'} onClick={() => { setCurrentTab('inventory'); setIsMobileMenuOpen(false); }} icon={<Package size={20} />} label="Inventory" />
                  <SidebarNavBtn active={currentTab === 'orders'} onClick={() => { setCurrentTab('orders'); setIsMobileMenuOpen(false); }} icon={<ShoppingCart size={20} />} label="Orders" />
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </AuthContext.Provider>
  );
}

function SidebarNavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 ${
        active 
          ? 'bg-white/70 shadow-sm border border-white/60 text-brand-deep font-bold' 
          : 'text-brand-deep/50 hover:bg-white/30 hover:text-brand-deep'
      }`}
    >
      <span className={active ? 'text-brand-pink scale-110' : ''}>{icon}</span>
      <span className="text-sm tracking-tight">{label}</span>
      {active && <motion.div layoutId="nav-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-pink" />}
    </button>
  );
}
