
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  type: TransactionType;
  client_id?: string;
}

export interface Client {
  id: string;
  name: string;
  monthly_fee: number;
  currency: 'ARS' | 'USD';
  is_active: boolean;
  has_paid: boolean;
  notes?: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}
