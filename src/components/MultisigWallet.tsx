import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Shield, Key, Send, Users, Bitcoin, ArrowRight, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MultisigConfig {
  m: number;
  n: number;
  publicKeys: string[];
  address?: string;
}

interface Transaction {
  id: string;
  to: string;
  amount: string;
  signatures: string[];
  isComplete: boolean;
}

export const MultisigWallet = () => {
  const [config, setConfig] = useState<MultisigConfig>({ m: 2, n: 3, publicKeys: [] });
  const [newPubKey, setNewPubKey] = useState('');
  const [transaction, setTransaction] = useState<Partial<Transaction>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { toast } = useToast();

  const generateMockPubKey = () => {
    const chars = '0123456789abcdef';
    let result = '02';
    for (let i = 0; i < 62; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const addPublicKey = () => {
    if (newPubKey.trim() && config.publicKeys.length < config.n) {
      setConfig(prev => ({
        ...prev,
        publicKeys: [...prev.publicKeys, newPubKey.trim()]
      }));
      setNewPubKey('');
      toast({
        title: "Public Key Added",
        description: "Successfully added to multisig configuration"
      });
    }
  };

  const generateRandomKey = () => {
    const key = generateMockPubKey();
    setNewPubKey(key);
  };

  const createMultisigAddress = () => {
    if (config.publicKeys.length === config.n) {
      // Mock address generation
      const mockAddress = '3' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      setConfig(prev => ({ ...prev, address: mockAddress }));
      toast({
        title: "Multisig Address Created",
        description: `${config.m}-of-${config.n} address generated successfully`
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Address copied successfully"
    });
  };

  const createTransaction = () => {
    if (transaction.to && transaction.amount && config.address) {
      const newTx: Transaction = {
        id: Math.random().toString(36).substring(2, 15),
        to: transaction.to,
        amount: transaction.amount,
        signatures: [],
        isComplete: false
      };
      setTransactions(prev => [newTx, ...prev]);
      setTransaction({});
      toast({
        title: "Transaction Created",
        description: "Transaction ready for signatures"
      });
    }
  };

  const signTransaction = (txId: string) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id === txId && tx.signatures.length < config.m) {
        const newSignatures = [...tx.signatures, `sig_${Math.random().toString(36).substring(2, 8)}`];
        const isComplete = newSignatures.length >= config.m;
        return { ...tx, signatures: newSignatures, isComplete };
      }
      return tx;
    }));
    
    toast({
      title: "Transaction Signed",
      description: "Signature added to transaction"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-dark p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-full bg-gradient-bitcoin">
              <Bitcoin className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-bitcoin bg-clip-text text-transparent">
              Bitcoin Multisig Wallet
            </h1>
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
                          n: parseInt(e.target.value) || 1,
                          publicKeys: prev.publicKeys.slice(0, parseInt(e.target.value) || 1)
                        }))}
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      This will create a <Badge variant="secondary">{config.m}-of-{config.n}</Badge> multisig wallet
                      requiring {config.m} signatures out of {config.n} total signers.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    Public Keys ({config.publicKeys.length}/{config.n})
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
                    disabled={!newPubKey.trim() || config.publicKeys.length >= config.n}
                    className="w-full"
                  >
                    Add Public Key
                  </Button>
                  
                  {config.publicKeys.length > 0 && (
                    <div className="space-y-2">
                      <Label>Added Keys:</Label>
                      <div className="space-y-2">
                        {config.publicKeys.map((key, index) => (
                          <div key={index} className="p-2 bg-muted rounded font-mono text-xs break-all">
                            {key.substring(0, 20)}...{key.substring(key.length - 20)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {config.publicKeys.length === config.n && (
                    <Button 
                      variant="bitcoin" 
                      onClick={createMultisigAddress}
                      className="w-full"
                      disabled={!!config.address}
                    >
                      {config.address ? 'Address Created' : 'Create Multisig Address'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {config.address && (
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
                        <span className="font-mono text-sm break-all">{config.address}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(config.address!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your {config.m}-of-{config.n} multisig address is ready to receive Bitcoin. 
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
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{config.m}-of-{config.n}</div>
                    <div className="text-sm text-muted-foreground">Signature Scheme</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{config.publicKeys.length}</div>
                    <div className="text-sm text-muted-foreground">Public Keys Added</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{transactions.length}</div>
                    <div className="text-sm text-muted-foreground">Total Transactions</div>
                  </div>
                </div>
                
                {config.address && (
                  <div>
                    <Label>Multisig Address</Label>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <code className="flex-1 text-sm">{config.address}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(config.address!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            {config.address ? (
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
                          value={transaction.to || ''}
                          onChange={(e) => setTransaction(prev => ({ ...prev, to: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="amount">Amount (BTC)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.00000001"
                          placeholder="0.00000000"
                          value={transaction.amount || ''}
                          onChange={(e) => setTransaction(prev => ({ ...prev, amount: e.target.value }))}
                        />
                      </div>
                    </div>
                    <Button 
                      variant="bitcoin" 
                      onClick={createTransaction}
                      disabled={!transaction.to || !transaction.amount}
                      className="w-full"
                    >
                      Create Transaction
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
                        {transactions.map((tx) => (
                          <div key={tx.id} className="p-4 border rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="font-mono text-sm">To: {tx.to}</div>
                                <div className="text-lg font-semibold">{tx.amount} BTC</div>
                              </div>
                              <div className="text-right space-y-1">
                                <Badge variant={tx.isComplete ? "default" : "secondary"}>
                                  {tx.isComplete ? "Complete" : `${tx.signatures.length}/${config.m} Signatures`}
                                </Badge>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-muted-foreground">
                                Transaction ID: {tx.id}
                              </div>
                              {!tx.isComplete && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => signTransaction(tx.id)}
                                >
                                  Sign Transaction
                                  <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
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