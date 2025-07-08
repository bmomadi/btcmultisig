
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallets table for multisig configurations
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  m INTEGER NOT NULL CHECK (m > 0 AND m <= 15),
  n INTEGER NOT NULL CHECK (n > 0 AND n <= 15 AND n >= m),
  address TEXT,
  script_hex TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_keys table for storing public keys
CREATE TABLE public.wallet_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  key_index INTEGER NOT NULL,
  owner_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wallet_id, key_index),
  UNIQUE(wallet_id, public_key)
);

-- Create transactions table for tracking multisig transactions
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  to_address TEXT NOT NULL,
  amount_satoshis BIGINT NOT NULL CHECK (amount_satoshis > 0),
  fee_satoshis BIGINT NOT NULL DEFAULT 0,
  raw_transaction TEXT,
  transaction_hash TEXT,
  signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_signatures INTEGER NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  is_broadcast BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for wallets
CREATE POLICY "Users can view their own wallets" 
ON public.wallets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wallets" 
ON public.wallets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallets" 
ON public.wallets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallets" 
ON public.wallets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for wallet_keys
CREATE POLICY "Users can view keys for their wallets" 
ON public.wallet_keys 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.wallets 
  WHERE wallets.id = wallet_keys.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can add keys to their wallets" 
ON public.wallet_keys 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.wallets 
  WHERE wallets.id = wallet_keys.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can update keys in their wallets" 
ON public.wallet_keys 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.wallets 
  WHERE wallets.id = wallet_keys.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can delete keys from their wallets" 
ON public.wallet_keys 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.wallets 
  WHERE wallets.id = wallet_keys.wallet_id 
  AND wallets.user_id = auth.uid()
));

-- Create RLS policies for transactions
CREATE POLICY "Users can view transactions for their wallets" 
ON public.transactions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.wallets 
  WHERE wallets.id = transactions.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can create transactions for their wallets" 
ON public.transactions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.wallets 
  WHERE wallets.id = transactions.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can update transactions for their wallets" 
ON public.transactions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.wallets 
  WHERE wallets.id = transactions.wallet_id 
  AND wallets.user_id = auth.uid()
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
