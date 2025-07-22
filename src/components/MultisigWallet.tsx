import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Shield, Key, Send, Users, Bitcoin, ArrowRight, CheckCircle, LogOut, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { walletService, type Wallet, type WalletKey, type Transaction } from "@/services/walletService";
import { bitcoinService } from "@/services/bitcoinService";
import { PrivateKeyBackup } from "./PrivateKeyBackup";

interface MultisigConfig {
  m: number;
  n: number;
  publicKeys: string[];
  address?: string;
  name: string;
}

export const MultisigWallet = () => {
  const [config, setConfig] = useState<MultisigConfig>({ m: 2, n: 3, publicKeys: [], name: 'My Wallet' });
  const [newPubKey, setNewPubKey] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [walletKeys, setWalletKeys] = useState<WalletKey[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { signOut, user } = useAuth();

  // Load user wallets on component mount
  useEffect(() => {
    loadWallets();
  }, []);

  // Load wallet keys and transactions when a wallet is selected
  useEffect(() => {
    if (selectedWallet) {
      loadWalletKeys(selectedWallet.id);
      loadTransactions(selectedWallet.id);
    }
  }, [selectedWallet]);

  const loadWallets = async () => {
    try {
      const userWallets = await walletService.getUserWallets();
      setWallets(userWallets);
      if (userWallets.length > 0 && !selectedWallet) {
        setSelectedWallet(userWallets[0]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load wallets",
        variant: "destructive"
      });
    }
  };

  const loadWalletKeys = async (walletId: string) => {
    try {
      const keys = await walletService.getWalletKeys(walletId);
      setWalletKeys(keys);
      
      // Update config with loaded keys
      setConfig(prev => ({
        ...prev,
        publicKeys: keys.map(k => k.public_key),
        m: selectedWallet?.m || prev.m,
        n: selectedWallet?.n || prev.n,
        address: selectedWallet?.address || undefined
      }));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load wallet keys",
        variant: "destructive"
      });
    }
  };

  const loadTransactions = async (walletId: string) => {
    try {
      const walletTransactions = await walletService.getWalletTransactions(walletId);
      setTransactions(walletTransactions);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive"
      });
    }
  };

  const generateRandomKey = () => {
    const keyPair = bitcoinService.generateKeyPair();
    setNewPubKey(keyPair.publicKey);
  };

  const addPublicKey = async () => {
    if (!newPubKey.trim()) return;
    
    // Validate the public key
    const validation = bitcoinService.validatePublicKey(newPubKey.trim());
    if (!validation.valid) {
      toast({
        title: "Invalid Public Key",
        description: "Please enter a valid Bitcoin public key in hex format",
        variant: "destructive"
      });
      return;
    }

    if (!selectedWallet) {
      toast({
        title: "No Wallet Selected",
        description: "Please create a wallet first",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      await walletService.addWalletKey({
        wallet_id: selectedWallet.id,
        public_key: newPubKey.trim(),
        key_index: walletKeys.length,
        owner_name: `Key ${walletKeys.length + 1}`
      });
      
      setNewPubKey('');
      await loadWalletKeys(selectedWallet.id);
      
      toast({
        title: "Public Key Added",
        description: "Successfully added to wallet"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add public key",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    if (!config.name.trim()) {
      toast({
        title: "Wallet Name Required",
        description: "Please enter a name for your wallet",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const wallet = await walletService.createWallet({
        name: config.name,
        m: config.m,
        n: config.n,
        is_complete: false
      });
      
      await loadWallets();
      setSelectedWallet(wallet);
      
      toast({
        title: "Wallet Created",
        description: `${config.m}-of-${config.n} wallet created successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create wallet",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const completeWallet = async () => {
    if (!selectedWallet || walletKeys.length !== selectedWallet.n) return;

    try {
      setLoading(true);
      
      // Generate multisig address
      const publicKeys = walletKeys.map(k => k.public_key);
      const multisigResult = bitcoinService.createMultisigAddress(selectedWallet.m, publicKeys);
      
      if (!multisigResult) {
        toast({
          title: "Error",
          description: "Failed to generate multisig address",
          variant: "destructive"
        });
        return;
      }

      // Update wallet with address and mark as complete
      await walletService.updateWallet(selectedWallet.id, {
        address: multisigResult.address,
        script_hex: multisigResult.scriptHex,
        is_complete: true
      });

      await loadWallets();
      setConfig(prev => ({ ...prev, address: multisigResult.address }));
      
      toast({
        title: "Multisig Address Generated",
        description: `${selectedWallet.m}-of-${selectedWallet.n} address created successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate multisig address",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Address copied successfully"
    });
  };

  const createTransaction = async () => {
    if (!selectedWallet || !selectedWallet.address) {
      toast({
        title: "No Wallet Available",
        description: "Please complete wallet setup first",
        variant: "destructive"
      });
      return;
    }

    const toAddress = (document.getElementById('recipient') as HTMLInputElement)?.value;
    const amountBtc = (document.getElementById('amount') as HTMLInputElement)?.value;

    if (!toAddress || !amountBtc) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient address and amount",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const amountSatoshis = bitcoinService.btcToSatoshis(amountBtc);
      const feeSatoshis = bitcoinService.estimateFee(1, 2); // Simplified fee estimation

      await walletService.createTransaction({
        wallet_id: selectedWallet.id,
        to_address: toAddress,
        amount_satoshis: amountSatoshis,
        fee_satoshis: feeSatoshis,
        required_signatures: selectedWallet.m,
        signatures: [],
        is_complete: false,
        is_broadcast: false
      });

      await loadTransactions(selectedWallet.id);
      
      // Clear form
      (document.getElementById('recipient') as HTMLInputElement).value = '';
      (document.getElementById('amount') as HTMLInputElement).value = '';
      
      toast({
        title: "Transaction Created",
        description: "Transaction ready for signatures"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const signTransaction = async (transactionId: string) => {
    try {
      setLoading(true);
      
      // Generate a mock signature for demo purposes
      const mockSignature = `sig_${Math.random().toString(36).substring(2, 8)}`;
      
      await walletService.addTransactionSignature(transactionId, mockSignature);
      await loadTransactions(selectedWallet!.id);
      
      toast({
        title: "Transaction Signed",
        description: "Signature added to transaction"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign transaction",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-gradient-bitcoin">
                <Bitcoin className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="text-left">
                <h1 className="text-4xl font-bold bg-gradient-bitcoin bg-clip-text text-transparent">
                  Bitcoin Multisig Wallet
                </h1>
                <p className="text-muted-foreground">Welcome, {user?.email}</p>
              </div>
            </div>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Secure multi-signature Bitcoin wallet for enhanced security and collaborative fund management
          </p>
        </div>

        <Tabs defaultValue="setup" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-card">
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Manage
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Transactions
            </TabsTrigger>
          </TabsList>

          {/* Setup Tab */}
          <TabsContent value="setup" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Multisig Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure the signature requirements for your wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="wallet-name">Wallet Name</Label>
                      <Input
                        id="wallet-name"
                        placeholder="Enter wallet name"
                        value={config.name}
                        onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                        disabled={!!selectedWallet}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="m-value">Required Signatures (M)</Label>
                        <Input
                          id="m-value"
                          type="number"
                          min="1"
                          max="15"
                          value={config.m}
                          onChange={(e) => setConfig(prev => ({ ...prev, m: parseInt(e.target.value) || 1 }))}
                          disabled={!!selectedWallet}
                        />
                      </div>
                      <div>
                        <Label htmlFor="n-value">Total Signers (N)</Label>
                        <Input
                          id="n-value"
                          type="number"
                          min="1"
                          max="15"
                          value={config.n}
                          onChange={(e) => setConfig(prev => ({ 
                            ...prev, 
                            n: parseInt(e.target.value) || 1
                          }))}
                          disabled={!!selectedWallet}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      This will create a <Badge variant="secondary">{config.m}-of-{config.n}</Badge> multisig wallet
                      requiring {config.m} signatures out of {config.n} total signers.
                    </p>
                  </div>
                  
                  {!selectedWallet && (
                    <Button 
                      onClick={createWallet}
                      disabled={loading || !config.name.trim()}
                      className="w-full"
                    >
                      {loading ? "Creating..." : "Create Wallet"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    Public Keys ({walletKeys.length}/{selectedWallet?.n || config.n})
                  </CardTitle>
                  <CardDescription>
                    Add public keys for all signers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pubkey">Public Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="pubkey"
                        placeholder="Enter public key (hex format)"
                        value={newPubKey}
                        onChange={(e) => setNewPubKey(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" onClick={generateRandomKey} size="sm">
                        Generate
                      </Button>
                    </div>
                  </div>
                  <Button 
                    onClick={addPublicKey} 
                    disabled={!newPubKey.trim() || !selectedWallet || walletKeys.length >= (selectedWallet?.n || config.n) || loading}
                    className="w-full"
                  >
                    {loading ? "Adding..." : "Add Public Key"}
                  </Button>
                  
                  {!selectedWallet && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Create a wallet first to add public keys
                      </p>
                    </div>
                  )}
                  
                  {walletKeys.length > 0 && (
                    <div className="space-y-2">
                      <Label>Added Keys:</Label>
                      <div className="space-y-2">
                        {walletKeys.map((walletKey, index) => (
                          <div key={walletKey.id} className="p-2 bg-muted rounded space-y-1">
                            <div className="font-mono text-xs break-all">
                              {walletKey.public_key.substring(0, 20)}...{walletKey.public_key.substring(walletKey.public_key.length - 20)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {walletKey.owner_name || `Key ${index + 1}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedWallet && walletKeys.length === selectedWallet.n && !selectedWallet.address && (
                    <Button 
                      variant="bitcoin" 
                      onClick={completeWallet}
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? 'Generating...' : 'Generate Multisig Address'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedWallet?.address && (
              <Card className="shadow-card border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <CheckCircle className="h-5 w-5" />
                    Multisig Address Generated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm break-all">{selectedWallet.address}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedWallet.address!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your {selectedWallet.m}-of-{selectedWallet.n} multisig address is ready to receive Bitcoin. 
                      Share this address safely to receive funds.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Wallet Information</CardTitle>
                <CardDescription>Current wallet configuration and status</CardDescription>
              </CardHeader>
                <CardContent className="space-y-4">
                {selectedWallet ? (
                  <>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">{selectedWallet.m}-of-{selectedWallet.n}</div>
                        <div className="text-sm text-muted-foreground">Signature Scheme</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">{walletKeys.length}</div>
                        <div className="text-sm text-muted-foreground">Public Keys Added</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">{transactions.length}</div>
                        <div className="text-sm text-muted-foreground">Total Transactions</div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label>Wallet Name</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="font-medium">{selectedWallet.name}</span>
                        </div>
                      </div>
                      
                      {selectedWallet.address && (
                        <div>
                          <Label>Multisig Address</Label>
                          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                            <code className="flex-1 text-sm">{selectedWallet.address}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(selectedWallet.address!)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <Label>Status</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <Badge variant={selectedWallet.is_complete ? "default" : "secondary"}>
                            {selectedWallet.is_complete ? "Complete" : "Setup Required"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Wallet Selected</h3>
                    <p className="text-muted-foreground">
                      Create a wallet in the Setup tab to get started.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Private Key Backup Section */}
            <PrivateKeyBackup selectedWallet={selectedWallet} walletKeys={walletKeys} />
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            {selectedWallet?.address ? (
              <>
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5 text-primary" />
                      Create Transaction
                    </CardTitle>
                    <CardDescription>Send Bitcoin from your multisig wallet</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recipient">Recipient Address</Label>
                        <Input
                          id="recipient"
                          placeholder="Enter Bitcoin address"
                           defaultValue=""
                        />
                      </div>
                      <div>
                        <Label htmlFor="amount">Amount (BTC)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.00000001"
                          placeholder="0.00000000"
                           defaultValue=""
                        />
                      </div>
                    </div>
                    <Button 
                      variant="bitcoin" 
                      onClick={createTransaction}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? "Creating..." : "Create Transaction"}
                    </Button>
                  </CardContent>
                </Card>

                {transactions.length > 0 && (
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle>Pending Transactions</CardTitle>
                      <CardDescription>Transactions awaiting signatures</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {transactions.map((tx) => {
                          const signatures = tx.signatures as string[] || [];
                          return (
                            <div key={tx.id} className="p-4 border rounded-lg space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="font-mono text-sm">To: {tx.to_address}</div>
                                  <div className="text-lg font-semibold">
                                    {bitcoinService.satoshisToBtc(tx.amount_satoshis)} BTC
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Fee: {bitcoinService.satoshisToBtc(tx.fee_satoshis)} BTC
                                  </div>
                                </div>
                                <div className="text-right space-y-1">
                                  <Badge variant={tx.is_complete ? "default" : "secondary"}>
                                    {tx.is_complete ? "Complete" : `${signatures.length}/${tx.required_signatures} Signatures`}
                                  </Badge>
                                  {tx.is_broadcast && (
                                    <Badge variant="outline" className="block">
                                      Broadcast
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <Separator />
                              
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                  Transaction ID: {tx.id.substring(0, 8)}...
                                </div>
                                {!tx.is_complete && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => signTransaction(tx.id)}
                                    disabled={loading}
                                  >
                                    {loading ? "Signing..." : "Sign Transaction"}
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="shadow-card">
                <CardContent className="text-center py-12">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Wallet Created</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a multisig wallet first in the Setup tab to start making transactions.
                  </p>
                  <Button variant="outline">
                    Go to Setup
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};