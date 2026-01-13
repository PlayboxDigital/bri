
import React from 'react';
import { Transaction, TransactionType } from '../types';
import { CATEGORIES } from '../constants';

interface Props {
  transaction: Transaction;
  onDelete: (id: string) => void;
}

const TransactionCard: React.FC<Props> = ({ transaction, onDelete }) => {
  const category = CATEGORIES.find(c => c.id === transaction.category) || CATEGORIES[7];
  const isExpense = transaction.type === TransactionType.EXPENSE;

  return (
    <div className="bg-white p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm border border-slate-50 flex items-center justify-between hover:shadow-md transition-shadow group">
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <div 
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex-shrink-0 flex items-center justify-center text-lg shadow-inner"
          style={{ backgroundColor: `${category.color}40` }}
        >
          {category.icon}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-700 text-xs sm:text-sm truncate">{transaction.description}</h4>
          <p className="text-[7px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 sm:mt-1 truncate">{category.name} • {transaction.date}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-5 flex-shrink-0">
        <span className={`font-semibold text-sm sm:text-base tracking-tight whitespace-nowrap ${isExpense ? 'text-rose-400' : 'text-purple-400'}`}>
          {isExpense ? '-' : '+'}${transaction.amount.toLocaleString()}
        </span>
        <button 
          onClick={() => onDelete(transaction.id)}
          className="p-2 text-slate-200 hover:text-rose-400 transition-all sm:opacity-0 sm:group-hover:opacity-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  );
};

export default TransactionCard;
