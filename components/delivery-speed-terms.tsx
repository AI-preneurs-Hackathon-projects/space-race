import type {Contract} from '@/lib/game/contracts';

export function deliveryTime(seconds:number):string {
 const value=Math.max(0,Math.ceil(Number.isFinite(seconds)?seconds:0));
 return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
}

export default function DeliverySpeedTerms({contract}:{contract:Contract}) {
 const terms=contract.speedBonus;if(!terms)return null;
 return <span className="contract-speed-terms">
  <b>{(contract.urgency??'standard').toUpperCase()} · up to +{terms.maxReward.toLocaleString('en-US')} cr</b>
  <span>Full by {deliveryTime(terms.fullBonusSeconds)} · fades to 0 at {deliveryTime(terms.expiresSeconds)}</span>
  <small>2 route jumps{terms.extraGateLimit?` + up to ${terms.extraGateLimit} optional ${terms.extraGateLimit===1?'shortcut':'shortcuts'}`:''}</small>
 </span>;
}
