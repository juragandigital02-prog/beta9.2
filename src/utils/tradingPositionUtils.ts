import type { ExecutedLayerDetail, TradingPosition } from '../types';

export function generateDefaultLayersForPosition(position: TradingPosition): ExecutedLayerDetail[] {
  const currentPrice = position.price || 100;
  const layers: ExecutedLayerDetail[] = [];
  const count = Math.max(1, position.stepLayer || 1);
  const totalAllocation = parseFloat(position.allocationUsdt?.replace(/[^0-9.]/g, '') || '60');
  const baseCost = totalAllocation / count;

  for (let index = 1; index <= count; index += 1) {
    const buyPrice = currentPrice * (1 - (index - 1) * 0.012);
    const costUsdt = baseCost;
    const amount = costUsdt / (buyPrice || 1);
    const pnlUsdt = (currentPrice - buyPrice) * amount;
    const pnlPct = buyPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;

    layers.push({
      id: `layer-${position.id}-${index}`,
      orderId: `ORD-${position.coin}-${Date.now().toString().slice(-6)}-${index}`,
      symbol: position.pair,
      coin: position.coin,
      side: 'buy',
      layerStep: index,
      layerType: index % 2 === 0 ? 'grid' : 'average',
      label: `BUY -> ${amount.toFixed(4)} ${position.coin}`,
      amount,
      costUsdt,
      buyPrice,
      currentPrice,
      estimatedTpPrice: buyPrice * 1.015,
      estimatedTpPct: 1.5,
      estimatedTpUsdt: costUsdt * 0.015,
      floatingPnlUsdt: pnlUsdt,
      floatingPnlPct: pnlPct,
      fee: costUsdt * 0.001,
      feeAsset: 'USDT',
      date: new Date(Date.now() - (count - index) * 1800000).toLocaleString('id-ID'),
      timestamp: Date.now() - (count - index) * 1800000,
      isInitialEntry: index === 1,
      status: 'filled',
    });
  }

  return layers;
}
