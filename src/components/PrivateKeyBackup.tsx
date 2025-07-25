import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Key, Lock, Unlock, AlertTriangle, Download, Eye, EyeOff, Upload, FileDown } from "lucide-react";
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
  const [importFile, setImportFile] = useState<File | null>(null);
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
      
      // Encrypt and store each private key using consistent encryption method
      for (const walletKey of walletKeys) {
        const privateKey = privateKeys[walletKey.id];
        
        // Use the cryptoService.encrypt method for consistency
        const encryptedPrivateKey = cryptoService.encrypt(privateKey, password);
        
        // Store the encrypted data with the shared salt and IV
        await walletService.updateWalletKeyWithPrivateKey(
          walletKey.id,
          encryptedPrivateKey.encryptedData
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
      console.error('Backup creation error:', error);
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
      
      console.log('Attempting to decrypt keys with backup:', keyBackup);
      
      for (const walletKey of walletKeys) {
        if (walletKey.encrypted_private_key) {
          try {
            console.log(`Decrypting key ${walletKey.id}...`);
            const decryptedKey = cryptoService.decrypt(
              walletKey.encrypted_private_key,
              decryptPassword,
              keyBackup.salt,
              keyBackup.iv
            );
            decrypted[walletKey.id] = decryptedKey;
            console.log(`Successfully decrypted key ${walletKey.id}`);
          } catch (error) {
            console.error(`Failed to decrypt key ${walletKey.id}:`, error);
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
      console.error('Decryption error:', error);
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

  const exportEncryptedBackup = () => {
    if (!keyBackup || !selectedWallet) {
      toast({
        title: "Error",
        description: "No backup available to export",
        variant: "destructive"
      });
      return;
    }

    const encryptedBackupData = {
      version: "1.0",
      walletId: selectedWallet.id,
      walletName: selectedWallet.name,
      walletConfig: {
        m: selectedWallet.m,
        n: selectedWallet.n,
        address: selectedWallet.address
      },
      encryption: {
        salt: keyBackup.salt,
        iv: keyBackup.iv
      },
      created: keyBackup.created_at,
      encryptedKeys: walletKeys.map((key, index) => ({
        index: key.key_index,
        publicKey: key.public_key,
        encryptedPrivateKey: key.encrypted_private_key || null,
        ownerName: key.owner_name,
        keyId: key.id
      }))
    };
    
    const blob = new Blob([JSON.stringify(encryptedBackupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encrypted-backup-${selectedWallet.name || 'wallet'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Encrypted Backup Exported",
      description: "Encrypted backup file has been saved to your device"
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const importEncryptedBackup = async () => {
    if (!importFile) {
      toast({
        title: "Error",
        description: "Please select a backup file to import",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const fileContent = await importFile.text();
      const backupData = JSON.parse(fileContent);

      // Validate backup format
      if (!backupData.version || !backupData.walletId || !backupData.encryption || !backupData.encryptedKeys) {
        throw new Error("Invalid backup file format");
      }

      // Check if this backup belongs to the current wallet
      if (selectedWallet && backupData.walletId !== selectedWallet.id) {
        toast({
          title: "Warning",
          description: "This backup belongs to a different wallet. Import anyway?",
          variant: "destructive"
        });
        return;
      }

      // Import the encryption parameters
      if (!keyBackup) {
        const backup = await walletService.createKeyBackup(
          backupData.walletId,
          backupData.encryption.salt,
          backupData.encryption.iv
        );
        setKeyBackup(backup);
      }

      // Import encrypted private keys
      for (const keyData of backupData.encryptedKeys) {
        if (keyData.encryptedPrivateKey) {
          // Find the corresponding wallet key
          const walletKey = walletKeys.find(k => k.public_key === keyData.publicKey);
          if (walletKey) {
            await walletService.updateWalletKeyWithPrivateKey(
              walletKey.id,
              keyData.encryptedPrivateKey
            );
          }
        }
      }

      setImportFile(null);
      // Reset file input
      const fileInput = document.getElementById('import-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      toast({
        title: "Backup Imported",
        description: "Encrypted backup has been successfully imported"
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import backup file. Please check the file format.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
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
                    <h4 className="font-medium">Backup Management</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={exportEncryptedBackup}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Encrypted
                      </Button>
                      <Button variant="outline" onClick={downloadBackup}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Decrypted
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      💡 <strong>Export Options:</strong>
                    </p>
                    <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-4 list-disc">
                      <li><strong>Export Encrypted:</strong> Save encrypted backup that can be imported later</li>
                      <li><strong>Download Decrypted:</strong> Save readable JSON with private keys (less secure)</li>
                    </ul>
                  </div>
                  
                  <h5 className="font-medium">Decrypted Private Keys</h5>
                  
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
              
              {/* Import/Export Section */}
              <div className="space-y-4">
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-4">Import Encrypted Backup</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="import-file">Select Backup File</Label>
                      <Input
                        id="import-file"
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="cursor-pointer"
                      />
                    </div>
                    
                    {importFile && (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{importFile.name}</span>
                          <Button
                            onClick={importEncryptedBackup}
                            disabled={loading}
                            size="sm"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {loading ? "Importing..." : "Import Backup"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};