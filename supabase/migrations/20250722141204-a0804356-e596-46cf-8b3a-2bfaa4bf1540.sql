-- Add encrypted private keys storage to wallet_keys table
ALTER TABLE wallet_keys ADD COLUMN encrypted_private_key TEXT;

-- Create table for storing key derivation parameters
CREATE TABLE key_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for key_backups
ALTER TABLE key_backups ENABLE ROW LEVEL SECURITY;

-- Create policies for key_backups
CREATE POLICY "Users can create backups for their wallets" 
ON key_backups 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = key_backups.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can view backups for their wallets" 
ON key_backups 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = key_backups.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can update backups for their wallets" 
ON key_backups 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = key_backups.wallet_id 
  AND wallets.user_id = auth.uid()
));

CREATE POLICY "Users can delete backups for their wallets" 
ON key_backups 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM wallets 
  WHERE wallets.id = key_backups.wallet_id 
  AND wallets.user_id = auth.uid()
));

-- Add trigger for updating timestamps
CREATE TRIGGER update_key_backups_updated_at
BEFORE UPDATE ON key_backups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();