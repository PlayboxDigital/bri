
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, FinanceSummary, Client } from './types';
import { CATEGORIES } from './constants';
import { analyzeFinances } from './services/geminiService';
import { HappyWallet, PiggyBank } from './components/Illustration';
import TransactionCard from './components/TransactionCard';
import { supabase } from './supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  // Aseguramos que el default sea 2.000.000
  const [goal, setGoal] = useState({ target_amount: 2000000, title: 'Ganancia Mensual' });
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [usdRate, setUsdRate] = useState<number>(1200); 
  
  const [vaultTotal, setVaultTotal] = useState<number>(1500000);
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState('others');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'clients'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  const [newClientName, setNewClientName] = useState('');
  const [newClientFee, setNewClientFee] = useState('');
  const [newClientCurrency, setNewClientCurrency] = useState<'ARS' | 'USD'>('ARS');

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
      if (data && data.venta) {
        setUsdRate(data.venta);
      }
    } catch (error) {
      console.error("Error al obtener cotización del dólar:", error);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: transData, error: tError } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      const { data: goalData } = await supabase.from('goals').select('*').maybeSingle();
      const { data: clientsData, error: cError } = await supabase.from('clients').select('*').order('name', { ascending: true });

      if (tError) console.error("Error transacciones:", tError.message);
      if (cError) console.error("Error clientes:", cError.message);

      if (transData) setTransactions(transData);
      
      // Si el dato en DB es incoherente (como 1500), priorizamos el default del usuario si es necesario, 
      // pero aquí respetamos la DB si existe, asumiendo que el usuario la actualizará.
      if (goalData && goalData.target_amount > 10000) {
        setGoal(goalData);
      } else {
        setGoal({ target_amount: 2000000, title: 'Ganancia Mensual' });
      }

      if (clientsData) setClients(clientsData);
    } catch (err) {
      console.error("Error fatal en carga:", err);
    } finally {
      setIsLoading(false);
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

  const summary = useMemo(() => {
    const totals = filteredTransactions.reduce((acc, curr) => {
      let val = Number(curr.amount);
      const isUSD = curr.description.toLowerCase().includes('(usd)') || curr.description.toLowerCase().includes('u$d');
      const valInArs = isUSD ? val * usdRate : val;

      if (curr.type === TransactionType.INCOME) {
        acc.totalIncomeArs += valInArs;
      } else {
        acc.totalExpenseArs += valInArs;
      }
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
        const isUSD = t.description.toLowerCase().includes('(usd)') || t.description.toLowerCase().includes('u$d');
        const valInArs = isUSD ? Number(t.amount) * usdRate : Number(t.amount);
        data[catName] = (data[catName] || 0) + valInArs;
      }
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions, usdRate]);

  const targetAmount = goal?.target_amount || 2000000;
  
  const earningsProgress = useMemo(() => {
    const percentage = Math.min(Math.max((summary.projectedIncome / targetAmount) * 100, 0), 100);
    return Math.round(percentage);
  }, [summary.projectedIncome, targetAmount]);

  const amountMissing = useMemo(() => {
    return Math.max(targetAmount - summary.projectedIncome, 0);
  }, [summary.projectedIncome, targetAmount]);

  const clientsNeededEstimate = useMemo(() => {
    if (amountMissing <= 0) return 0;
    const avgFeePerNewClient = 300000; // Valor solicitado por el usuario
    return Math.ceil(amountMissing / avgFeePerNewClient);
  }, [amountMissing]);

  const handleAddTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!description || !amount) return;
    const newRow = { 
      description, 
      amount: parseFloat(amount), 
      date: new Date().toISOString().split('T')[0], 
      type, 
      category 
    };
    const { data, error } = await supabase.from('transactions').insert([newRow]).select();
    if (error) {
      alert("Error al guardar: " + error.message);
    } else if (data) {
      setTransactions(prev => [data[0], ...prev]);
      setDescription(''); setAmount('');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      alert("Error al eliminar: " + error.message);
    } else {
      fetchData();
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientFee) {
      alert("⚠️ Por favor completa el nombre y el monto.");
      return;
    }
    try {
      const payload = {
        name: newClientName,
        monthly_fee: parseFloat(newClientFee),
        currency: newClientCurrency,
        is_active: true
      };
      const { data, error } = await supabase.from('clients').insert([payload]).select();
      if (error) alert(error.message);
      else if (data) {
        setClients(prev => [...prev, data[0]]);
        setNewClientName(''); setNewClientFee('');
        alert("✅ Cliente guardado!");
      }
    } catch (err: any) { alert(err.message); }
  };

  const toggleClientStatus = async (client: Client) => {
    const { data, error } = await supabase.from('clients')
      .update({ is_active: !client.is_active })
      .eq('id', client.id)
      .select();
    if (error) alert(error.message);
    else if (data) setClients(prev => prev.map(c => c.id === client.id ? data[0] : c));
  };

  const registerClientPayment = async (client: Client) => {
    const newRow = { 
      description: `Pago ${client.name} (${client.currency})`, 
      amount: client.monthly_fee, 
      date: new Date().toISOString().split('T')[0], 
      type: TransactionType.INCOME, 
      category: 'salary',
      client_id: client.id 
    };
    const { data, error } = await supabase.from('transactions').insert([newRow]).select();
    if (error) alert(error.message);
    else if (data) {
      setTransactions(prev => [data[0], ...prev]);
      alert(`💰 ¡Cobro de ${client.name} registrado!`);
    }
  };

  const handleAddVaultAmount = () => {
    const input = prompt("Ingresa el monto ahorrado este mes para sumar a la bóveda (ARS):");
    if (input && !isNaN(Number(input))) {
      const newTotal = vaultTotal + Number(input);
      setVaultTotal(newTotal);
      localStorage.setItem('geta_vault_total', newTotal.toString());
      alert("💰 ¡Bóveda actualizada con éxito!");
    }
  };

  const updateGoal = async () => {
    const newAmount = prompt("Ingresa tu nueva Meta de Ganancia Mensual (ARS):", goal?.target_amount?.toString() || "2000000");
    if (newAmount && !isNaN(Number(newAmount))) {
      const amount = parseFloat(newAmount);
      let error;
      let data;
      const { data: existingGoal } = await supabase.from('goals').select('*').maybeSingle();

      if (existingGoal?.id) {
        const res = await supabase.from('goals').update({ target_amount: amount }).eq('id', existingGoal.id).select();
        error = res.error;
        data = res.data;
      } else {
        const res = await supabase.from('goals').insert([{ target_amount: amount, title: 'Ganancia Mensual' }]).select();
        error = res.error;
        data = res.data;
      }

      if (error) alert("Error al actualizar meta: " + error.message);
      else if (data) {
        setGoal(data[0]);
        alert("✅ Meta de ganancia actualizada!");
      }
    }
  };

  const getAiAdvice = async () => {
    setIsAnalyzing(true);
    const advice = await analyzeFinances(filteredTransactions);
    setAiInsight(advice);
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen pb-24 md:pb-8 flex flex-col bg-[#FCFBFE]">
      <header className="bg-white/80 backdrop-blur-md border-b border-purple-50 px-6 py-5 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-300 via-rose-300 to-fuchsia-200 w-11 h-11 rounded-2xl flex items-center justify-center shadow-md shadow-purple-100/50">
              <span className="text-white font-bold text-xl">B</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-700 tracking-tight">Finanzas <span className="text-purple-400 font-medium italic">Brisa</span></h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end">
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dólar Blue</span>
               <span className="text-sm font-semibold text-purple-400">${usdRate}</span>
             </div>
             <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value as any)}
                className="bg-slate-50 text-slate-500 text-[10px] font-bold px-3 py-2 rounded-xl border-none focus:ring-1 focus:ring-purple-100 cursor-pointer uppercase tracking-wider"
              >
                <option value="month">Mensual</option>
                <option value="year">Anual</option>
              </select>
            <button 
              onClick={getAiAdvice}
              disabled={isAnalyzing}
              className="bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-semibold hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            >
              {isAnalyzing ? "..." : '✨ BrisaBot'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full p-4 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-purple-50 border-t-purple-300 rounded-full animate-spin mb-4" />
            <p className="text-slate-400 text-sm font-medium animate-pulse">Organizando tus finanzas...</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
              <div className="bg-white p-8 rounded-[40px] border border-purple-50/50 shadow-sm col-span-1 md:col-span-2 flex flex-col justify-center">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Balance Proyectado del Mes</p>
                <h3 className={`text-5xl font-semibold tracking-tighter ${summary.projectedBalance >= 0 ? 'text-slate-700' : 'text-rose-400'}`}>
                  ${Math.round(summary.projectedBalance).toLocaleString()}
                </h3>
                <div className="flex items-center gap-2 mt-5 text-[10px] font-bold text-slate-400">
                  <span className="bg-slate-50 px-3 py-1.5 rounded-lg">Potencial de Clientes</span>
                  <span className="text-slate-200">/</span>
                  <span className="bg-rose-50 text-rose-400 px-3 py-1.5 rounded-lg">Gastos Actuales</span>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50/40 to-white p-7 rounded-[40px] border border-purple-100/30 flex flex-col justify-center">
                <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-1">Ganancia Proyectada</p>
                <h3 className="text-3xl font-semibold text-slate-700 tracking-tighter">${Math.round(summary.projectedIncome).toLocaleString()}</h3>
                <p className="text-[10px] text-slate-400 mt-3 font-medium leading-relaxed">Suma de cuotas de clientes activos.</p>
              </div>

              <div className="bg-slate-50 p-7 rounded-[40px] flex flex-col justify-center border border-slate-100">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Gastos Registrados</p>
                <h3 className="text-3xl font-semibold text-slate-600 tracking-tighter">-${Math.round(summary.totalExpenseArs).toLocaleString()}</h3>
                <p className="text-[10px] text-slate-400/70 mt-3 font-medium leading-relaxed">Egresos confirmados este periodo.</p>
              </div>
            </section>

            {activeTab === 'dashboard' && (
              <div className="mb-12 relative">
                <div className="absolute -top-6 -left-6 w-12 h-12 bg-purple-100/30 rounded-full blur-xl animate-pulse" />
                <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-rose-100/30 rounded-full blur-2xl animate-pulse delay-700" />
                
                <div className="bg-gradient-to-br from-[#FFF9FD] via-[#FDF6FF] to-[#F5F1FF] p-12 rounded-[56px] border border-white shadow-2xl shadow-purple-200/40 relative overflow-hidden group ring-1 ring-purple-50">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #A78BFA 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                  
                  <div className="absolute top-1/2 -translate-y-1/2 -right-12 opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all duration-700 ease-out">
                    <div className="relative">
                      <PiggyBank size={340} />
                      <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full" />
                    </div>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-[2px] bg-purple-200 rounded-full" />
                      <h4 className="font-bold uppercase tracking-[0.3em] text-[10px] text-purple-400">Mi Bóveda Personal</h4>
                    </div>
                    
                    <p className="text-sm text-slate-400 mb-8 max-w-sm font-medium leading-relaxed">
                      Tu patrimonio total acumulado (Ahorro Real). No afecta tu meta mensual. ✨
                    </p>
                    
                    <div className="mb-10">
                      <div className="flex items-baseline gap-4">
                        <span className="text-2xl font-light text-purple-200">$</span>
                        <h2 className="text-7xl font-semibold text-slate-700 tracking-tighter drop-shadow-sm">
                          {vaultTotal.toLocaleString()}
                        </h2>
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">ARS</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleAddVaultAmount}
                      className="group/btn relative overflow-hidden bg-white text-purple-500 px-12 py-5 rounded-[24px] font-bold text-xs uppercase tracking-[0.2em] hover:text-white transition-all shadow-xl shadow-purple-100/60 active:scale-95 flex items-center gap-4 border border-purple-50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-rose-300 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      <span className="relative text-xl group-hover/btn:scale-125 transition-transform duration-300">🐷</span>
                      <span className="relative">Cargar ahorro del mes</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex bg-slate-100/50 p-1.5 rounded-2xl mb-10 w-fit">
              <button onClick={() => setActiveTab('dashboard')} className={`px-10 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-white text-purple-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Dashboard</button>
              <button onClick={() => setActiveTab('history')} className={`px-10 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-purple-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Gastos</button>
              <button onClick={() => setActiveTab('clients')} className={`px-10 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'clients' ? 'bg-white text-purple-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Clientes</button>
            </div>

            {activeTab === 'clients' ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm">
                  <h3 className="font-semibold text-slate-700 mb-8 text-lg">Administrar Clientes</h3>
                  <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50/30 p-6 rounded-[32px] border border-slate-50">
                    <div className="md:col-span-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Nombre Cliente</label>
                      <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full mt-1.5 px-4 py-3.5 rounded-2xl border-none bg-white shadow-sm outline-none focus:ring-2 focus:ring-purple-100 transition-all text-sm" placeholder="Ej: Refrigeración" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Cuota Mensual</label>
                      <input type="number" value={newClientFee} onChange={(e) => setNewClientFee(e.target.value)} className="w-full mt-1.5 px-4 py-3.5 rounded-2xl border-none bg-white shadow-sm outline-none focus:ring-2 focus:ring-purple-100 transition-all text-sm" placeholder="Monto" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Moneda</label>
                      <div className="flex bg-slate-200/50 p-1 rounded-2xl mt-1.5">
                        <button type="button" onClick={() => setNewClientCurrency('ARS')} className={`flex-1 py-2.5 text-[10px] font-bold rounded-xl transition-all ${newClientCurrency === 'ARS' ? 'bg-white text-purple-500 shadow-sm' : 'text-slate-400'}`}>ARS</button>
                        <button type="button" onClick={() => setNewClientCurrency('USD')} className={`flex-1 py-2.5 text-[10px] font-bold rounded-xl transition-all ${newClientCurrency === 'USD' ? 'bg-white text-purple-500 shadow-sm' : 'text-slate-400'}`}>USD</button>
                      </div>
                    </div>
                    <button type="submit" className="bg-purple-400 text-white font-bold py-4 rounded-2xl hover:bg-purple-500 transition-all active:scale-95 shadow-md shadow-purple-100/50 text-[10px] uppercase tracking-widest">Agregar</button>
                  </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {clients.map(client => (
                    <div key={client.id} className={`bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm transition-all ${!client.is_active ? 'opacity-50 grayscale' : 'hover:border-purple-100'}`}>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="font-semibold text-slate-700 text-lg">{client.name}</h4>
                          <span className={`inline-block mt-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest ${client.currency === 'USD' ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-500'}`}>
                            {client.currency === 'USD' ? 'U$D' : 'ARS$'} {Number(client.monthly_fee).toLocaleString()}
                          </span>
                        </div>
                        <button onClick={() => toggleClientStatus(client)} className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-colors ${client.is_active ? 'bg-purple-50 text-purple-500' : 'bg-slate-100 text-slate-400'}`}>
                          {client.is_active ? 'Activa' : 'Pausada'}
                        </button>
                      </div>
                      <button onClick={() => registerClientPayment(client)} disabled={!client.is_active} className="w-full bg-slate-50 text-slate-600 text-[10px] font-bold py-4 rounded-2xl hover:bg-purple-400 hover:text-white disabled:bg-slate-50 disabled:text-slate-200 transition-all uppercase tracking-widest border border-slate-100">Registrar Cobro</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'history' ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <form onSubmit={handleAddTransaction} className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
                   <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className="px-5 py-4.5 rounded-2xl border-none bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-purple-50 transition-all text-sm" placeholder="¿Qué compraste?" />
                   <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="px-5 py-4.5 rounded-2xl border-none bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-purple-50 transition-all text-sm" placeholder="Monto total" />
                   <select value={type} onChange={(e) => setType(e.target.value as any)} className="px-5 py-4.5 rounded-2xl border-none bg-slate-50 outline-none text-sm cursor-pointer">
                     <option value="expense">📉 Gasto</option>
                     <option value="income">📈 Ingreso Extra</option>
                   </select>
                   <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-5 py-4.5 rounded-2xl border-none bg-slate-50 outline-none text-sm cursor-pointer">
                     {CATEGORIES.map(c => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}
                   </select>
                   <button type="submit" className="md:col-span-2 bg-slate-800 text-white font-bold py-5 rounded-3xl hover:bg-slate-700 transition-all shadow-md uppercase text-[10px] tracking-[0.25em]">Cargar Movimiento</button>
                </form>

                <div className="space-y-4">
                  {filteredTransactions.map(t => (
                    <TransactionCard key={t.id} transaction={t} onDelete={() => handleDeleteTransaction(t.id)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
                <div className="lg:col-span-8 space-y-10">
                  <div className="bg-white p-10 rounded-[48px] border border-slate-50 shadow-sm h-[440px]">
                    <h4 className="font-semibold text-slate-500 mb-8 text-[11px] uppercase tracking-[0.2em]">Distribución de Gastos</h4>
                    <ResponsiveContainer width="100%" height="80%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.04)'}} 
                          formatter={(value: number) => `$${Math.round(value).toLocaleString()}`} 
                        />
                        <Bar dataKey="value" radius={[14, 14, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORIES.find(c => c.name === entry.name)?.color || '#A78BFA'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* TARJETA DE META DE GANANCIA SOLICITADA */}
                <div className="lg:col-span-4 space-y-8">
                  <div className="bg-gradient-to-br from-white to-purple-50/20 p-10 rounded-[48px] border border-purple-100/40 relative group shadow-sm">
                    <button onClick={updateGoal} className="absolute top-8 right-8 p-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-purple-50">✏️</button>
                    
                    <h4 className="text-purple-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-3">Meta Ganancia Mensual</h4>
                    
                    <div className="space-y-1 mb-6">
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Objetivo de Cobros</p>
                      <p className="text-2xl font-bold text-slate-700">${targetAmount.toLocaleString()}</p>
                    </div>

                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Progreso</span>
                      <span className="text-lg font-black text-purple-500">{earningsProgress}%</span>
                    </div>

                    <div className="w-full bg-slate-100/50 rounded-full h-4 mb-6 overflow-hidden p-1 shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-purple-300 via-purple-400 to-rose-300 h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(167,139,250,0.4)]" 
                        style={{ width: `${earningsProgress}%` }}
                      ></div>
                    </div>

                    <div className="space-y-4 bg-purple-50/30 p-5 rounded-[32px] border border-purple-100/20">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">ganancia actual</span>
                        <span className="font-bold text-slate-700">${Math.round(summary.projectedIncome).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Me faltan:</span>
                        <span className="font-bold text-rose-400">${amountMissing.toLocaleString()}</span>
                      </div>
                      
                      <div className="pt-3 border-t border-purple-100/30">
                        <div className="flex flex-col gap-1">
                          <span className="text-purple-400 font-bold uppercase text-[9px]">Necesito aprox:</span>
                          <p className="text-[10px] text-slate-400 leading-relaxed italic">
                            (entendiendo que cada cliente me paga aprox 300.000 por mes)
                          </p>
                          <p className="font-black text-purple-600 text-base mt-1">
                            {clientsNeededEstimate} clientes más
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800 p-10 rounded-[48px] text-white shadow-xl shadow-slate-200/50">
                    <h4 className="font-bold uppercase tracking-[0.25em] text-[10px] text-slate-500 mb-10">Estado de Cobros</h4>
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">Clientes Activos</span>
                        <span className="font-semibold text-purple-300 text-2xl">{clients.filter(c => c.is_active).length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">Cobrado Real</span>
                        <span className="font-semibold text-white text-2xl">${Math.round(summary.totalIncomeArs).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-12 pt-10 border-t border-slate-700/50 flex justify-center grayscale opacity-50">
                      <HappyWallet size={90} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
