
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
  // Meta obligatoria de 3.000.000
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
    const initApp = async () => {
      setIsLoading(true);
      try {
        await Promise.allSettled([fetchData(true), fetchUsdRate()]);
      } catch (e) {
        console.error("Error al iniciar:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
    const savedVault = localStorage.getItem('geta_vault_total');
    if (savedVault) setVaultTotal(Number(savedVault));
  }, []);

  const fetchUsdRate = async () => {
    try {
      const response = await fetch('https://dolarapi.com/v1/dolares/blue');
      if (response.ok) {
        const data = await response.json();
        if (data?.venta) setUsdRate(data.venta);
      }
    } catch (error) {
      console.warn("Dolar API indisponible");
    }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('goals').select('*').maybeSingle(),
        supabase.from('clients').select('*').order('created_at', { ascending: true })
      ]);

      const transRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const goalRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const clientsRes = results[2].status === 'fulfilled' ? results[2].value : null;

      if (transRes?.data) setTransactions(transRes.data);
      // Solo sobreescribir si la meta de la DB es válida, sino mantener los 3M
      if (goalRes?.data && goalRes.data.target_amount >= 1000000) setGoal(goalRes.data);
      
      if (clientsRes?.data) {
        const key = getPaymentKey();
        const localPayments = JSON.parse(localStorage.getItem(key) || '{}');
        const mergedClients = clientsRes.data.map((c: any) => ({
          ...c,
          has_paid: !!localPayments[c.id]
        }));
        setClients(mergedClients);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const summary = useMemo(() => {
    const totals = (transactions || []).reduce((acc, curr) => {
      const tDate = new Date(curr.date);
      const now = new Date();
      if (tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) return acc;

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
      projectedBalance: projectedIncome - totals.totalExpenseArs
    };
  }, [transactions, clients, usdRate]);

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    const now = new Date();
    transactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getMonth() === now.getMonth() && t.type === TransactionType.EXPENSE) {
        const catName = CATEGORIES.find(c => c.id === t.category)?.name || 'Otros';
        const isUSD = t.description.toLowerCase().includes('(usd)');
        const valInArs = isUSD ? Number(t.amount) * usdRate : Number(t.amount);
        data[catName] = (data[catName] || 0) + valInArs;
      }
    });
    const results = Object.entries(data).map(([name, value]) => ({ name, value }));
    return results.length > 0 ? results : [{ name: 'Sin gastos', value: 0 }];
  }, [transactions, usdRate]);

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
    if (error) alert("Revisa la conexión");
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
    if (error) alert("Error al guardar cliente");
    else {
      setNewClientName(''); setNewClientFee('');
      fetchData(true);
    }
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
              <button onClick={() => analyzeFinances(transactions).then(setAiInsight)} className="bg-slate-800 text-white px-3 sm:px-4 py-2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest">✨ BrisaBot</button>
            </div>
          </div>
          <nav className="flex bg-slate-100/80 p-1 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 sm:flex-none px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-white text-purple-500 shadow-sm' : 'text-slate-400'}`}>Inicio</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 sm:flex-none px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-purple-500 shadow-sm' : 'text-slate-400'}`}>Movimientos</button>
            <button onClick={() => setActiveTab('clients')} className={`flex-1 sm:flex-none px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'clients' ? 'bg-white text-purple-500 shadow-sm' : 'text-slate-400'}`}>Clientes</button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full p-4 sm:p-6 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-400 rounded-full animate-spin mb-6" />
            <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">Cargando Bóveda...</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-10">
            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in duration-700">
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
                  <div className="bg-white p-6 rounded-[32px] border border-purple-50 shadow-sm">
                    <p className="text-slate-400 text-[8px] font-black uppercase mb-3">Balance Proyectado</p>
                    <h3 className="text-3xl font-black text-slate-800">${Math.round(summary.projectedBalance).toLocaleString()}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-purple-50 shadow-sm">
                    <p className="text-purple-400 text-[8px] font-black uppercase mb-3">Ingresos Clientes</p>
                    <h3 className="text-3xl font-black text-slate-800">${Math.round(summary.projectedIncome).toLocaleString()}</h3>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-sm">
                    <p className="text-slate-400 text-[8px] font-black uppercase mb-3">Gastos Mes</p>
                    <h3 className="text-3xl font-black text-slate-600">-${Math.round(summary.totalExpenseArs).toLocaleString()}</h3>
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  <div className="lg:col-span-7 space-y-10">
                    <div className="bg-gradient-to-br from-[#FFF9FD] to-[#F5F1FF] p-6 sm:p-10 rounded-[40px] border border-white shadow-xl shadow-purple-100/40 relative overflow-hidden group">
                      <div className="absolute -bottom-10 -right-10 opacity-30 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                        <PiggyBank size={300} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="font-black uppercase text-[10px] text-purple-400 flex items-center gap-2 tracking-[0.2em] mb-8">
                          <Sparkles className="w-4 h-4" /> Mi Bóveda Personal
                        </h4>
                        <div className="mb-10">
                          <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-1">Ahorro Disponible</p>
                          <h2 className="text-5xl sm:text-7xl font-black text-slate-800 tracking-tighter">
                            <span className="text-purple-300 text-xl sm:text-2xl align-top mr-1">$</span>
                            {vaultTotal.toLocaleString()}
                          </h2>
                        </div>
                        <div className="flex gap-3 items-center bg-white/60 backdrop-blur-md p-4 rounded-[28px] border border-white shadow-sm max-w-sm">
                          <input type="number" value={vaultInput} onChange={e => setVaultInput(e.target.value)} placeholder="0.00" className="flex-1 bg-transparent outline-none font-black text-slate-800 text-lg px-2" />
                          <button onClick={() => handleVaultOperation('sum')} className="w-12 h-12 bg-purple-400 text-white rounded-2xl font-black text-xl shadow-lg">+</button>
                          <button onClick={() => handleVaultOperation('sub')} className="w-12 h-12 bg-white text-rose-400 rounded-2xl font-black text-xl border border-rose-50 shadow-sm">-</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="bg-white p-8 rounded-[40px] border border-purple-50 h-full shadow-sm">
                      <h4 className="text-purple-400 font-black uppercase text-[9px] mb-8 tracking-widest">Meta Brisa</h4>
                      <p className="text-4xl font-black text-slate-800 tracking-tighter mb-6">${targetAmount.toLocaleString()}</p>
                      <div className="w-full bg-slate-100 rounded-full h-3 mb-10 overflow-hidden">
                        <div className="bg-purple-400 h-full transition-all duration-1000" style={{ width: `${earningsProgress}%` }} />
                      </div>
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 mb-1">Faltan:</p>
                        <p className="text-rose-400 font-black text-2xl tracking-tight">${amountMissing.toLocaleString()}</p>
                        <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest mt-4">Aproximadamente {clientsNeeded} clientes más</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'clients' && (
              <div className="animate-in slide-in-from-right-4 duration-500">
                <div className="bg-white p-6 sm:p-10 rounded-[40px] border border-slate-50 shadow-sm mb-10">
                  <h3 className="font-black text-slate-800 text-xl mb-8">Gestión de Clientes</h3>
                  <form onSubmit={handleAddClient} className="flex flex-col sm:flex-row gap-4">
                    <input type="text" required value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre del Cliente" className="flex-1 bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm" />
                    <input type="number" required value={newClientFee} onChange={e => setNewClientFee(e.target.value)} placeholder="Cuota Mensual" className="sm:w-48 bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm" />
                    <button type="submit" className="bg-purple-400 text-white font-black px-10 py-4 rounded-2xl uppercase text-[10px] tracking-widest">Añadir</button>
                  </form>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {clients.map(client => (
                    <div key={client.id} className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm relative group">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="font-black text-slate-800 text-lg">{client.name}</h4>
                          <p className="text-purple-400 font-black text-sm mt-1">ARS$ {Number(client.monthly_fee).toLocaleString()}</p>
                        </div>
                        <button onClick={() => supabase.from('clients').delete().eq('id', client.id).then(() => fetchData(true))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-all">🗑️</button>
                      </div>
                      <button className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-500 transition-all">Marcar Pago del Mes</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="animate-in zoom-in-95 duration-500 space-y-6">
                <div className="bg-white p-6 sm:p-10 rounded-[40px] border border-slate-50 shadow-sm">
                  <h3 className="font-black text-slate-800 text-xl mb-8">Registrar Movimiento</h3>
                  <form onSubmit={handleAddTransaction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" required value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción" className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm" />
                    <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto" className="bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm" />
                    <select value={type} onChange={e => setType(e.target.value as any)} className="bg-slate-50 p-4 rounded-2xl font-bold text-sm">
                      <option value="expense">📉 Gasto</option>
                      <option value="income">📈 Ingreso</option>
                    </select>
                    <button type="submit" className="sm:col-span-2 bg-slate-800 text-white font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest">Guardar Movimiento</button>
                  </form>
                </div>
                <div className="space-y-4">
                  {transactions.slice(0, 15).map(t => (
                    <TransactionCard key={t.id} transaction={t} onDelete={() => supabase.from('transactions').delete().eq('id', t.id).then(() => fetchData(true))} />
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
