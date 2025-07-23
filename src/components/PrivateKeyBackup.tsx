import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Key, Lock, Unlock, AlertTriangle, Download, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { walletService, type Wallet, type WalletKey, type KeyBackup } from "@/services/walletService";
import { cryptoService } from "@/services/cryptoService";
import { bitcoinService } from "@/services/bitcoinService";
import CryptoJS from 'crypto-js';

interface PrivateKeyBackupProps {
  selectedWallet: Wallet | null;
  walletKeys: WalletKey[];
}

export const PrivateKeyBackup: React.FC<PrivateKeyBackupProps> = ({ selectedWallet, walletKeys }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [decryptPassword, setDecryptPassword] = useState('');
  const [keyBackup, setKeyBackup] = useState<KeyBackup | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedKeys, setDecryptedKeys] = useState<Record<string, string>>({});
  const [showDecryptedKeys, setShowDecryptedKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedWallet) {
      loadKeyBackup();
    }
  }, [selectedWallet]);

  const loadKeyBackup = async () => {
    if (!selectedWallet) return;
    
    try {
      const backup = await walletService.getKeyBackup(selectedWallet.id);
      setKeyBackup(backup);
    } catch (error) {
      // Backup doesn't exist yet, that's fine
      setKeyBackup(null);
    }
  };

  const generatePrivateKeys = () => {
    const keys: Record<string, string> = {};
    walletKeys.forEach((walletKey) => {
      // Generate a mock private key for demo purposes
      const keyPair = bitcoinService.generateKeyPair();
      keys[walletKey.id] = keyPair.privateKey;
    });
    return keys;
  };

  const createBackup = async () => {
    if (!selectedWallet || !password || password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Please enter and confirm your password",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreatingBackup(true);
      
      // Generate private keys for each wallet key
      const privateKeys = generatePrivateKeys();
      
      // Generate shared salt and IV for all keys in the wallet
      const dummyData = "test";
      const encryptionResult = cryptoService.encrypt(dummyData, password);
      
      // Create key backup record with shared parameters
      const backup = await walletService.createKeyBackup(
        selectedWallet.id,
        encryptionResult.salt,
        encryptionResult.iv
      );
      
      // Encrypt and store each private key using the shared salt and IV
      for (const walletKey of walletKeys) {
        const privateKey = privateKeys[walletKey.id];
        
        // Use the shared salt and IV for all keys
        const key = cryptoService.deriveKey(password, encryptionResult.salt);
        const encrypted = CryptoJS.AES.encrypt(privateKey, key, {
          iv: CryptoJS.enc.Hex.parse(encryptionResult.iv),
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        
        await walletService.updateWalletKeyWithPrivateKey(
          walletKey.id,
          encrypted.toString()
        );
      }

      setKeyBackup(backup);
      setPassword('');
      setConfirmPassword('');
      
      toast({
        title: "Backup Created",
        description: "Private keys have been encrypted and backed up securely"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "destructive"
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const decryptBackup = async () => {
    if (!keyBackup || !decryptPassword) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsDecrypting(true);
      const decrypted: Record<string, string> = {};
      
      for (const walletKey of walletKeys) {
        if (walletKey.encrypted_private_key) {
          try {
            const decryptedKey = cryptoService.decrypt(
              walletKey.encrypted_private_key,
              decryptPassword,
              keyBackup.salt,
              keyBackup.iv
            );
            decrypted[walletKey.id] = decryptedKey;
          } catch (error) {
            throw new Error("Invalid password or corrupted backup");
          }
        }
      }
      
      setDecryptedKeys(decrypted);
      setDecryptPassword('');
      
      toast({
        title: "Backup Decrypted",
        description: "Private keys have been successfully decrypted"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to decrypt backup. Please check your password.",
        variant: "destructive"
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowDecryptedKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const downloadBackup = () => {
    if (!keyBackup || Object.keys(decryptedKeys).length === 0) return;
    
    const backupData = {
      walletId: selectedWallet?.id,
      walletName: selectedWallet?.name,
      created: keyBackup.created_at,
      keys: walletKeys.map((key, index) => ({
        index: key.key_index,
        publicKey: key.public_key,
        privateKey: decryptedKeys[key.id] || 'Not decrypted',
        ownerName: key.owner_name
      }))
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-backup-${selectedWallet?.name || 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Backup Downloaded",
      description: "Backup file has been saved to your device"
    });
  };

  if (!selectedWallet) {
    return (
      <Card className="shadow-card">
        <CardContent className="text-center py-8">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Wallet Selected</h3>
          <p className="text-muted-foreground">
            Select a wallet to manage private key backups.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-yellow-200 dark:border-yellow-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
            <AlertTriangle className="h-5 w-5" />
            Private Key Backup
          </CardTitle>
          <CardDescription>
            Securely backup and encrypt your wallet's private keys using your login password.
            <strong className="block mt-2 text-yellow-700 dark:text-yellow-300">
              Warning: Store your backup securely. Anyone with access to the backup and password can control your funds.
            </strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!keyBackup ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  No backup exists for this wallet. Create a secure backup of your private keys.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="backup-password">Backup Password</Label>
                  <Input
                    id="backup-password"
                    type="password"
                    placeholder="Enter a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={createBackup}
                  disabled={!password || password !== confirmPassword || isCreatingBackup || walletKeys.length === 0}
                  className="w-full"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {isCreatingBackup ? "Creating Backup..." : "Create Encrypted Backup"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Backup exists for this wallet
                  </span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Created: {new Date(keyBackup.created_at).toLocaleString()}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="decrypt-password">Enter Password to Decrypt</Label>
                  <Input
                    id="decrypt-password"
                    type="password"
                    placeholder="Enter your backup password"
                    value={decryptPassword}
                    onChange={(e) => setDecryptPassword(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={decryptBackup}
                  disabled={!decryptPassword || isDecrypting}
                  className="w-full"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  {isDecrypting ? "Decrypting..." : "Decrypt Private Keys"}
                </Button>
              </div>

              {Object.keys(decryptedKeys).length > 0 && (
                <div className="space-y-4">
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Decrypted Private Keys</h4>
                    <Button variant="outline" onClick={downloadBackup}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Backup
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {walletKeys.map((walletKey, index) => {
                      const privateKey = decryptedKeys[walletKey.id];
                      const isVisible = showDecryptedKeys[walletKey.id];
                      
                      return (
                        <div key={walletKey.id} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">
                                {walletKey.owner_name || `Key ${index + 1}`}
                              </span>
                            </div>
                            <Badge variant="secondary">
                              Index {walletKey.key_index}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs">Public Key</Label>
                              <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                                {walletKey.public_key}
                              </div>
                            </div>
                            
                            {privateKey && (
                              <div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Private Key</Label>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleKeyVisibility(walletKey.id)}
                                  >
                                    {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </Button>
                                </div>
                                <div className="font-mono text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded break-all border border-red-200 dark:border-red-800">
                                  {isVisible ? privateKey : '•'.repeat(64)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};