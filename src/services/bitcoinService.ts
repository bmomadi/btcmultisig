import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { Buffer } from 'buffer';

// Initialize bitcoin library with elliptic curve
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export interface PublicKeyInfo {
  hex: string;
  compressed: boolean;
  valid: boolean;
}

export const bitcoinService = {
  /**
   * Generate a random Bitcoin key pair for testing
   */
  generateKeyPair() {
    const keyPair = ECPair.makeRandom();
    return {
      privateKey: keyPair.privateKey ? Buffer.from(keyPair.privateKey).toString('hex') : '',
      publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
      address: bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey) }).address || ''
    };
  },

  /**
   * Validate a public key
   */
  validatePublicKey(pubkeyHex: string): PublicKeyInfo {
    try {
      const pubkeyBuffer = Buffer.from(pubkeyHex, 'hex');
      
      // Check if it's a valid length (33 bytes compressed or 65 bytes uncompressed)
      if (pubkeyBuffer.length !== 33 && pubkeyBuffer.length !== 65) {
        return { hex: pubkeyHex, compressed: false, valid: false };
      }

      // Try to create a point from the public key
      const isValid = ecc.isPoint(pubkeyBuffer);
      const isCompressed = pubkeyBuffer.length === 33;

      return {
        hex: pubkeyHex,
        compressed: isCompressed,
        valid: isValid
      };
    } catch (error) {
      return { hex: pubkeyHex, compressed: false, valid: false };
    }
  },

  /**
   * Create a multisig P2SH address from public keys
   */
  createMultisigAddress(m: number, publicKeys: string[]): { address: string; scriptHex: string } | null {
    try {
      // Convert hex strings to buffers and validate
      const pubkeyBuffers = publicKeys.map(hex => {
        const buffer = Buffer.from(hex, 'hex');
        if (!ecc.isPoint(buffer)) {
          throw new Error(`Invalid public key: ${hex}`);
        }
        return buffer;
      });

      // Create multisig script
      const payment = bitcoin.payments.p2ms({
        m,
        pubkeys: pubkeyBuffers,
      });

      if (!payment.output) {
        throw new Error('Failed to create multisig script');
      }

      // Wrap in P2SH
      const p2sh = bitcoin.payments.p2sh({
        redeem: payment,
      });

      if (!p2sh.address) {
        throw new Error('Failed to create P2SH address');
      }

      return {
        address: p2sh.address,
        scriptHex: payment.output.toString('hex')
      };
    } catch (error) {
      console.error('Error creating multisig address:', error);
      return null;
    }
  },

  /**
   * Create a raw transaction (simplified for demo)
   */
  createRawTransaction(
    inputs: Array<{ txid: string; vout: number; value: number }>,
    outputs: Array<{ address: string; value: number }>,
    scriptHex: string
  ): string {
    try {
      const psbt = new bitcoin.Psbt();

      // Add inputs
      inputs.forEach(input => {
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          redeemScript: Buffer.from(scriptHex, 'hex'),
          witnessUtxo: {
            script: Buffer.from(scriptHex, 'hex'),
            value: input.value
          }
        });
      });

      // Add outputs
      outputs.forEach(output => {
        psbt.addOutput({
          address: output.address,
          value: output.value
        });
      });

      return psbt.toBase64();
    } catch (error) {
      console.error('Error creating raw transaction:', error);
      return '';
    }
  },

  /**
   * Convert satoshis to BTC
   */
  satoshisToBtc(satoshis: number): string {
    return (satoshis / 100000000).toFixed(8);
  },

  /**
   * Convert BTC to satoshis
   */
  btcToSatoshis(btc: string): number {
    return Math.round(parseFloat(btc) * 100000000);
  },

  /**
   * Estimate transaction fee (simplified)
   */
  estimateFee(inputCount: number, outputCount: number): number {
    // Simplified fee calculation: ~10 sat/vbyte
    const estimatedSize = inputCount * 148 + outputCount * 34 + 10;
    return estimatedSize * 10; // 10 sat/vbyte
  }
};