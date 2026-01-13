
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, Client } from './types';
import { CATEGORIES } from './constants';
import { analyzeFinances } from './services/geminiService';
import { HappyWallet, PiggyBank, Sparkles } from './components/Illustration';
import TransactionCard from './components/TransactionCard';
import { supabase } from './supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [goal, setGoal] = useState({ target_amount: 3000000, title: 'Ganancia Mensual' });
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [usdRate, setUsdRate] = useState<number>(1200); 
  const [vaultTotal, setVaultTotal] = useState<number>(0); 
  const [vaultInput, setVaultInput] = useState<string>('');
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState('others');
  
  const [newClientName, setNewClientName] = useState('');
  const [newClientFee, setNewClientFee] = useState('');

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'clients'>('dashboard');
  const [clientFilter, setClientFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const getPaymentKey = () => {
    const d = new Date();
    return `brisa_payments_${d.getMonth() + 1}_${d.getFullYear()}`;
  };

  useEffect(() => {
    fetchData();
    fetchUsdRate();
    const savedVault = localStorage.getItem('geta_vault_total');
    if (savedVault) setVaultTotal(Number(savedVault));
  }, []);

  const fetchUsdRate = async () => {
    try {
      const response = await fetch('https://dolarapi.com/v1/dolares/blue');
      const data = await response.json();
      if (data && data.venta) setUsdRate(data.venta);
    } catch (error) {
      console.error("Error al obtener dólar:", error);
    }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [transRes, goalRes, clientsRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('goals').select('*').maybeSingle(),
        supabase.from('clients').select('*').order('created_at', { ascending: true })
      ]);

      if (transRes.data) setTransactions(transRes.data);
      if (goalRes.data && goalRes.data.target_amount > 100000) setGoal(goalRes.data);
      
      if (clientsRes.data) {
        const key = getPaymentKey();
        const localPayments = JSON.parse(localStorage.getItem(key) || '{}');
        const mergedClients = clientsRes.data.map((c: any) => ({
          ...c,
          has_paid: !!localPayments[c.id]
        }));
        setClients(mergedClients);
      }
    } catch (err) {
      console.error("Error en carga:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      if (viewMode === 'month') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      }
      return tDate.getFullYear() === now.getFullYear();
    });
  }, [transactions, viewMode]);

  const filteredClients = useMemo(() => {
    if (clientFilter === 'paid') return clients.filter(c => c.has_paid);
    if (clientFilter === 'pending') return clients.filter(c => !c.has_paid);
    return clients;
  }, [clients, clientFilter]);

  const summary = useMemo(() => {
    const totals = filteredTransactions.reduce((acc, curr) => {
      let val = Number(curr.amount);
      const isUSD = curr.description.toLowerCase().includes('(usd)');
      const valInArs = isUSD ? val * usdRate : val;
      if (curr.type === TransactionType.INCOME) acc.totalIncomeArs += valInArs;
      else acc.totalExpenseArs += valInArs;
      return acc;
    }, { totalIncomeArs: 0, totalExpenseArs: 0 });

    const projectedIncome = clients
      .filter(c => c.is_active)
      .reduce((acc, client) => {
        const fee = Number(client.monthly_fee);
        return acc + (client.currency === 'USD' ? fee * usdRate : fee);
      }, 0);

    return {
      ...totals,
      projectedIncome,
      realBalance: totals.totalIncomeArs - totals.totalExpenseArs,
      projectedBalance: projectedIncome - totals.totalExpenseArs
    };
  }, [filteredTransactions, clients, usdRate]);

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      if (t.type === TransactionType.EXPENSE) {
        const catName = CATEGORIES.find(c => c.id === t.category)?.name || 'Otros';
        const isUSD = t.description.toLowerCase().includes('(usd)');
        const valInArs = isUSD ? Number(t.amount) * usdRate : Number(t.amount);
        data[catName] = (data[catName] || 0) + valInArs;
      }
    });
    const results = Object.entries(data).map(([name, value]) => ({ name, value }));
    return results.length > 0 ? results : [{ name: 'Sin datos', value: 0 }];
  }, [filteredTransactions, usdRate]);

  const targetAmount = goal.target_amount;
  const earningsProgress = Math.min(Math.round((summary.projectedIncome / targetAmount) * 100), 100);
  const amountMissing = Math.max(targetAmount - summary.projectedIncome, 0);
  const clientsNeeded = Math.ceil(amountMissing / 300000);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    const newRow = { 
      description, 
      amount: parseFloat(amount), 
      date: new Date().toISOString().split('T')[0], 
      type, 
      category 
    };
    const { error } = await supabase.from('transactions').insert([newRow]);
    if (error) alert("Error: " + error.message);
    else {
      setDescription(''); setAmount('');
      fetchData(true);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientFee) return;
    const payload = {
      name: newClientName,
      monthly_fee: parseFloat(newClientFee),
      currency: 'ARS',
      is_active: true
    };
    const { error } = await supabase.from('clients').insert([payload]);
    if (error) alert("Error: " + error.message);
    else {
      setNewClientName(''); setNewClientFee('');
      fetchData(true);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este cliente?")) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (!error) fetchData(true);
  };

  const toggleClientStatus = async (client: Client) => {
    const newStatus = !client.is_active;
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: newStatus } : c));
    const { error } = await supabase.from('clients').update({ is_active: newStatus }).eq('id', client.id);
    if (error) fetchData(true);
  };

  const togglePaidStatus = (client: Client) => {
    const newPaidStatus = !client.has_paid;
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, has_paid: newPaidStatus } : c));
    const key = getPaymentKey();
    const localPayments = JSON.parse(localStorage.getItem(key) || '{}');
    if (newPaidStatus) localPayments[client.id] = true;
    else delete localPayments[client.id];
    localStorage.setItem(key, JSON.stringify(localPayments));
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("¿Eliminar movimiento?")) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) fetchData(true);
  };

  const handleVaultOperation = (op: 'sum' | 'sub') => {
    const val = parseFloat(vaultInput);
    if (isNaN(val) || val <= 0) return;
    
    setVaultTotal(current => {
      const updated = op === 'sum' ? current + val : Math.max(0, current - val);
      localStorage.setItem('geta_vault_total', updated.toString());
      return updated;
    });
    setVaultInput('');
  };

  const getAiAdvice = async () => {
    setIsAnalyzing(true);
    const advice = await analyzeFinances(filteredTransactions);
    setAiInsight(advice);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen pb-12 flex flex-col bg-[#FCFBFE] text-slate-700 overflow-x-hidden">
      <header className="bg-white/95 backdrop-blur-xl border-b border-purple-50 px-4 py-4 sm:py-5 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-gradient-to-br from-purple-400 to-rose-300 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-lg shadow-purple-100">
                <span className="text-white font-black text-sm sm:text-lg">B</span>
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-800 leading-none">Finanzas <span className="text-purple-400 italic">Brisa</span></h1>
                <p className="text-[7px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">Panel de Control</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-end px-2 sm:px-3 border-r border-slate-100">
                <span className="text-[6px] sm:text-[7px] font-black text-slate-300 uppercase tracking-widest">Dólar</span>
                <span className="text-[10px] sm:text-[11px] font-bold text-purple-400">${usdRate}</span>
              </div>
              <button 
                onClick={getAiAdvice}
                disabled={isAnalyzing}
                className="bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isAnalyzing ? "..." : '✨ BrisaBot'}
              </button>
            </div>
          </div>

          <nav className="flex bg-slate-100/80 p-1 rounded-[16px] sm:rounded-[20px] w-full sm:w-fit shadow-inner overflow-x-auto custom-scrollbar no-scrollbar">
            <button onClick={() => setActiveTab('dashboard')} className={`whitespace-nowrap flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-white text-purple-500 shadow-md' : 'text-slate-400'}`}>Inicio</button>
            <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-purple-500 shadow-md' : 'text-slate-400'}`}>Movimientos</button>
            <button onClick={() => setActiveTab('clients')} className={`whitespace-nowrap flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'clients' ? 'bg-white text-purple-500 shadow-md' : 'text-slate-400'}`}>Clientes</button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full p-4 sm:p-6 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 sm:py-32">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-purple-50 border-t-purple-400 rounded-full animate-spin mb-6" />
            <p className="text-slate-300 text-[9px] sm:text-[11px] font-black uppercase tracking-widest italic">Sincronizando...</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-10">
            {aiInsight && (
              <div className="bg-white p-5 sm:p-7 rounded-[24px] sm:rounded-[32px] border border-purple-50 relative animate-in fade-in slide-in-from-top-4 shadow-sm">
                <button onClick={() => setAiInsight(null)} className="absolute top-4 right-4 text-slate-300 text-xs">✕</button>
                <h4 className="font-black text-purple-400 mb-2 sm:mb-3 text-[8px] sm:text-[9px] uppercase tracking-widest">🤖 BrisaBot</h4>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed italic">"{aiInsight}"</p>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in duration-700">
                <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-10">
                  <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-purple-50 shadow-sm flex flex-col justify-center min-h-[140px] sm:min-h-[160px]">
                    <p className="text-slate-400 text-[8px] sm:text-[9px] font-black uppercase mb-3 sm:mb-4">Balance Proyectado</p>
                    <h3 className={`text-2xl sm:text-4xl font-black ${summary.projectedBalance >= 0 ? 'text-slate-800' : 'text-rose-400'}`}>
                      ${Math.round(summary.projectedBalance).toLocaleString()}
                    </h3>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50/50 to-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-purple-100 flex flex-col justify-center min-h-[140px] sm:min-h-[160px]">
                    <p className="text-purple-400 text-[8px] sm:text-[9px] font-black uppercase mb-3 sm:mb-4">Ingresos Clientes</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-700 tracking-tighter">${Math.round(summary.projectedIncome).toLocaleString()}</h3>
                  </div>
                  <div className="bg-slate-50 p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border border-slate-100 flex flex-col justify-center min-h-[140px] sm:min-h-[160px] sm:col-span-2 md:col-span-1">
                    <p className="text-slate-400 text-[8px] sm:text-[9px] font-black uppercase mb-3 sm:mb-4">Gastos del Mes</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-600 tracking-tighter">-${Math.round(summary.totalExpenseArs).toLocaleString()}</h3>
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10">
                  <div className="lg:col-span-7 space-y-6 sm:space-y-10">
                    <div className="bg-white p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-slate-50 shadow-sm overflow-hidden">
                      <h4 className="font-black text-slate-400 text-[8px] sm:text-[9px] uppercase mb-6 sm:mb-10 tracking-widest">Gastos por Categoría</h4>
                      <div className="h-[250px] sm:h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 8, fontWeight: 800}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 8}} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontSize: '10px'}} formatter={(v: number) => `$${Math.round(v).toLocaleString()}`} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={30}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CATEGORIES.find(c => c.name === entry.name)?.color || '#f1f5f9'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bóveda Personal Responsiva */}
                    <div className="bg-gradient-to-br from-[#FFF9FD] to-[#F5F1FF] p-6 sm:p-10 rounded-[32px] sm:rounded-[56px] border border-white shadow-xl shadow-purple-100/40 relative overflow-hidden group">
                      <div className="absolute -bottom-10 -right-10 transition-transform duration-1000 group-hover:scale-105 pointer-events-none opacity-20 sm:opacity-40">
                        <PiggyBank size={window.innerWidth < 640 ? 200 : 320} />
                      </div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6 sm:mb-8">
                          <h4 className="font-black uppercase text-[8px] sm:text-[10px] text-purple-400 flex items-center gap-2 sm:gap-3 tracking-[0.2em] sm:tracking-[0.3em]">
                            <Sparkles className="w-4 h-4 sm:w-5 h-5" /> Mi Bóveda Personal
                          </h4>
                          <div className="w-8 sm:w-12 h-1 bg-gradient-to-r from-purple-200 to-rose-200 rounded-full" />
                        </div>

                        <div className="mb-8 sm:mb-12">
                          <p className="text-slate-400 text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] mb-1 sm:mb-2">Ahorro Disponible</p>
                          <h2 className="text-4xl sm:text-7xl font-black text-slate-800 tracking-tighter">
                            <span className="text-purple-300 text-xl sm:text-3xl align-top mr-1">$</span>
                            {vaultTotal.toLocaleString()}
                          </h2>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center bg-white/60 backdrop-blur-xl p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-white shadow-sm max-w-lg">
                          <div className="relative flex-1 w-full">
                            <span className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-purple-300 font-black text-sm sm:text-lg">$</span>
                            <input 
                              type="number" 
                              value={vaultInput}
                              onChange={(e) => setVaultInput(e.target.value)}
                              placeholder="Monto..." 
                              className="w-full pl-10 sm:pl-12 pr-4 sm:pr-6 py-4 rounded-xl sm:rounded-2xl bg-slate-50/50 border border-slate-100 outline-none text-slate-800 text-sm sm:text-base font-black placeholder:text-slate-300 focus:bg-white transition-all"
                            />
                          </div>
                          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                            <button 
                              onClick={() => handleVaultOperation('sum')}
                              className="flex-1 sm:flex-none bg-purple-400 text-white w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-3xl font-black shadow-lg shadow-purple-200 hover:bg-purple-500 active:scale-90 transition-all"
                            >
                              +
                            </button>
                            <button 
                              onClick={() => handleVaultOperation('sub')}
                              className="flex-1 sm:flex-none bg-white text-rose-400 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-3xl font-black border border-rose-100 shadow-sm hover:bg-rose-50 active:scale-90 transition-all"
                            >
                              -
                            </button>
                          </div>
                        </div>
                        <p className="mt-6 sm:mt-8 text-[7px] sm:text-[9px] font-black text-purple-300 uppercase tracking-widest italic text-center sm:text-left">✨ Tus ahorros están seguros</p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="bg-gradient-to-br from-white to-purple-50/20 p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-purple-100/40 h-full shadow-sm">
                      <h4 className="text-purple-400 font-black uppercase text-[8px] sm:text-[9px] mb-6 sm:mb-10 tracking-widest">Meta Brisa</h4>
                      <p className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tighter mb-6 sm:mb-8">${targetAmount.toLocaleString()}</p>
                      <div className="w-full bg-slate-100 rounded-full h-3 sm:h-4 mb-8 sm:mb-12 overflow-hidden">
                        <div className="bg-purple-400 h-full transition-all duration-1000" style={{ width: `${earningsProgress}%` }} />
                      </div>
                      <div className="space-y-3 sm:space-y-4 bg-white/70 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-purple-100/20 shadow-sm">
                        <div className="flex justify-between text-[10px] sm:text-xs font-bold"><span className="text-slate-400">Actual:</span><span>${Math.round(summary.projectedIncome).toLocaleString()}</span></div>
                        <div className="flex justify-between text-[10px] sm:text-xs font-bold"><span className="text-slate-400">Faltan:</span><span className="text-rose-400">${amountMissing.toLocaleString()}</span></div>
                        <div className="pt-3 sm:pt-4 border-t border-purple-100/40"><p className="text-purple-600 font-black text-xl sm:text-2xl tracking-tight text-center sm:text-left">{clientsNeeded} clientes más</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'clients' && (
              <div className="space-y-6 sm:space-y-10 animate-in slide-in-from-right-6 duration-600">
                <div className="bg-white p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-slate-50 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-8 sm:mb-10">
                    <h3 className="font-black text-slate-800 text-lg sm:text-xl tracking-tight">Mis Clientes</h3>
                    <div className="flex items-center gap-1 sm:gap-2 bg-slate-100/50 p-1 rounded-xl sm:rounded-2xl border border-slate-100 w-full sm:w-auto overflow-x-auto no-scrollbar">
                      <button onClick={() => setClientFilter('all')} className={`whitespace-nowrap flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all ${clientFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>Todos</button>
                      <button onClick={() => setClientFilter('paid')} className={`whitespace-nowrap flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all ${clientFilter === 'paid' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-400'}`}>Pagados</button>
                      <button onClick={() => setClientFilter('pending')} className={`whitespace-nowrap flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all ${clientFilter === 'pending' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>Pendientes</button>
                    </div>
                  </div>
                  
                  <form onSubmit={handleAddClient} className="bg-slate-50/70 p-5 sm:p-8 rounded-[24px] sm:rounded-[40px] border border-slate-100 flex flex-col lg:flex-row gap-4 sm:gap-6">
                    <input type="text" required value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nombre del Cliente" className="flex-1 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-white border-none shadow-sm text-sm font-bold focus:ring-2 focus:ring-purple-100 outline-none" />
                    <input type="number" required value={newClientFee} onChange={(e) => setNewClientFee(e.target.value)} placeholder="Cuota Mensual" className="lg:w-48 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-white border-none shadow-sm text-sm font-bold focus:ring-2 focus:ring-purple-100 outline-none" />
                    <button type="submit" className="bg-purple-400 text-white font-black px-6 sm:px-12 py-4 sm:py-5 rounded-xl sm:rounded-2xl hover:bg-purple-500 transition-all shadow-lg shadow-purple-100 text-[9px] sm:text-[10px] uppercase tracking-widest">Guardar</button>
                  </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                  {filteredClients.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 text-center py-16 sm:py-20 bg-slate-50 rounded-[32px] sm:rounded-[48px] border-2 border-dashed border-slate-200">
                      <p className="text-slate-300 font-bold text-xs sm:text-sm italic">No hay nada por aquí ✨</p>
                    </div>
                  ) : filteredClients.map(client => (
                    <div key={client.id} className={`bg-white p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-slate-50 shadow-sm transition-all group relative overflow-hidden ${!client.is_active && 'opacity-60 grayscale'}`}>
                      <div className="flex justify-between items-start mb-6 sm:mb-8">
                        <div>
                          <h4 className="font-black text-slate-800 text-lg sm:text-xl tracking-tight">{client.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-3">
                            <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black bg-purple-50 text-purple-500 border border-purple-100/50">
                              ARS$ {Number(client.monthly_fee).toLocaleString()}
                            </span>
                            {client.has_paid && (
                              <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[7px] sm:text-[8px] font-black bg-emerald-100 text-emerald-500 uppercase tracking-widest">Pagado</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 sm:gap-2">
                           <button onClick={() => toggleClientStatus(client)} className="p-2 sm:p-3 bg-slate-50 text-slate-400 rounded-lg sm:rounded-xl hover:bg-slate-100 transition-all text-xs sm:text-base">{client.is_active ? '⏸' : '▶'}</button>
                           <button onClick={() => handleDeleteClient(client.id)} className="p-2 sm:p-3 bg-slate-50 text-slate-300 rounded-lg sm:rounded-xl hover:bg-rose-50 hover:text-rose-400 transition-all sm:opacity-0 sm:group-hover:opacity-100 text-xs sm:text-base">🗑️</button>
                        </div>
                      </div>

                      <button 
                        onClick={() => togglePaidStatus(client)}
                        className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-[24px] flex items-center justify-center gap-2 sm:gap-3 font-black text-[9px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.2em] transition-all transform active:scale-[0.98] ${
                          client.has_paid 
                            ? 'bg-emerald-400 text-white shadow-lg shadow-emerald-200' 
                            : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-emerald-50 hover:text-emerald-500'
                        }`}
                      >
                        {client.has_paid ? (
                          <><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Cliente Pagó</>
                        ) : 'Marcar Pago'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6 sm:space-y-10 animate-in zoom-in-95 duration-500">
                <div className="bg-white p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] border border-slate-50 shadow-sm">
                  <h3 className="font-black text-slate-800 mb-6 sm:mb-8 text-lg sm:text-xl tracking-tight">Cargar Movimiento</h3>
                  <form onSubmit={handleAddTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className="md:col-span-2 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-purple-100 text-sm font-medium" placeholder="¿En qué se fue el dinero?" />
                    <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-purple-100 text-sm font-medium" placeholder="Monto total" />
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <select value={type} onChange={(e) => setType(e.target.value as any)} className="px-4 sm:px-5 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-slate-50 border-none outline-none text-[10px] sm:text-sm font-bold">
                        <option value="expense">📉 Gasto</option>
                        <option value="income">📈 Ingreso</option>
                      </select>
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-4 sm:px-5 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-slate-50 border-none outline-none text-[10px] sm:text-sm font-bold">
                        {CATEGORIES.map(c => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}
                      </select>
                    </div>
                    <button type="submit" className="md:col-span-2 bg-slate-800 text-white font-black py-5 sm:py-6 rounded-2xl sm:rounded-3xl hover:bg-slate-700 transition-all shadow-xl uppercase text-[9px] sm:text-[10px] tracking-widest mt-2 sm:mt-4">Registrar Movimiento</button>
                  </form>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {filteredTransactions.map(t => (
                    <TransactionCard key={t.id} transaction={t} onDelete={() => handleDeleteTransaction(t.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
