import {DURATION, MAX_PORTALS, WARP_MAX_SPEED, type DifficultySetting} from './types';
import {DELIVERY_URGENCIES, type Contract, type DeliverySpeedBonus, type DeliveryUrgency, type Risk} from './contracts';

export const MAX_SPEED_REWARD=25000;
/** Integral of the current smooth warp: 1s ramp + 5s hold + 2s ramp down. */
export const BOOST_TIME_SAVING=(WARP_MAX_SPEED-1)*(.5+5+1);
export type DeliveryTimingOptions={cruise:number;difficulty:DifficultySetting;usableBoosts?:number};
export type TimedContract=Contract & {urgency:DeliveryUrgency;speedBonus:DeliverySpeedBonus};
export const URGENCY_RULES:Record<DeliveryUrgency,{rewardFraction:number;savingsFraction:number;expirySlack:number;extraGateLimit:number}>={
  standard:{rewardFraction:.15,savingsFraction:.4,expirySlack:30,extraGateLimit:0},
  priority:{rewardFraction:.3,savingsFraction:.75,expirySlack:15,extraGateLimit:1},
  express:{rewardFraction:.5,savingsFraction:1,expirySlack:0,extraGateLimit:2},
};
const bounded=(value:number,min:number,max:number,fallback:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
export function defaultDeliveryUrgency(risk:Risk):DeliveryUrgency {
  return risk==='high'?'express':risk==='medium'?'priority':'standard';
}
export function contractUrgency(contract:Pick<Contract,'risk'|'urgency'>):DeliveryUrgency {
  return contract.urgency&&DELIVERY_URGENCIES.includes(contract.urgency)?contract.urgency:defaultDeliveryUrgency(contract.risk);
}
/** Deadlines use only the scheduled gates. Optional Director shortcuts never make a deadline mandatory. */
export function deliverySpeedTerms(contract:Pick<Contract,'sector'|'reward'|'risk'|'urgency'>,options:DeliveryTimingOptions):DeliverySpeedBonus {
  const urgency=contractUrgency(contract),rule=URGENCY_RULES[urgency];
  const cruise=bounded(options.cruise,.5,2,1),baseSeconds=DURATION/cruise;
  const usableBoosts=Math.floor(bounded(options.usableBoosts??MAX_PORTALS,0,MAX_PORTALS,MAX_PORTALS));
  const savings=usableBoosts*BOOST_TIME_SAVING;
  const sector=bounded(contract.sector,1,Number.MAX_SAFE_INTEGER,1),pressure=(sector-1)/(sector+11);
  const difficultyAllowance=options.difficulty==='easy'?10:options.difficulty==='hard'?9:6;
  const margin=difficultyAllowance+pressure*4;
  const fullBonusSeconds=Math.ceil(baseSeconds-savings*rule.savingsFraction+margin);
  const expiresSeconds=Math.ceil(Math.max(fullBonusSeconds+18,baseSeconds+rule.expirySlack+margin-6));
  const baseReward=bounded(contract.reward,0,1000000,0);
  const maxReward=Math.min(MAX_SPEED_REWARD,Math.round(baseReward*rule.rewardFraction/25)*25);
  return {maxReward,fullBonusSeconds,expiresSeconds,extraGateLimit:rule.extraGateLimit};
}
/** Rebind after ship/difficulty/upgrade choices; model-supplied numeric terms are never carried forward. */
export function bindDeliveryTiming(contract:Contract,options:DeliveryTimingOptions):TimedContract {
  const urgency=contractUrgency(contract);
  return {...contract,urgency,speedBonus:deliverySpeedTerms({...contract,urgency},options)};
}
/** Only local active-flight elapsed seconds determine payout. Pause and network time are excluded upstream. */
export function deliverySpeedReward(contract:Pick<Contract,'speedBonus'>,elapsed:number|undefined|null,successful=true):number {
  const terms=contract.speedBonus;
  if(!successful||typeof elapsed!=='number'||!Number.isFinite(elapsed)||elapsed<=0||!terms)return 0;
  const {maxReward,fullBonusSeconds,expiresSeconds}=terms;
  if(!Number.isFinite(maxReward)||maxReward<=0||!Number.isFinite(fullBonusSeconds)||fullBonusSeconds<=0||!Number.isFinite(expiresSeconds)||expiresSeconds<=fullBonusSeconds)return 0;
  const maximum=Math.floor(Math.min(MAX_SPEED_REWARD,maxReward));
  if(elapsed<=fullBonusSeconds)return maximum;
  if(elapsed>=expiresSeconds)return 0;
  return Math.max(0,Math.floor(maximum*(expiresSeconds-elapsed)/(expiresSeconds-fullBonusSeconds)));
}
