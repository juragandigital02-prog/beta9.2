import {
  processWalletActivation,
  verifyOnChainDeposit,
  submitWithdrawal,
  topUpGas,
  transferToMember,
} from '../api/walletApi';

export const activateWalletAccount = processWalletActivation;
export const verifyWalletDeposit = verifyOnChainDeposit;
export const requestWalletWithdrawal = submitWithdrawal;
export const addGasReserve = topUpGas;
export const transferWalletFunds = transferToMember;
