-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallets table for multisig wallet configurations
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  m INTEGER NOT NULL,
  n INTEGER NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  script_hex TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_keys table for storing public keys associated with wallets
CREATE TABLE public.wallet_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL,
  key_index INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  owner_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table for multisig transaction details
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL,
  to_address TEXT NOT NULL,
  amount_satoshis BIGINT NOT NULL,
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

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Wallets RLS policies
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

-- Wallet keys RLS policies
CREATE POLICY "Users can view keys for their wallets" 
ON public.wallet_keys 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = wallet_keys.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can add keys to their wallets" 
ON public.wallet_keys 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = wallet_keys.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can update keys in their wallets" 
ON public.wallet_keys 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = wallet_keys.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can delete keys from their wallets" 
ON public.wallet_keys 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = wallet_keys.wallet_id 
  AND wallets.user_id = auth.uid()
));

-- Transactions RLS policies
CREATE POLICY "Users can view transactions for their wallets" 
ON public.transactions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = transactions.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can create transactions for their wallets" 
ON public.transactions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = transactions.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can update transactions for their wallets" 
ON public.transactions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = transactions.wallet_id 
  AND wallets.user_id = auth.uid()
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

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

-- Create trigger for automatic profile creation on user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();