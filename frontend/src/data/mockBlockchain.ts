import type { BlockchainRecord } from './types';

export const mockBlockchainRecords: BlockchainRecord[] = [
  {
    sessionId: '2026-016',
    bdnHash: '0x7a3f2d1c8e9b4f6a5d3c2b1a9e8f7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e',
    mfmHash: '0x9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c',
    validationHash: '0x7a3f2d1c8e9b4f6a5d3c2b1a9e8f7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e',
    transactionHash: '0x9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c',
    blockNumber: '186543219',
    timestamp: '2026-06-10T10:30:22Z',
    qrCodeUrl: 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=0x9d8c7b6a5f4e3d2c1b0a',
  },
  {
    sessionId: '2026-015',
    bdnHash: '0x6b2e1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b',
    mfmHash: '0x8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b',
    validationHash: '0x6b2e1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b',
    transactionHash: '0x8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b',
    blockNumber: '186520145',
    timestamp: '2026-06-08T14:22:15Z',
    qrCodeUrl: 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=0x8c7b6a5f4e3d2c1b0a',
  },
  {
    sessionId: '2026-014',
    bdnHash: '0x5a1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d',
    mfmHash: '0x7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a',
    validationHash: '0x5a1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d',
    transactionHash: '0x7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a',
    blockNumber: '186498076',
    timestamp: '2026-05-30T11:45:08Z',
    qrCodeUrl: 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=0x7b6a5f4e3d2c1b0a',
  },
  {
    sessionId: '2026-012',
    bdnHash: '0x3b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a',
    mfmHash: '0x5c4d3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c',
    validationHash: '0x3b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a',
    transactionHash: '0x5c4d3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c',
    blockNumber: '186453728',
    timestamp: '2026-05-28T09:18:33Z',
    qrCodeUrl: 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=0x5c4d3b2a1f0e9d8c',
  },
];

export const getBlockchainRecordBySessionId = (sessionId: string) =>
  mockBlockchainRecords.find(r => r.sessionId === sessionId);
