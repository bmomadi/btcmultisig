import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Wallet = Tables<'wallets'>;
export type WalletKey = Tables<'wallet_keys'>;
export type Transaction = Tables<'transactions'>;

export const walletService = {
  // Wallet operations
  async createWallet(wallet: Omit<TablesInsert<'wallets'>, 'user_id'>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('wallets')
      .insert({ ...wallet, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getUserWallets() {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async updateWallet(id: string, updates: TablesUpdate<'wallets'>) {
    const { data, error } = await supabase
      .from('wallets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Wallet keys operations
  async addWalletKey(walletKey: Omit<TablesInsert<'wallet_keys'>, 'id'>) {
    const { data, error } = await supabase
      .from('wallet_keys')
      .insert(walletKey)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getWalletKeys(walletId: string) {
    const { data, error } = await supabase
      .from('wallet_keys')
      .select('*')
      .eq('wallet_id', walletId)
      .order('key_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Transaction operations
  async createTransaction(transaction: Omit<TablesInsert<'transactions'>, 'id'>) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getWalletTransactions(walletId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async updateTransaction(id: string, updates: TablesUpdate<'transactions'>) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addTransactionSignature(transactionId: string, signature: string) {
    // Get current transaction
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('signatures, required_signatures')
      .eq('id', transactionId)
      .single();

    if (fetchError) throw fetchError;

    const currentSignatures = transaction.signatures as string[] || [];
    const newSignatures = [...currentSignatures, signature];
    const isComplete = newSignatures.length >= transaction.required_signatures;

    const { data, error } = await supabase
      .from('transactions')
      .update({
        signatures: newSignatures,
        is_complete: isComplete
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};