
import { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'food', name: 'Comida', icon: '🧁', color: '#F8E8EE' },
  { id: 'transport', name: 'Transporte', icon: '🌸', color: '#DCD6F7' },
  { id: 'housing', name: 'Vivienda', icon: '🏠', color: '#A6B1E1' },
  { id: 'leisure', name: 'Ocio', icon: '🎀', color: '#FBC7D4' },
  { id: 'salary', name: 'Salario', icon: '💖', color: '#E1AFD1' },
  { id: 'health', name: 'Salud', icon: '🌷', color: '#FFE6E6' },
  { id: 'education', name: 'Libros', icon: '📖', color: '#E5D1FA' },
  { id: 'others', name: 'Otros', icon: '✨', color: '#F9F7F7' }
];

export const INITIAL_TRANSACTIONS = [
  { id: '1', description: 'Sueldo Mensual', amount: 2500, date: '2023-10-01', category: 'salary', type: 'income' },
  { id: '2', description: 'Alquiler', amount: 800, date: '2023-10-02', category: 'housing', type: 'expense' },
  { id: '3', description: 'Supermercado', amount: 150, date: '2023-10-05', category: 'food', type: 'expense' },
];
